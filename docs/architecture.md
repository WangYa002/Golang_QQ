# Golang QQ — 架构文档

> 项目路径：`D:/Golang/Golang_QQ`
> 文档日期：2026-06-18
> 范围：项目整体架构（前端 React + 后端 Go + 前后端契约）
> 配套文档：`frontend-redesign-plan.md`（前端 UI 改造计划书）

---

## 一、项目总览

一个仿 QQ 的即时通讯系统。后端用 Go（Gin + WebSocket + MongoDB），前端用 React + TypeScript + Vite + Tailwind v4。支持单聊、群聊、好友、消息撤回、多账号切换、在线状态、输入指示等 IM 核心能力。

```
┌──────────────────────────────────────────────────────────────┐
│                    浏览器（React SPA）                       │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ Sidebar  │→ │ Conversation │→ │      ChatArea          │  │
│  │ (64px)   │  │ List (300px) │  │  (flex-1, 主聊天区)    │  │
│  └──────────┘  └──────────────┘  └────────────────────────┘  │
│        ↕ HTTP /api/*              ↕ WS /ws?token=...          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Go 后端（Gin :8080）                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ middleware  │→ │   handler    │→ │   model (MongoDB)   │  │
│  │ CORS + JWT  │  │  (auth/user/ │  │  users/convos/groups│  │
│  │             │  │   convo/...) │  │  messages/friends   │  │
│  └─────────────┘  └──────┬───────┘  └─────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│                  ┌───────────────┐                           │
│                  │  ws.Hub       │  (单例 GlobalHub)         │
│                  │  ↕ Client     │                           │
│                  └───────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

**启动方式**：`start.bat` 同时拉起 Go 后端（`server/main.go`）和 Vite 开发服务器；生产构建后前端嵌入到 `server/static/`，由 Gin 直接 serve。

---

## 二、后端 Go 架构

### 2.1 技术栈

| 维度 | 选型 |
|---|---|
| HTTP 框架 | `github.com/gin-gonic/gin` |
| WebSocket | `github.com/gorilla/websocket` |
| 数据库 | MongoDB（官方 `go.mongodb.org/mongo-driver`，无 ORM） |
| 鉴权 | JWT（`github.com/golang-jwt/jwt/v5`） |
| 配置 | `godotenv` + 自实现 `config.Load()` |

### 2.2 目录与分层

```
server/
├── main.go              # 入口：加载配置 → 连 DB → 起 Hub → 起 Gin
├── config/              # 配置加载（环境变量）
├── router/router.go     # 路由注册（68 行，全部 Gin route 集中在此）
├── middleware/
│   ├── auth.go          # JWT 校验中间件（63 行）
│   └── cors.go          # CORS（18 行）
├── handler/             # HTTP + WS 入口（业务也写在这里）
│   ├── auth.go          # 注册/登录
│   ├── user.go          # 用户资料、搜索
│   ├── conversation.go  # 会话、消息、撤回、搜索
│   ├── friend.go        # 好友申请、列表、备注
│   ├── group.go         # 群 CRUD、成员管理
│   ├── upload.go        # 文件上传
│   └── ws.go            # WebSocket 升级入口
├── model/               # MongoDB 集合定义 + 数据结构
│   ├── db.go            # 连接 + 索引创建（69 行）
│   ├── user.go
│   ├── conversation.go
│   ├── message.go
│   ├── group.go
│   └── friend.go
├── ws/
│   ├── hub.go           # Hub（中央广播器，62 行）
│   └── client.go        # Client（每连接一个，ReadPump/WritePump）
├── service/             # 空目录（未实现，逻辑全在 handler）
├── repository/          # 空目录（未实现，model 直接暴露 Collection）
└── golang-qq.exe        # 构建产物
```

> ⚠ **架构缺陷**：`service/` 和 `repository/` 是空目录。所有业务逻辑直接写在 handler 里，handler 直接调 `model.Users.FindOne(...)`。这种"扁平"结构短期可读，但 handler 文件会越长越乱（`friend.go` 已 288 行，`group.go` 已 292 行）。后续应抽出 service 层。

### 2.3 启动流程（`main.go:14-29`）

```go
config.Load()          // 1. 加载 .env / 环境变量
model.ConnectDB()      // 2. 连 MongoDB + 建索引
hub := ws.NewHub()     // 3. 创建 WS Hub
ws.GlobalHub = hub     //    注册为全局单例
go hub.Run()           // 4. Hub 进入 select 循环（监听 Register/Unregister/Broadcast）
r := gin.Default()
router.Setup(r)        // 5. 注册路由
r.Run(":" + port)      // 6. 启动 HTTP
```

### 2.4 路由清单（`router/router.go`）

| Method | Path | Handler | 鉴权 |
|---|---|---|---|
| GET | `/ws` | `HandleWebSocket` | token via query |
| POST | `/api/auth/register` | `Register` | ❌ |
| POST | `/api/auth/login` | `Login` | ❌ |
| GET | `/api/users/me` | `GetMe` | ✅ |
| PUT | `/api/users/me` | `UpdateMe` | ✅ |
| GET | `/api/users/search?q=` | `SearchUsers` | ✅ |
| GET | `/api/users/:id` | `GetUser` | ✅ |
| GET | `/api/conversations` | `GetConversations` | ✅ |
| POST | `/api/conversations` | `CreateConversation` | ✅ |
| GET | `/api/conversations/:id/messages` | `GetMessages` | ✅ |
| DELETE | `/api/conversations/:id/messages/:mid` | `RecallMessage` | ✅ |
| GET | `/api/conversations/:id/messages/search?q=` | `SearchMessages` | ✅ |
| POST | `/api/groups` | `CreateGroup` | ✅ |
| GET/PUT | `/api/groups/:id` | `GetGroup` / `UpdateGroup` | ✅ |
| GET | `/api/groups/:id/members` | `GetGroupMembers` | ✅ |
| POST | `/api/groups/:id/members` | `AddGroupMember` | ✅ |
| DELETE | `/api/groups/:id/members/:uid` | `RemoveGroupMember` | ✅ |
| POST | `/api/friends/request` | `SendFriendRequest` | ✅ |
| GET | `/api/friends/requests` | `GetFriendRequests` | ✅ |
| PUT | `/api/friends/requests/:id` | `HandleFriendRequest` | ✅ |
| GET | `/api/friends` | `GetFriends` | ✅ |
| DELETE | `/api/friends/:id` | `DeleteFriend` | ✅ |
| PUT | `/api/friends/:id/remark` | `UpdateFriendRemark` | ✅ |
| POST | `/api/upload` | `UploadFile` | ✅ |
| GET | `/uploads/*` | gin.Static | ❌ |

### 2.5 WebSocket 协议

**连接**：`GET /ws?token=<JWT>` → gorilla/ws 升级 → Hub 注册 Client。

**Hub 模型**（`ws/hub.go`）：
- 单进程内 `GlobalHub` 是单例；`Clients map[ObjectID]*Client` 维护在线用户。
- 三个 channel：`Register` / `Unregister` / `Broadcast`（buffer 256）。
- `Broadcast(TargetIDs []ObjectID)`：空切片 = 广播全员；非空 = 定向投递。

**Client 心跳参数**（`ws/client.go:48-53`）：
- `writeWait = 10s`、`pongWait = 60s`、`pingPeriod = 54s`、`maxMessageSize = 4096`

**客户端 → 服务端** 事件：

| `type` | `data` 字段 | 处理 |
|---|---|---|
| `chat` | `{conversation_id, type, content, metadata?}` | 持久化消息 → 广播 `new_message` 给会话成员 |
| `typing` | `{conversation_id}` | 广播 `typing` 给会话成员 |
| `read` | `{conversation_id, message_id}` | 更新 `read_by` |
| `message_recall` | `{conversation_id, message_id}` | 标记撤回 → 广播 `message_recalled` |
| `heartbeat` | `{}` | 立即回 `heartbeat` |
| `call` | `{conversation_id, call_type}` | 发起通话 → 向其他成员广播 `call_incoming` |
| `call_event` | `{conversation_id, call_id, kind, reason?, signal?}` | kind=`accept/reject/hangup/signal` → 分别广播 `call_accepted/call_rejected/call_ended/call_signal` |

**服务端 → 客户端** 事件：

| `type` | `data` | 前端处理 |
|---|---|---|
| `new_message` | `Message` | `chatStore.addMessage` |
| `typing` | `{conversation_id, user_id}` | `chatStore.setTyping`（3s 自动清） |
| `user_online` / `user_offline` | `{user_id}` | `chatStore.setUserOnline/Offline` |
| `friend_request` | — | `friendStore.fetchRequests` |
| `friend_accepted` | — | `friendStore.fetchFriends` |
| `message_recalled` | `{conversation_id, message_id}` | `chatStore.handleMessageRecalled` |
| `heartbeat` | — | （前端目前未消费） |
| `call_incoming` | `{call_id, conversation_id, call_type, from_user}` | 来电 → `callStore` 振铃 |
| `call_accepted` / `call_rejected` / `call_ended` | `{call_id, conversation_id, reason?}` | 通话状态机流转 |
| `call_signal` | `{call_id, conversation_id, signal}` | WebRTC offer/answer/ICE 中继 |

### 2.6 数据模型

MongoDB 集合（`model/db.go:13-21`）：
- `users` — 用户名唯一索引
- `conversations` — `members` / `updated_at` / `group_id` 三索引
- `messages` — 复合索引 `(conversation_id, created_at:-1)`
- `groups` — `owner_id` 索引
- `friend_requests` — `(from_user_id, to_user_id)` 唯一 + `(to_user_id, status)`
- `friends` — `(user_id, friend_id)` 唯一

### 2.7 鉴权

- 注册/登录返回 JWT（`handler/auth.go`）
- 中间件 `middleware/auth.go`（63 行）解析 `Authorization: Bearer <token>`，校验签名，把 `userID` 注入 `gin.Context`
- WebSocket 走 query string `?token=...`（浏览器不能给 WS 加 header）

---

## 三、前端 React 架构

### 3.1 技术栈

| 维度 | 选型 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| 样式 | Tailwind CSS v4（`@import "tailwindcss"`）+ 全局 CSS 变量 + 内联 style |
| 状态 | Zustand（4 个 store） |
| 路由 | 无 react-router；条件渲染 `isAuthenticated ? <Chat/> : <Login/>` |
| HTTP | 原生 `fetch`，无 axios |
| WebSocket | 原生 `WebSocket`，封装在 `useWebSocket` hook |

### 3.2 目录结构

```
web/src/
├── main.tsx            # 入口（10 行）：createRoot → <App/>
├── App.tsx             # 顶层 ErrorBoundary + 登录/聊天切换（84 行）
├── index.css           # 全局样式 + Tailwind + 设计变量（1013 行 ⚠ 巨型）
├── pages/
│   ├── Login.tsx       # 登录/注册页（314 行，UI 最完整）
│   └── Chat.tsx        # 主界面壳子（46 行，组合 Sidebar+List+ChatArea）
├── components/
│   ├── Sidebar.tsx              # 最左导航栏（335 行）
│   ├── AccountSwitcher.tsx      # 多账号切换器（262 行）
│   ├── ConversationList.tsx     # 会话列表（242 行）
│   ├── ChatArea.tsx             # 主聊天区（544 行 ⚠ 超长）
│   ├── FriendList.tsx           # 联系人列表（223 行）
│   ├── GroupMembers.tsx         # 群成员侧栏（127 行）
│   ├── ProfilePanel.tsx         # 个人/他人资料侧栏（201 行）
│   ├── EmojiPicker.tsx          # 表情选择器（43 行）
│   ├── Portal.tsx               # createPortal 封装（19 行）
│   └── icons.tsx                # 集中 SVG 图标（201 行）
├── store/
│   ├── auth.ts         # 当前 active 账号的派生视图（81 行）
│   ├── accounts.ts     # 多账号管理器（135 行，token/user 持久化到 localStorage）
│   ├── chat.ts         # 聊天数据（按账号隔离切片，259 行）
│   └── friend.ts       # 好友列表/申请（54 行）
├── hooks/
│   └── useWebSocket.ts # WS 连接生命周期 + 事件分发（138 行）
├── api/
│   ├── client.ts       # fetch 封装 + token 注入（45 行）
│   ├── auth.ts         # login/register
│   ├── users.ts        # 用户接口
│   ├── conversations.ts
│   ├── friends.ts
│   └── groups.ts
├── styles/
│   └── common.ts       # inputStyle + hoverHandlers（31 行 ⚠ 反模式）
└── types/
    └── index.ts        # 全部 TS 类型（96 行）
```

### 3.3 主界面布局（`pages/Chat.tsx`）

```
┌─────┬──────────────┬─────────────────────────────────┐
│Side │ Conversation │           ChatArea              │
│bar  │ List         │  ┌──────────────────────────┐   │
│64px │ 300px        │  │ Topbar (64px)            │   │
│     │              │  ├──────────────────────────┤   │
│     │              │  │ Messages (flex-1)        │   │
│     │              │  │                          │   │
│     │              │  ├──────────────────────────┤   │
│     │              │  │ Composer (auto)          │   │
│     │              │  └──────────────────────────┘   │
└─────┴──────────────┴─────────────────────────────────┘
```

切到联系人 Tab 时，中间 + 右侧换成 `<FriendList/>`。

### 3.4 状态管理（Zustand 4 store）

**多账号架构**（重点）：
- `accounts.ts` 是真相之源，保存所有账号 `{userId, token, user}` 列表 + `activeId`，持久化到 `localStorage`。
- `auth.ts` 是 `accounts` 的"当前账号视图"，订阅 accounts 变化自动同步 `token/user/isAuthenticated`。
- `chat.ts` 内部用 `perUser: Record<uid, ChatData>` 存每个账号的会话/消息切片，顶层暴露的 `conversations/messages/...` 永远反映 active 账号；订阅 accounts 切换刷新视图。
- 切账号时 WS 也会重连到新 token（`useWebSocket.ts:106-119`）。

### 3.5 实时通讯（`hooks/useWebSocket.ts`）

- token 变化 → 关旧连接 → 开新连接
- 断线 3 秒自动重连（`reconnectTimerRef`）
- 收到消息按 `type` 分发到对应 store action
- 卸载时清理所有 timer 和连接

### 3.6 HTTP 客户端（`api/client.ts`）

- `request<T>(path, options)` — 统一加 `Content-Type` + `Authorization`，非 2xx 抛 `Error(err.error)`
- `uploadFile(file)` — multipart 上传到 `/api/upload`
- token 从 `useAccountsStore.getState().active()?.token` 读取（避免与 auth store 循环依赖）

### 3.7 样式系统（混合，⚠ 是 UI 问题的根因）

当前**三种样式并存**：

1. **Tailwind 工具类**（`className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm"`）—— 主体使用
2. **内联 `style={{}}`**（`style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}`）—— 颜色和主题变量用这个
3. **全局 CSS 类**（`className="nav-item-qq modern-send-btn toolbar-btn convo-active-indicator"`）—— 定义在 `index.css`

外加 `styles/common.ts` 里的 `hoverHandlers()` —— 用 JS `onMouseEnter/Leave` 改 `style.background` 模拟 hover（反模式，详见改造计划）。

CSS 变量定义在 `index.css:13-59`，主题为深色（`--bg-primary: #0a0e1a`），主色蓝（`--accent: #3b82f6`）；但登录页（`index.css:418-1013`）单独定义了一套绿色主题 `--lp-primary: #00d4aa`，与主界面颜色割裂。

> **图标系统**：`components/icons.tsx`（201 行）集中定义了 17 个 SVG 图标，统一 `viewBox="0 0 24 24"` + `currentColor` + `strokeWidth=2`。但**多个组件绕过它直接写内联 SVG**（ChatArea、ProfilePanel、GroupMembers、Login），详见改造计划书。

---

## 四、前后端契约速查

### 4.1 鉴权

- HTTP：`Authorization: Bearer <jwt>`
- WS：`?token=<jwt>` query

### 4.2 关键响应体

```typescript
// POST /api/auth/login
{ token: string, user: User }

// GET /api/users/me
User

// GET /api/conversations
Conversation[]   // 含 last_message

// GET /api/conversations/:id/messages?limit=50
Message[]        // 升序返回

// GET /api/friends (含 online 状态由 WS 推送)
Friend[]
```

### 4.3 消息撤回规则

- 后端 `RecallMessage` 校验：发送者本人 + 2 分钟内
- 前端右键菜单仅对自己消息 + 2 分钟内显示「撤回」（`ChatArea.tsx:138-139`）

---

## 五、已知架构债（与 UI 无关）

| 问题 | 位置 | 影响 |
|---|---|---|
| `service/` `repository/` 空目录 | `server/` | handler 直接操作 model，业务逻辑无分层 |
| `index.css` 1013 行巨型文件 | `web/src/index.css` | 登录页样式 + 主界面样式 + 工具类混在一起 |
| `ChatArea.tsx` 544 行 | `web/src/components/` | 单组件承担：顶栏+消息渲染+输入+搜索+右键菜单+上传，需拆分 |
| `hoverHandlers()` 用 JS 模拟 hover | `web/src/styles/common.ts` | 反模式，无键盘可达性，详见 UI 改造计划 |
| WS 全局单例 `GlobalHub` | `server/ws/hub.go:20` | 多副本部署时跨节点消息投递需要替换为 Redis Pub/Sub |
| 没有 refresh token | `middleware/auth.go` | token 过期就直接 401，前端无感刷新缺失 |

> UI 相关的所有问题汇总在 `frontend-redesign-plan.md`，本文档不展开。

---

## 六、2026-08-26 前端 UI 修复记录

### 6.1 根因（为什么之前"挤在一起"）

`web/src/index.css` 中有一条**未分层**的全局 reset：

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
```

Tailwind v4 的所有工具类（`p-*` / `px-*` / `py-*` / `m-*` / `mt-*` 等）都生成在
`@layer utilities` 里，而**未分层规则的优先级高于任何分层规则**。因此该 reset
覆盖了全部间距工具类：`padding`、`margin` 全部恒为 0，只剩 flex `gap` 和
内联 `style` 生效。表现为整站文字贴边、元素挤成一团。

> 复现证据（1500×940 视口，修复前）：`input[placeholder="搜索会话..."]`
> computed padding 为 `0px`、高度 22px；修复后 padding 为
> `10px 12px 10px 36px`、高度 42px。

### 6.2 修复内容

| 文件 | 改动 |
|---|---|
| `web/src/index.css` | 删除未分层 `*` reset（Tailwind v4 preflight 已提供等价 reset）；新增三栏布局类（`.chat-layout` / `.chat-sidebar` / `.conversation-pane` / `.contacts-pane` / `.chat-content`）；导航栏加宽（76px，按钮 52px）；Tab 下划线改用 `::after` 伪元素；补 `:focus-visible` 焦点环、`.online-dot`/`.offline-dot`、滚动条加粗至 8px + Firefox 兼容 |
| `web/src/pages/Chat.tsx` | 根容器改用 `.chat-layout`（`100dvh`，响应式三栏，不再固定 64+300 挤压聊天区） |
| `web/src/components/Sidebar.tsx` | 改用 `.chat-sidebar`，补齐 `aria-label` |
| `web/src/components/ConversationList.tsx` | 宽度交给 `.conversation-pane`（288px，窄屏自动 252/224）；Tab 下划线伪元素化；徽章 `min-height`、间距加大 |
| `web/src/components/ChatArea.tsx` | 消息区 `gap` 15→16、群昵称 12px、时间戳/已读间距；补 `.chat-content`；清理两个未用变量（TS 报错） |
| `web/src/components/FriendList.tsx` | 宽度交给 `.contacts-pane`；"同意/忽略"按钮 `min-height: 28px`、内边距加大；列表项间距 |
| `web/src/components/GroupMembers.tsx` / `ProfilePanel.tsx` | 列表项/头部内边距统一 |

### 6.3 验证

- `npm run build` 通过（tsc 无错误）
- 1500×940 无横向滚动，三栏对齐：Sidebar 76 + 列表 288 + 聊天区 1136
- 浏览器控制台无报错

---

## 七、2026-08-27 好友功能测试与修复记录

### 7.1 测试发现的问题（修复前）

1. **[高] UI 上无法发起加好友**：侧边栏"添加好友"搜索弹窗里只有"聊天"按钮，
   `store/friend.ts` 的 `sendRequest` 没有任何组件调用。
   证据：无头浏览器实测搜索结果按钮为 `["搜索","聊天"]`。
2. **[中] 好友申请徽章不初始化**：登录后不打开联系人页，侧边栏徽章一直为 0，
   即使已有 pending 申请。证据：登录后（未进联系人页）徽章为 null。
3. **[中] 改备注接口越权**：`PUT /api/friends/:id/remark` 不校验归属，
   非好友关系也返回 200 "updated"（未检查 `ModifiedCount`）。
   证据：API 测试 TC13，C 改 A↔B 的关系返回 200。

### 7.2 修复

- `web/src/components/Sidebar.tsx`：搜索结果项新增"加好友"按钮，调用
  `friendStore.sendRequest`；成功变"已发送"（防重复提交）；后端英文错误映射为
  中文提示（已是好友 / 申请已存在 / 不能加自己 / 用户不存在）；关闭弹窗重置状态。
- `web/src/pages/Chat.tsx`：登录/切号时调用 `fetchRequests()`，徽章随登录初始化。
- `server/handler/friend.go`：`UpdateFriendRemark` 增加 `MatchedCount==0 → 404` 校验。

### 7.3 回归测试结果（无头 Edge + puppeteer）

1. 后端 API 矩阵（25 例：申请 / 重复 / 反向互斥 / 加自己 / 不存在 /
   拒绝 / 重发 / 接受 / 双向好友 / 备注 / 越权备注 / 删除 / 空列表 / 多好友）：
   **25/25 通过**
2. 端到端"UI 发起加好友 → 对方接受 → WS 实时刷新"（双浏览器上下文）：
   **12/12 通过**
3. UI 复测（徽章初始化、右键菜单、查看资料、删除好友、WS 徽章推送）：
   **8/8 通过 ×2**

---

## 八、2026-08-27 通话功能与全部图标实现

### 8.1 实现内容（参考 QQ 的图标行为）

| 图标/按钮 | 实现 |
|---|---|
| 语音通话 | WebRTC 音频通话：呼叫 → 振铃 → 接听/拒绝 → 通话计时 → 挂断；忙线自动拒绝 |
| 视频通话 | WebRTC 音视频：本地预览 + 远端大画面 + 静音/关摄像头切换 |
| 更多操作 | 下拉菜单：发起群聊、添加好友、标为已读、清空聊天记录（含会话列表预览同步清空） |
| 表情/图片/文件/发送/搜索消息/群成员 | 原有功能回归验证 |

### 8.2 新增/修改

- `server/ws/client.go`：新增 `handleCall` / `handleCallEvent` 信令中继；
  **`maxMessageSize` 4KB → 1MB**（视频 SDP offer 超过 4KB 会触发 gorilla/websocket
  断连，导致信令丢失——这是测试发现的真实 bug）。
- `server/ws/hub.go`：修复注册表竞态——旧连接的 `Unregister` 会误删新连接，
  现在只删除"仍是当前连接"的条目，注册新连接时主动关闭旧连接。
- `web/src/store/call.ts`：通话状态机 + WebRTC（offer/answer/ICE、静音、关摄像头、
  60s 无人接听自动挂断、忙线自动拒绝）。
- `web/src/components/CallOverlay.tsx`：全局通话浮层（全局常驻，任何页面状态都能收到来电）。
- `web/src/components/ChatArea.tsx`：接通话按钮、更多菜单、轻提示 toast。
- `web/src/store/ui.ts`：跨组件弹窗开关（Sidebar 与"更多"菜单共用）。
- `web/src/hooks/useWebSocket.ts`：分发 5 种 call 事件到 call store。

### 8.3 通话信令协议

```jsonc
// 发起通话（客户端 → 服务端）
{ "type": "call", "data": { "conversation_id": "...", "call_type": "voice|video" } }
// 通话事件（客户端 → 服务端，服务端转发给会话其他成员）
{ "type": "call_event", "data": { "conversation_id": "...", "call_id": "...", "kind": "accept|reject|hangup|signal", "reason": "busy|...", "signal": { "type": "offer|answer|ice", "sdp": "...", "candidate": {...} } } }
```

### 8.4 回归测试结果

- 通话 + 更多菜单 + 图标回归：**26/26 通过**
- 好友功能回归：API 25/25、加好友 E2E 12/12（未受影响）
