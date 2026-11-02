# Golang_QQ 后端架构梳理（面试深挖版）

> 面试用法：先记住「一图三链路」（§1），再按模块准备。每个模块分三部分：**机制**（怎么实现的，带文件:行号）、**亮点**（可以主动抛的）、**挖掘点**（面试官会追问什么 + 推荐答法）。§6 是"主动坦白"清单——被问到缺陷时坦承 + 给方案，比被戳穿强得多。

---

## 一、项目概览

**一句话定位**：Gin + MongoDB + Redis 的全栈即时通讯系统，含 WebSocket 实时通道、WebRTC 音视频通话（P2P + WS 信令）、大文件 HDFS 分层存储、以及一个 Agentic RAG 子系统（个人知识库问答 + 聊天记忆检索 + 每日早报 + MCP 工具生态）。

**技术栈**：

| 层 | 选型 |
|---|---|
| Web 框架 | Gin（含 Logger/Recovery） |
| 数据库 | MongoDB 7（官方 driver），6 个集合 |
| 缓存 | Redis 7（go-redis/v9），7 类用途 |
| 实时通信 | gorilla/websocket，Hub 模式 + Redis Pub/Sub 跨实例 |
| 音视频 | WebRTC（前端 P2P），WS 只走信令 |
| 文件存储 | 本地磁盘（<10MB）+ HDFS WebHDFS（≥10MB），纯 REST 客户端 |
| AI | Python FastAPI RAG 服务（SSE 流式），LLM 走 DashScope 兼容 API，本地 embedding，MCP 工具（汇率服务） |
| 邮件 | net/smtp（587 STARTTLS） |
| 部署 | docker-compose 7 服务，nginx 终结 HTTPS/WS/SSE，多阶段构建 |

**部署拓扑**（单机 docker-compose，见 §13）：

```
浏览器 ──HTTPS 80/443──▶ nginx(web 容器)
                          ├─ /            → SPA 静态文件
                          ├─ /ws          → Go server:8080 (Upgrade, timeout 86400s)
                          ├─ /api/*       → Go server:8080
                          └─ /hdfs-files/ → Go server:8080 → WebHDFS(hdfs-nn:9870)
Go server ──内网──▶ MongoDB / Redis / RAG(rag:8000) ──▶ mcp-fx(9000)
```

**三条核心链路**（面试先讲这三条，展示全局观）：

1. **发消息**：客户端 → WS `chat`（或 HTTP 兜底）→ `SendChatMessage` 流水线（校验→幂等→落库→摘要→缓存失效→广播/离线队列→异步归档）
2. **音视频通话**：WebRTC 媒体 P2P 直传；WS 只传信令（call_incoming / accept / SDP / ICE），服务端维护通话状态注册表
3. **AI 问答**：前端 → `/api/ai/chat/stream`（JWT）→ Go 代理注入 owner_id → RAG（Agentic：LLM 自主选工具 search_chat_archive / search_knowledge_base / MCP）→ SSE 全链路无缓冲透传回前端

---

## 二、目录结构

```
server/
├── main.go          # 启动：config→Mongo→Redis→admin引导→Hub→scheduler→Gin
├── config/          # .env 加载，JWT_SECRET 缺失即 Fatal
├── router/          # 路由表 + 中间件挂载
├── middleware/      # JWT 鉴权 / RequireAdmin / CORS
├── handler/         # HTTP handlers（auth/user/friend/conversation/messages/group/upload/admin/ai/archive/ws）
├── ws/              # 实时层：hub/client/chat/calls
├── archive/         # 聊天记录归档到 RAG（异步 + 回填）
├── scheduler/       # 每日 AI 早报定时推送
├── model/           # Mongo 连接、索引、6 个集合模型
├── cache/           # Redis：online/offline/dedup/convo缓存/pubsub/验证码
├── storage/         # WebHDFS REST 客户端
├── pkg/email/       # SMTP 验证码邮件
├── repository/ service/   # 空目录（预留分层，见 §6.10 话术）
rag/                 # Python RAG 服务（源码在部署服务器）
mcp-fx/              # MCP 汇率工具服务（FastAPI）
web/                 # React 前端 + nginx.conf + Dockerfile
deploy/              # 证书、部署脚本、HDFS 配置 xml
docker-compose.yml   # 7 服务编排
```

---

## 三、分模块详解

### 3.1 启动与配置（main.go / config）

