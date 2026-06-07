# Golang_QQ 全面重构设计文档

## 概述

基于现有即时通讯项目进行渐进增强重构。项目定位为个人作品集项目，目标是体现完整的功能深度和工程质量。保持现有暗色主题风格，在此基础上增加好友系统、联系人管理、用户资料、群聊增强、消息增强等核心功能，使项目从"仅私聊"升级为完整的社交IM应用。

## 技术决策

- **方案选择**：渐进增强，在现有架构上逐步增加功能
- **技术栈不变**：Go(Gin) + React(Vite+TS) + MongoDB + WebSocket
- **UI风格**：保持暗色主题（深紫蓝色调），优化细节

## 新增功能清单

| 模块 | 功能 | 优先级 |
|------|------|--------|
| 登录页 | 左右分栏布局、Tab切换登录/注册、记住登录、密码强度指示 | P0 |
| 好友系统 | 好友申请/同意/拒绝/删除、好友列表、好友备注 | P0 |
| 联系人页 | 联系人Tab、在线状态、好友申请通知、快速发起聊天 | P0 |
| 用户资料 | 查看/编辑个人信息、头像上传、个性签名 | P1 |
| 群聊增强 | 群成员面板、群公告、踢人/退群UI | P1 |
| 消息增强 | 已读回执可视化、消息撤回、表情选择器 | P1 |
| 搜索 | 会话内搜索消息 | P2 |

## 数据模型

### 新增: friend_requests

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | ObjectId | 主键 |
| from_user_id | ObjectId | 申请人 |
| to_user_id | ObjectId | 被申请人 |
| message | string | 申请备注 |
| status | string | pending / accepted / rejected |
| created_at | datetime | |
| updated_at | datetime | |

索引: `{ from_user_id: 1, to_user_id: 1 }` (unique compound), `{ to_user_id: 1, status: 1 }`

### 新增: friends

| 字段 | 类型 | 说明 |
|------|------|------|
| _id | ObjectId | 主键 |
| user_id | ObjectId | 用户 |
| friend_id | ObjectId | 好友 |
| remark | string | 好友备注 |
| created_at | datetime | |

索引: `{ user_id: 1, friend_id: 1 }` (unique compound)

### 扩展: users

新增字段:
- `bio` (string) — 个性签名
- `email` (string) — 邮箱（可选）

## 后端 API 新增

### 好友系统

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/friends/request` | 发送好友申请 |
| GET | `/api/friends/requests` | 获取收到的好友申请列表 |
| PUT | `/api/friends/requests/:id` | 处理申请（accept/reject） |
| GET | `/api/friends` | 获取好友列表 |
| DELETE | `/api/friends/:id` | 删除好友 |
| PUT | `/api/friends/:id/remark` | 修改好友备注 |

### 用户资料扩展

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users/:id` | 获取任意用户公开资料 |
| PUT | `/api/users/me` (扩展) | 支持更新 bio、email |

### 群聊增强

| 方法 | 路径 | 说明 |
|------|------|------|
| PUT | `/api/groups/:id` | 更新群信息（名称、公告） |
| GET | `/api/groups/:id/members` | 获取群成员列表（含角色） |

### 消息增强

| 方法 | 路径 | 说明 |
|------|------|------|
| DELETE | `/api/conversations/:id/messages/:mid` | 撤回消息 |
| GET | `/api/conversations/:id/messages/search?q=` | 搜索消息 |

## WebSocket 协议新增

| 方向 | type | data | 说明 |
|------|------|------|------|
| S→C | friend_request | {from_user, message} | 收到好友申请 |
| S→C | friend_accepted | {user} | 好友申请被接受 |
| C→S | message_recall | {conversation_id, message_id} | 撤回消息 |
| S→C | message_recalled | {conversation_id, message_id} | 消息被撤回通知 |

## 前端页面设计

### 登录页重构

**布局**: 左右分栏
- **左侧展示区**: 产品名称、装饰性动画背景、产品特性简介
- **右侧表单区**: Tab切换登录/注册
  - 登录: 用户名 + 密码 + 记住我
  - 注册: 用户名 + 昵称 + 密码 + 确认密码 + 密码强度指示
  - 输入框焦点动画: 图标变色、边框高亮
  - 加载状态: 按钮内旋转动画

### 侧边栏改造

```
[头像]          ← 点击打开个人资料面板
────────
[消息] 🔴       ← 未读消息数徽章
[联系人] 🔴     ← 好友申请数徽章
[添加好友]      ← 打开搜索弹窗（现有功能保留）
[创建群聊]      ← 现有功能保留
────────
     ...
────────
[设置]          ← 预留
[退出]
```

### 联系人页（新增）

位于中间栏，选中联系人Tab时显示:
- 顶部搜索栏 + 添加好友按钮
- 好友申请区域: 展示待处理的申请，带红点数量提示
- 好友列表: 头像、昵称/备注、在线状态、个性签名
- 点击好友弹出上下文菜单: 发消息、查看资料、删除好友

### 用户资料面板

右侧抽屉式面板:
- 头像、昵称、用户名、签名、注册时间
- 自己的资料: 显示编辑按钮，可修改昵称、签名、上传头像
- 他人的资料: 发消息按钮

### 群聊增强

群聊顶栏新增群成员按钮，点击展开侧面板:
- 群成员列表（角色排序: 群主 > 管理员 > 成员）
- 群主可踢人，成员可退群
- 群公告显示区

### 消息增强

- **已读回执**: 消息气泡右下角显示 "已读 N"
- **消息撤回**: 右键/长按 → 撤回（2分钟内），撤回后显示 "该消息已撤回"
- **表情选择器**: 输入框旁表情按钮，弹出常用表情面板
- **消息搜索**: 会话顶栏搜索按钮，关键词高亮匹配

## 前端新增文件结构

```
web/src/
├── api/
│   ├── friends.ts          # 好友相关API
│   └── (现有文件)
├── components/
│   ├── FriendList.tsx       # 联系人列表
│   ├── FriendRequests.tsx   # 好友申请列表
│   ├── ProfilePanel.tsx     # 用户资料面板
│   ├── GroupMembers.tsx     # 群成员面板
│   ├── EmojiPicker.tsx      # 表情选择器
│   ├── MessageMenu.tsx      # 消息右键菜单
│   └── (现有文件)
├── hooks/
│   └── (现有文件)
├── pages/
│   ├── Login.tsx            # 重构
│   └── Chat.tsx             # 重构
├── store/
│   ├── friend.ts            # 好友状态管理
│   └── (现有文件)
└── types/
    └── index.ts             # 扩展类型定义
```

## 后端新增文件结构

```
server/
├── handler/
│   ├── friend.go            # 好友处理器
│   └── (现有文件)
├── model/
│   ├── friend.go            # 好友模型
│   └── (现有文件)
└── router/
    └── router.go            # 扩展路由
```

## 实现优先级

1. **Phase 1 - 后端基础**: 数据模型、好友系统API、用户资料API、群聊增强API
2. **Phase 2 - 登录页重构**: 左右分栏、Tab切换、表单优化
3. **Phase 3 - 联系人系统**: 好友申请流程、联系人列表、侧边栏Tab改造
4. **Phase 4 - 用户资料面板**: 查看资料、编辑资料、头像上传
5. **Phase 5 - 群聊增强**: 群成员面板、踢人/退群、群公告
6. **Phase 6 - 消息增强**: 已读回执、消息撤回、表情选择器
7. **Phase 7 - 搜索**: 会话内消息搜索
