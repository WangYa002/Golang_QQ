# Golang QQ — 架构重构方案（MongoDB + Redis 定稿）

> 目标：把当前「Gin + WebSocket + MongoDB」单体，重构为「分层 + MongoDB + Redis」的生产级 IM 架构。
> 定稿决策：**持久化保留 MongoDB（零迁移），新增 Redis 做缓存/状态层；暂不引入 MySQL/Kafka。**
> 参考开源项目：[OpenIM](https://github.com/openimsdk/open-im-server)、[goim](https://github.com/Terry-Mao/goim)、[KamaChat](https://github.com/qianguangguang/KamaChat)、[Kafumio/gochat](https://github.com/Kafumio/gochat)。
> 日期：2026-08-28

---

## 〇、为什么选 MongoDB + Redis（而不是 MySQL + GORM）

> 关键：**MySQL/GORM 与 MongoDB 是持久化主库的取舍；Redis 是缓存/状态层，两者方案都必需。**

### 0.1 对比结论速览

| 维度 | MySQL + GORM | MongoDB + Redis | 本项目倾向 |
|---|---|---|---|
| 文档型数据（消息/会话含数组、嵌套） | 拆表 + join | 单文档直接存 | **MongoDB** ✅ |
| 强关系 + 复杂报表 | SQL 主场 | 聚合管道晦涩 | MySQL 略优（但当前用不上） |
| 海量消息横向扩展 | 分库分表（工程量大） | sharding 省心 | **MongoDB** ✅ |
| 数据迁移成本 | 需全量迁移 + 重测 | **零迁移** | **MongoDB** ✅ |
| 在线状态/验证码/幂等/缓存 | Redis | Redis | 两者都要 Redis |

### 0.2 详细分析

**① 数据模型贴合度 —— MongoDB 占优**

IM 核心实体天然是文档：消息含 `metadata`（文件名/大小/宽高）、`read_by` 数组；会话含 `members` 数组、嵌套 `last_message`。MongoDB 一个文档直接读写；MySQL 要拆 `message_read`、`conversation_member` 表，读一条消息 join 2~3 张表。

**② 强关联查询 + 事务 —— MySQL 占优**

好友/群成员多对多、后台复杂统计报表（"某群近 30 天活跃 TOP10"）是 SQL 主场。但本项目后台当前只是「分页 + 关键字搜索」，MongoDB 完全够。

**③ 读多写多高频性能 —— 看扩展方式**

IM 写多读多。MongoDB 单文档写入快、sharding 成熟；MySQL 需分库分表 + 中间件，工程量大。

**④ 开发效率与迁移成本 —— MongoDB 占优（本项目决定性因素）**

现有数据已在 MongoDB，选 MongoDB 是**零迁移**；换 MySQL 要重写全部 model + 数据迁移脚本 + 重测所有 API，收益却不明显。

### 0.3 一句话结论

> **IM 的消息/会话是"文档"，该用 MongoDB；关系和报表是"表"，该用 MySQL；热数据和状态永远该用 Redis。**
> 本项目核心在文档型数据和实时性，且已有 MongoDB 数据，所以 **MongoDB + Redis 更合适**；
> MySQL + GORM 不是错，只是对当前场景"杀鸡用牛刀"还要承担迁移成本。

---

## 一、现状与目标

### 1.1 现状（已确认）

| 维度 | 现状 |
|---|---|
| 分层 | `handler` 直接操作 `model`，`service/`、`repository/` 为空目录 |
| 存储 | MongoDB 单库，无缓存 |
| 日志 | 标准库 `log`，无结构化、无分级 |
| 登录 | 用户名 + 密码（bcrypt），无验证码 |
| 在线状态 | 仅进程内 `ws.Hub` 内存表，重启即失、无法横向扩展 |
| 消息投递 | Hub 同步广播，无削峰、无离线缓冲、无幂等 |

### 1.2 目标架构

```
┌────────────────────────────────────────────────────────────┐
│                       浏览器 React SPA                      │
└───────────────┬────────────────────────────┬───────────────┘
        HTTP /api/*  (JWT)          WS /ws?token=...  (长连接)
                ▼                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      Gateway 接入层（Gin）                    │
│   · JWT 鉴权 · WS 升级/心跳 · 信令转发                        │
└───────────────────────┬─────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                       Service 逻辑层                          │
│   auth / user / friend / group / conversation / message       │
└───────────────┬──────────────────────────────┬──────────────┘
                ▼                              ▼
      ┌──────────────────┐          ┌──────────────────────┐
      │ Repository (GORM) │          │   Cache (go-redis)    │
      │  MongoDB 数据访问  │          │ 在线/验证码/幂等/缓存  │
      └─────────┬────────┘          └──────────┬───────────┘
                ▼                              ▼
        ┌──────────────┐             ┌──────────────────┐
        │    MongoDB    │             │      Redis       │
        │  (持久化事实)  │             │  (热数据/状态)    │
        └──────────────┘             └──────────────────┘
```

---

## 二、技术栈定稿

| 维度 | 当前 | 目标 | 说明 |
|---|---|---|---|
| HTTP | Gin | Gin（保留） | 无迁移成本 |
| WebSocket | gorilla/websocket | gorilla/websocket（保留） | 抽到 gateway 层 |
| 持久化 | MongoDB | **MongoDB（保留）** | 零数据迁移 |
| 缓存/状态 | 无 | **go-redis/v9** | 在线状态、验证码、幂等、离线缓冲、热缓存 |
| 日志 | 标准库 log | go.uber.org/zap（可选） | 结构化分级 |
| 鉴权 | JWT | JWT（保留）+ 邮箱验证码登录 | 登录改为 QQ 邮箱验证码 |

> 暂缓：MySQL/GORM、Kafka。理由见 §0；Kafka 等到「多副本 Gateway + 海量消息 + 需可靠重投」时再引入，且无需推翻现有底座。

---

## 三、新目录结构

```
server/
├── main.go                      # 入口：配置 → MongoDB → Redis → Hub → Gin
├── config/
│   └── config.go                # 增加 Redis 配置
├── router/
├── middleware/
├── handler/                     # 参数绑定/校验 → 调 service → 响应
├── service/                     # 业务逻辑层（当前为空，需实现）
├── repository/                  # MongoDB 数据访问层（当前为空，可选实现）
├── model/                       # MongoDB 集合 + 数据结构（保留）
├── cache/                       # Redis 封装（新增）
│   ├── redis.go                 # 连接 + 键前缀
│   ├── online.go                # 在线状态
│   ├── verify_code.go           # 验证码
│   └── message.go               # 幂等/离线消息
├── ws/                          # 保留，改为依赖 cache 在线状态
└── pkg/
    ├── email/                   # QQ 邮箱 SMTP 验证码发送（新增）
    └── logger/                  # zap（可选）
```

---

## 四、Redis 设计（go-redis）

| 键 | 类型 | TTL | 说明 |
|---|---|---|---|
| `im:online:{userID}` | string | 70s（心跳续期） | 在线状态（替代 Hub map，支持多副本） |
| `im:verify:{email}` | string | 5min | 邮箱验证码 |
| `im:verify:limit:{email}` | string | 1min | 发送频率限制 |
| `im:msg:dedup:{msgID}` | string | 24h | 消息幂等去重 |
| `im:offline:{userID}` | list | 7d | 离线消息缓冲 |
| `im:convo:{userID}` | zset | 无 | 会话列表缓存（score=updated_at） |
| `im:unread:{userID}:{convoID}` | string | 无 | 未读计数 |

---

## 五、在线状态改造（第一步，最痛）

**现状**：`ws/hub.go` 用进程内 `Clients map[ObjectID]*Client` 表示在线，服务重启丢失、多副本不可见。

**改造**：
- 连接建立 → `SET im:online:{userID} = gatewayID EX 70`，心跳续期。
- 连接断开 → `DEL`（或等 TTL 过期）。
- 推送前 `EXISTS im:online:{userID}` 判断在线，替代 `Hub.IsOnline`。
- 单点登录：新连接注册时若 `im:online:{userID}` 已存在 → 踢旧连接（复用现有顶号逻辑）。

**收益**：跨实例共享在线视图、天然支持横向扩展、重启不丢在线态。

---

## 六、验证码登录（QQ 邮箱，替换 SMS）

**流程**：
1. `POST /api/auth/send-code {email}` → 校验格式 → 生成 6 位码 → Redis 存 5min → SMTP 发送 → 60s 限流。
2. `POST /api/auth/login {email, code}` → 校验 Redis 验证码 → 签发 JWT。
3. 注册兼容：`{email, code, nickname}`。

**dev 旁路**（当前无法真实收邮件时）：
```
AUTH_MODE=dev    # 固定验证码 123456，不真实发邮件，返回 debug_code
AUTH_MODE=prod   # 走真实 SMTP
```

---

## 七、分阶段实施

| 阶段 | 内容 | 产出 |
|---|---|---|
| **P0 环境** | 安装/启动 Redis，引入 go-redis，配置 | Redis 可连、依赖就绪 |
| **P1 在线状态** | 在线状态迁到 Redis（心跳/踢下线/推送判断） | 跨实例在线视图 |
| **P2 验证码登录** | SMTP 验证码 + Redis 存码 + dev 旁路 | QQ 邮箱验证码登录 |
| **P3 缓存+离线+幂等** | 会话热缓存、离线消息缓冲、消息幂等去重 | 读提速 + 离线不丢 + 防重复 |
| **P4 打磨** | 分层重构（service/repository）、文档 | 架构清晰 |

**建议顺序**：P0 → P1 → P2 → P3 → P4。

---

## 八、风险与兼容

| 风险 | 应对 |
|---|---|
| Redis 不可用导致功能退化 | 在线状态/验证码失败时降级（在线状态回退 Hub map 或标记未知） |
| 邮箱 SMTP 认证失败 | `AUTH_MODE=dev` 旁路 + 明确错误码 |
| 前端契约变化 | 保持 REST/WS 协议不变，仅后端内部改造，前端最小改动 |
| 在线状态 TTL 误判 | 心跳续期 + 合理 TTL（70s，心跳 30s 发一次） |