**机制**：启动顺序 config.Load → model.ConnectDB → cache.Init → admin 引导 → `ws.NewHub` + `go hub.Run()` + `StartPushSubscriber` → `scheduler.Start()` → gin 路由（main.go:19-42）。
- JWT_SECRET 缺失直接 `log.Fatal`（config/config.go:38-41），启动期快速失败。
- 管理员三条产生路径：env `ADMIN_USERNAME` 启动时 UpdateMany 提权；空库首个注册者自动 admin；直接改库。

**挖掘点**：多实例同时启动 admin 引导是否安全？（幂等，重复 set 无害。）为什么失败要 Fatal 而不是降级启动？（缺密钥签发的 token 全无效，早死比带病运行好。）

### 3.2 路由与中间件（router / middleware）

**机制**：
- 免 JWT：`/uploads/*` 静态、`/hdfs-files/:name`、`/ws`、`/api/mcp`（有意放开给外部 Agent）、auth 四个接口。
- JWT 组覆盖 users/conversations/groups/friends/upload/ai 全部业务；admin 组叠加 RequireAdmin。
- **JWT**：HS256 + env 密钥，claims 只有 `UserID` + 过期时间，固定 7 天，无 refresh token（middleware/auth.go:22-31）。校验通过 `c.Set("userID", ...)` 传递。
- **RequireAdmin**：每个 admin 请求实时查 Mongo 验 `role=="admin"`（auth.go:68-81）——角色不进 token，改角色即时生效。
- **CORS**：手写，`Allow-Origin: *`，OPTIONS 直接 204（cors.go:7-18）。

**亮点（主动抛）**：角色每请求查库 = 权限变更实时生效、可即时吊销，代价是一次查询——这是刻意的取舍。

**挖掘点**：角色放 JWT 的对比方案？答：放 JWT 性能好但撤销难，需配短过期 + refresh 或黑名单，复杂度更高，管理端低频场景查库更划算。7 天无 refresh 怎么办？坦承可加 refresh token / 滑动续期。token 泄露如何吊销？当前无黑名单，可答 Redis 黑名单按 jti。

### 3.3 认证体系（handler/auth.go）

**机制**：
- 注册：binding 校验 → 查重 → **bcrypt(DefaultCost=10)** 存哈希 → 签发 token（auth.go:153-193）。`Password` 字段 `json:"-"` + ToPublic() 双重脱敏。
- 登录：用户不存在与密码错误**返回同一句 "invalid credentials"**（防用户枚举，auth.go:204-212）。
- 验证码：Redis SetNX 1 分钟发送频控 → 6 位码存 Redis TTL 5 分钟 → SMTP 发送（cache/verify_code.go）。**成功才删除，失败可重试**（一次性防重放）。
- 邮箱登录：验证码校验通过后邮箱不存在则**自动注册**，用户名取邮箱前缀、冲突追加 `_1/_2`（auth.go:100-113）。

**挖掘点**：check-then-insert 查重非原子，并发注册重复用户名怎么办？答：username 有 unique 索引兜底（model/db.go），插入会报 duplicate key，可捕获后返回友好错误。验证码生成是 `UnixNano%1000000` 非 crypto/rand（见 §6 坦白清单）。

### 3.4 WebSocket 实时层（ws/）——全项目最核心的模块

**连接模型**：
- 浏览器 WS 无法带 Authorization 头 → token 走 **WebSocket 子协议**（`Subprotocols: ["access_token"]`），兜底 `?token=` 查询参数（handler/ws.go:17-33）。**先 ParseToken 再 Upgrade**，未升级就 401。
- 每连接两个 goroutine：`ReadPump`（读+dispatch）+ `WritePump`（写+ping），`go` 启动（handler/ws.go:69-70）。
- 心跳：pingPeriod 54s / pongWait 60s；**pong 回调里同时续期 Redis 在线 TTL**（ws/client.go:109-114）——协议层心跳和应用层在线状态用同一个机制，无额外轮询。
- `maxMessageSize` 放宽到 1MB，因为 WebRTC SDP offer/answer 可达 6KB+（ws/client.go:94-96）。

**Hub**（ws/hub.go）：
- `Clients map[userID]map[*Client]struct{}`——**多端在线**，连接集合空了才算离线。
- 单 goroutine `Run()` 串行处理 Register/Unregister/Broadcast/RedisPush 四个 channel——**Clients map 只被 Hub goroutine 读写，零锁**。
- **safeSend 背压**（hub.go:49-56）：客户端发送缓冲（256）满 = 慢消费者，直接断连，绝不阻塞 Hub 主循环。
- 跨实例：Broadcast 分支 `deliverLocal`（本实例投递）+ `publishCrossNode`（Redis Pub/Sub，channel `im:ws:push`）；订阅 goroutine 收到后按 `GatewayID` 跳过自己发的，转投 `RedisPush` channel 回到 Hub 主循环串行投递（hub.go:177-211）——**多副本水平扩展的关键**。

**通话状态机**（ws/calls.go）：
- 服务端注册表 `activeCalls` + `userActiveCall`（mutex 保护），**busy 判定收归服务端**不信任客户端（calls.go:33-42）。
- **断线即收线**：连接断开 → `EndCallsForUser` 终结该用户全部通话并向对方广播 `call_ended`（calls.go:87-115）——页面刷新/断网不留僵尸振铃。
- 信令转发：`handleCallEvent` 的 `kind=signal` 原样中继 SDP/ICE 给对方；accept/reject/hangup 广播含自己（多端同步收线）。

**挖掘点**：
- 为什么 Hub 单 goroutine 还能扛并发？答：内存操作微秒级，瓶颈在外部 I/O——**主动承认现状的瓶颈**：循环内有 Redis/Mongo 调用（SetOnline/SetOffline/UpdateByID/publishCrossNode），高并发下串行排队，改进方案是 I/O 异步化出循环（详见 §5）。
- 为什么订阅消息要转投 channel 而不直接写 client.Send？答：保住"map 单 goroutine 访问"的无锁模型 + 保证投递顺序。
- 多端在线 vs 顶号：代码注释里有"顶号"残留（client.go Close 的 "logged in elsewhere"），实际是多端并存——演进史要能自洽讲。
- WS 鉴权 query 传 token 的风险？答：会进访问日志，子协议是主方案，query 只是兜底。

### 3.5 消息发送链路（ws/chat.go SendChatMessage）——必考

**WS 和 HTTP 双通道收敛到同一个函数**（handler/messages.go:24-50 复用），流水线九步：

1. 会话存在性 + 成员校验（FindOne Conversations）
2. **幂等去重**：客户端生成 `client_msg_id`（UUID），`SETNX im:msg:dedup:{id}` TTL 24h，重复消息 return nil 视为成功（cache/message.go:12-14）——「至少一次投递 + 接收端幂等」组合
3. Mongo `InsertOne` 落库
4. `$set` 会话 `last_message` 摘要（**读优化反范式**，会话列表免回表）
5. 逐成员失效会话列表缓存 `im:convo:{userID}`
6. 逐成员 `IsOnline` 判定：在线走第 8 步广播，离线 `RPUSH im:offline:{userID}`（每条完整消息 JSON，7 天滑动 TTL）
7. `hub.Broadcast <-`（本地投递 + 跨实例 Pub/Sub）
8. 异步归档：`archive.Message()` → `go ingest` POST 到 RAG `/api/chat-archive/ingest`
9. 失败语义：WS 通路静默，HTTP 通路返回错误

**挖掘点（重灾区，逐个准备）**：
- 去重标记在落库**之前**打 → 落库失败后 24h 内重试会被误吞（at-most-once 窗口）。改进：落库成功后打标记 + DB 层 (sender_id, client_msg_id) unique 索引兜底。
- 去重 key 未绑定 sender_id → 不同用户撞 ID 互吞。改进：key 加 sender 前缀。
- Redis 故障时 `first, _` 忽略错误 → 去重失效但**业务不阻塞**——可用性优先于一致性的取舍，要主动讲。
- 每条消息串行 4~10 次 RTT；群聊成员循环 2N 次 Redis 调用 → pipeline 批量化（§5）。
- `IsOnline` 判定与断线的 TOCTOU 竞态：判定后瞬间断线 → 实时推和离线队列都错过 → 前端拉历史兜底，或改为双写。

### 3.6 会话与历史消息（handler/conversation.go）

**机制**：
- 会话列表：**Cache-Aside**，`im:convo:{userID}` 缓存整份 JSON（TTL 5 分钟 + 写路径主动 DEL 双保险），**命中时 `c.Data` 原样回写零反序列化**（conversation.go:25-28）。
- 建私聊：`{type:private, members:{$all:[A,B]}}` 查重，已存在直接返回旧会话（幂等）。
- 历史消息：`{conversation_id, created_at:-1}` 复合索引 + **skip-limit 分页**（固定 limit 50）。先成员校验防越权。
- 撤回：软删除（type=recalled），仅发送者本人 + 2 分钟窗口（conversation.go:139-190），WS 广播 `message_recalled`。

**挖掘点**：
- 为什么私聊去重不能用 unique 索引？答：数组 `$all` 无序，[A,B] 和 [B,A] 是不同数组，unique 约束做不了，只能应用层查重。
- skip-limit 深翻页退化 + 新消息导致页内偏移 → 改进：`before_id` 游标（ObjectID 自带时间序）。
- last_message 冗余与消息落库是两条命令非事务 → 不一致窗口，答：可上 Mongo 事务（需副本集）或容忍（列表页最终一致可接受）。

### 3.7 好友与群组（handler/friend.go / group.go）

**机制**：
- 好友申请：禁止加自己 → 已是好友 → **双向 pending 查重**（$or 正反方向）→ WS 定向推送 `friend_request`。
- 接受：**插入两条镜像 Friend 记录**（A→B、B→A）+ 状态改 accepted；删除好友 `DeleteMany $or` 双向一起删。
- 群：创建者自动 owner，MaxMembers 500；**同时创建 type=group 的 Conversation**（GroupID 指针关联）；加人/退群 `$push/$pull` 同时改 group.members 和 conversation.members 两处。

**挖掘点**：accept 的两次 Insert + 一次 Update **无事务**，中途失败出单向好友——答：Mongo 4.0+ 多文档事务（副本集前提）或状态机+幂等重试。GetFriends/GetGroupMembers 是 N+1 逐条 FindOne → `$lookup` 聚合优化。MaxMembers 只赋值从未校验（group.go:47）——能自己发现自己代码边界是加分项。

### 3.8 文件上传与 HDFS 分层存储（handler/upload.go / storage/hdfs.go）

**机制**：
- `http.MaxBytesReader` 限 512MB；扩展名白名单 14 种。
- 文件名 = `UnixNano + ext`（不含用户输入，防路径注入）。
- **先写 `tmp-` 文件再 `os.Rename`**：同盘 rename 原子，避免半写文件被读到（upload.go:65-98）。
- **10MB 分界**：≥10MB 且配置了 HDFS → WebHDFS 转存后删本地 tmp，URL `/hdfs-files/<name>`；否则 rename 进 uploads，URL `/uploads/<name>`。
- WebHDFS 客户端**纯 REST 不依赖 JVM**：手动接管 307 重定向（`CheckRedirect: ErrUseLastResponse`），实现 **CREATE 两段式协议**（首跳 NameNode 空 body PUT → 307 Location=DataNode → 二跳传流）。实战坑：空 reader 触发 Content-Length，否则 Jetty 对无长度 PUT 返回 405（hdfs.go:74-77）。
- 下载：文件名白名单正则 `^[0-9]+\.[a-z0-9]{1,8}$` 防目录穿越，`io.Copy` 流式转发不占内存。
- HDFS 共享存储 → **任意 server 实例都能服务大文件**，支撑多副本。

**挖掘点**：为什么 10MB 分界？答：HDFS 不适合小文件（每文件占 NameNode 约 150B 内存记录 + Block 保留），小文件本地、大文件解锁共享与容量扩展。为什么先落 tmp 不流式直传？答：第二跳需要已知 ContentLength + 校验先行；代价是双倍磁盘 IO。没有秒传/去重/分片 → 改进话术：客户端 MD5 + 服务端查重 + 引用计数。

### 3.9 AI/RAG 子系统（handler/ai.go / archive/ / scheduler/ / rag/）

**Go 代理层**（handler/ai.go）：
- 定位：JWT 在代理层终结，RAG 无需理解业务鉴权；`RAG_BASE_URL`（compose 里 `http://rag:8000`）。
- **SSE 流式透传**：识别上游 `Content-Type: text/event-stream` → 4KB 逐块 Read+Flush，设 `X-Accel-Buffering: no`（ai.go:139-161）——**这个响应头动态关闭 nginx 的 proxy_buffering**，否则前端看不到流式输出。全链路无缓冲是本项目最漂亮的细节之一。
- **身份注入**：反序列化 body 后**强制覆盖 `owner_id` 为 JWT 用户**（ai.go:90）——客户端伪造 owner_id 无效，多租户隔离在代理层闭环。
- multipart 透传要**重建表单**（Go 的 multipart 不可变），文件进内存 buffer——局限要能讲。

**聊天归档**（archive/）：
- 消息落库后异步单条归档（`go ingest`）；`BuildRecords` 一条消息为每个接收者生成一条"我收到的消息"（**排除发送者**）——检索语义是"谁给我发过 X"。
- 文本截 200 字、文件消息记 file_name 作检索锚点、跳过 system/recalled。
- Backfill 同步回填存量，200 条一批。
- **归档到 RAG 自有存储**（非 Mongo），Record 带 message_id/conversation_id → 检索命中可**回链原会话**。

**Agentic RAG**（证据推断自前端与契约，源码在服务器）：
- 不是固定"召回→重排→生成"，是 **ReAct 风格 Agent**：LLM 按问题自主选工具——`search_chat_archive`（记忆型问题）、`search_knowledge_base`（文档）、`get_weather`、`mcp__fx__exchange_rate`（外部 MCP）。
- SSE 事件序列：`citations`（doc/chat 两类，chat 命中带 message_id 可跳回原会话）→ `delta`* → `done`/`error`。
- 点赞进热缓存，同问秒回；`/api/mcp` 让 RAG 自身也是 MCP server，外部 Agent 可复用小Q 工具。
- embedding 本地推理（`/root/.cache` 模型缓存卷），LLM 走 DashScope 兼容 API。

**每日早报**（scheduler/scheduler.go）：
- 裸 goroutine + 每分钟 `time.Sleep` 轮询，`Hour()==AI_PUSH_HOUR(默认9)` + `lastRun` 日期串当日去重。
- 每用户：统计 24h 收到的消息（内存遍历 ReadBy 算未读）→ 拼 60 字/条上下文 → POST `/api/digest` 让 LLM 摘要（120s 超时，失败静默降级原始文本）→ WS `ai_push` 定向推送。
- 手动触发口 `POST /api/ai/push/trigger` 供演示。

**挖掘点**：为什么 SSE 不是 WebSocket？答：单向流、HTTP 兼容、代理友好、自动重连。归档是 fire-and-forget = at-most-once，RAG 宕机期间消息丢失只能 backfill 补 → 改进：Outbox 表/本地队列 + 重试。scheduler 的 lastRun 在进程内存 → **多实例会重复推送**，答：Redis SETNX 分布式锁。为什么归档视角是接收者？答：检索需求是"别人发给过我的东西"，自己发的自己有记忆。

### 3.10 数据模型与索引（model/）

**集合与关系**：User —(members[])— Conversation —1:N— Message；Conversation.group_id → Group；FriendRequest →(accept)→ 两条镜像 Friend；Message.ReadBy[] → User。

**索引清单**（model/db.go:47-69）：
| 集合 | 索引 | 用途 |
|---|---|---|
| users | username unique | 登录 + 查重 |
| conversations | members | "我参与的会话"（多键索引） |
| conversations | updated_at:-1 | 会话列表排序 |
| conversations | group_id | 群会话反查 |
| messages | (conversation_id, created_at:-1) 复合 | 会话内按时间分页 |
| friend_requests | (from,to) unique | 防重复申请 |
| friends | (user_id,friend_id) unique | 好友防重 |

**设计点**：Conversation 内嵌 LastMessage 冗余摘要（读优化）；Group.Members 内嵌文档（反范式，注意 16MB 文档上限所以上限 500）；撤回是软删除；UserPublic DTO 脱敏。

**挖掘点**：members 多键索引的基数代价（每个会话文档在索引出现 N 次）；ReadBy 数组在群聊无限增长；为什么单独存 created_at 不依赖 ObjectID 时间戳（时钟回拨/排序语义显式化）。

### 3.11 Redis 使用全景（cache/）——面试一句话总结："Redis 的七种用法"

| 用途 | Key | 结构 | TTL | 机制 |
|---|---|---|---|---|
| 在线状态 | im:online:{uid} | String=gatewayID | 70s | pong 续期；70s>54s 心跳是异常断连兜底 |
| 离线队列 | im:offline:{uid} | List | 7天滑动 | RPush 保序；上线 LRANGE+DEL 全取 |
| 消息幂等 | im:msg:dedup:{cmid} | String | 24h | SETNX 原子 |
| 会话列表缓存 | im:convo:{uid} | String(JSON) | 5min | Cache-Aside + 写路径 DEL |
| 验证码 | im:verify:{email} | String | 5min | 成功才删，一次性 |
| 发送频控 | im:verify:limit:{email} | String | 1min | SETNX 固定窗口 |
| 跨实例推送 | im:ws:push | Pub/Sub | - | GatewayID 去重 |

**挖掘点**：
- 在线状态为什么 per-user key 不用 Bitmap？答：TTL 自动过期是刚需，bitmap 没有过期语义，判离线要自己扫。
- EXPIRE 对已过期 key 不重建 → GC 停顿超 16s 时"连接活着但 Redis 判离线"的边界，答：改用 SET 覆盖写。
- LRANGE+DEL 非原子的丢消息窗口 → 循环 LPOP / RPOPLPUSH 可靠队列 / Lua / Redis Stream 消费者组。
- Pub/Sub 不持久化 → 订阅断线期间消息丢；聊天消息有离线队列兜底、信令可丢——**说清"哪类消息可丢"是亮点**。
- 未读数：`im:unread:` key 定义了但未使用，未读靠前端 last_message/read_by 算——别说成已实现。

### 3.12 部署与 DevOps（docker-compose / Dockerfile / nginx.conf）

**compose 7 服务**：mongo、redis（`--appendonly no` 纯缓存定位）、hdfs-nn + hdfs-dn（挂 xml 覆盖配置，镜像 envtoconf 有 bug 的踩坑）、mcp-fx、rag（rag-data/rag-models 卷）、server（network:host 构建，`RAG_BASE_URL=http://rag:8000`）、web（nginx，80/443 对外）。

**server/Dockerfile 多阶段**：`golang:alpine` + `CGO_ENABLED=0` 静态编译 + `GOPROXY=goproxy.cn` + **先 COPY go.mod/go.sum 再 download（层缓存）** + `-trimpath -ldflags="-s -w"`；运行层 alpine 只装 ca-certificates + tzdata（TZ=Asia/Shanghai，定时任务时区前提）。

**nginx 三大细节（主动抛，非常能打）**：
1. **Docker 内嵌 DNS 动态解析**：`resolver 127.0.0.11 valid=10s; set $backend "server:8080"`——proxy_pass 用变量才会运行时重新解析，直写域名会缓存旧 IP，server 容器重建换 IP 即 502。
2. **WS 代理**：`proxy_http_version 1.1` + Upgrade/Connection 头 + read/send timeout 86400s（否则默认 60s 掐断长连接）。
3. **SSE 无缓冲**：依赖 Go 侧 `X-Accel-Buffering: no` 动态关 proxy_buffering。

HTTPS 在 nginx 终结（自签证书，动机：WebRTC getUserMedia 要求安全上下文）；容器内全明文（内网，见第一轮讨论的结论）。

**挖掘点**：`-s -w`/`-trimpath` 各去掉什么（symbol/dwarf 表、构建路径）；CGO_ENABLED=0 为什么能跨机构建（纯静态无 libc 依赖，规避 alpine musl 坑）；server 的 depends_on 不含 rag——**RAG 挂了不影响 IM 主链路**，好设计要主动讲。

---

## 四、高并发：现状与演进（对应面试"能扛多少量级"）

**现状支撑点**：goroutine 每连接 2 个（几万连接无压力）；safeSend 背压；Redis Pub/Sub 多实例水平扩展路径已通；会话列表缓存；离线队列削峰。

**瓶颈排序**：
1. Hub 循环内阻塞 I/O（SetOnline/SetOffline/UpdateByID/publishCrossNode）——全局串行天花板，每秒几百~几千事件
2. SendChatMessage 串行 4~10 RTT，群聊 2N Redis 调用
3. 已读回执每条一次 Mongo 写
4. Backfill 全量加载无 Limit

**改进方案（已规划）**：P0 Hub I/O 异步化出循环（发布走专用 goroutine 保序）；P1 成员循环 pipeline 化 + 会话成员缓存 + archive 有界 channel worker；P1.5 已读前端 debounce + 服务端异步写；P2 Backfill 补 Limit + Mongo 池显式化；验证靠 WS 压测（p99 延迟、Broadcast channel 水位、Mongo opcount）。做完 P0+P1 单实例可到万级事件/秒，然后瓶颈正确地转移到 Mongo。

---

## 五、面试挖掘点快速复习表

| 模块 | 一句话考点 | 推荐答法锚点 |
|---|---|---|
| WS 鉴权 | 浏览器 WS 不能带头 | 子协议传 token，query 兜底 |
| Hub 并发模型 | 为什么无锁 | map 只被 Hub goroutine 碰，跨实例消息回投 channel 串行化 |
| 消息不丢不重 | QoS 语义 | 至少一次投递 + client_msg_id SETNX 幂等；坦承标记先于落库的窗口 |
| 离线消息 | 可靠性 | RPUSH + 上线全取；LRANGE+DEL 非原子是改进点 |
| 在线状态 | TTL 设计 | 70s > 54s 心跳，异常断连兜底过期 |
| 通话收线 | 僵尸振铃 | 断线即 EndCallsForUser，服务端 busy 判定 |
| WebRTC | WS 的角色 | 只走信令，媒体 P2P 不占服务器带宽；只配 STUN 无 TURN 的边界 |
| 缓存一致性 | 删还是更 | Cache-Aside 删缓存：简单、避免并发写覆盖；5min TTL 兜底 |
| SSE | 全链路无缓冲 | Flusher + X-Accel-Buffering: no 动态关 nginx 缓冲 |
| HDFS | 为什么两段式 | WebHDFS 307 重定向协议 + Jetty 空 Content-Length 405 坑 |
| 多实例 | 怎么扩 | 无状态网关 + Redis 在线表 + Pub/Sub；scheduler/lastRun 是单实例残留 |
| 事务 | 多文档写 | 好友镜像/群会话双写无事务 → Mongo 事务需副本集，或幂等重试 |

---

## 六、主动坦白清单（缺陷 → 改进方案，面试加分项）

1. **LRANGE+DEL 非原子**（离线队列丢消息窗口）→ 循环 LPOP / 可靠队列模式 / Redis Stream
2. **幂等标记先于落库** + **去重 key 未绑 sender** → 落库后打标记 + DB unique 索引兜底 + key 加 sender
3. **验证码 UnixNano 取模可预测 + 无试错限制** → crypto/rand + 失败 N 次销毁
4. **JWT 7 天无 refresh/黑名单** → refresh token 或 Redis jti 黑名单
5. **上传仅扩展名校验**（无 magic number）→ http.DetectContentType 嗅探
6. **skip-limit 深分页** → before_id 游标
7. **N+1 查询 4 处**（好友列表/群成员/admin 列表/scheduler）→ $lookup 聚合
8. **好友/群双写无事务** → Mongo 事务或状态机幂等
9. **scheduler 无分布式锁**，多实例重复推送 → SETNX 锁
10. **repository/service 空目录** → 话术：预留分层骨架，业务量下 handler→model 直调；`SendChatMessage` 就是天然的 service 函数（已被 WS/HTTP 双通道复用），引入 service 层时第一个下沉的就是它
11. **archive 回填注释说 2000 条但查询没 Limit** → 注释与实现不符 + 内存风险，一行 SetLimit 修复
12. **正则搜索无分页无索引**（SearchMessages）→ 限制结果集 + 文本索引
13. **仓库里明文密钥**（部署脚本 SSH 密码、compose 内 JWT_SECRET/API key/SMTP 授权码）→ **面试/开源前必须轮换并移出版本库**，改 .env + secrets 管理

---

## 七、30 秒电梯陈述（背下来）

> 这是一个 Gin + MongoDB + Redis 的全栈 IM 系统。实时层用 gorilla/websocket 的 Hub 模式，每连接两个 goroutine，Hub 单 goroutine 串行访问连接表实现无锁，配背压保护防慢消费者；多实例部署靠 Redis 存在线状态、Pub/Sub 跨实例广播。消息链路做了"至少一次投递 + client_msg_id 幂等去重"、离线队列、会话摘要冗余和 Cache-Aside 列表缓存。音视频是 WebRTC P2P，WS 只走信令，服务端维护通话状态机、断线即收线。文件做了本地 + HDFS 分层存储，WebHDFS 客户端是纯 REST 手写两段式 CREATE 协议。另有一个 Agentic RAG 子系统：Go 层代理注入 owner_id 做多租户隔离，SSE 全链路无缓冲透传，聊天记录异步归档支撑"谁给我发过什么"的记忆检索，LLM 自主选择检索工具，还通过 MCP 接入了外部工具。部署是 docker-compose 七服务，nginx 终结 HTTPS 并处理 WS 升级和 SSE 透传。
