# Golang QQ — 前端 UI 改造计划书

> 项目路径：`D:/Golang/Golang_QQ/web`
> 文档日期：2026-06-18
> 范围：**仅前端 UI**（后端不在本次范围内）
> 配套文档：`architecture.md`（项目整体架构）

---

## 目录

1. [现状诊断](#一现状诊断带证据)
2. [硬性约束（不可妥协）](#二硬性约束不可妥协)
3. [设计 Token 体系](#三设计-token-体系)
4. [10px 间距网格规范](#四10px-间距网格规范核心)
5. [图标系统改造](#五图标系统改造)
6. [hover / focus 交互改造](#六hover--focus-交互改造删除所有-js-hover)
7. [逐组件改造清单](#七逐组件改造清单)
8. [全局改造任务](#八全局改造任务)
9. [实施阶段](#九实施阶段)
10. [验收清单](#十验收清单)

---

## 一、现状诊断（带证据）

### 1.1 整体观感为什么"丑"——5 个根因

| # | 根因 | 证据 |
|---|---|---|
| **R1** | **没有间距体系**，随手用 `p-2 / p-2.5 / p-3 / p-3.5 / p-4 / p-5 / p-6` 混搭 | 全项目 grep `py-2.5`/`px-3.5`/`p-4` 等任意组合，无规则 |
| **R2** | **三种样式机制并存**（Tailwind 工具类 + 内联 `style={{}}` + 全局 CSS 类），同一组件三种混用 | `ChatArea.tsx:255-326`（顶栏），`Sidebar.tsx:74-154` |
| **R3** | **图标被文字覆盖 / 与文字零间距**：多个组件绕过 `icons.tsx` 直接写 raw SVG，且按钮里 `<svg>` 紧跟文字无 `gap` | `Login.tsx:84-95`（brand logo+文字 `gap: 14px` 但 logo 内 svg 无 margin）、`Sidebar.tsx:201-204`（搜索结果列表项 `<div>{initial}</div><span>{name}</span>` 用 `gap-3`，但搜索按钮自身 `<button>搜索</button>` 无任何内边距） |
| **R4** | **hover 用 JS 模拟**（`onMouseEnter/Leave` 改 `style.background`），导致 hover 态不一致、键盘用户无法触达、代码膨胀 | `Sidebar.tsx:149-150`、`ConversationList.tsx:109-110, 166-167`、`FriendList.tsx:72-73`、`ProfilePanel.tsx:96-97`、`GroupMembers.tsx:65-66, 79-80, 103-104`、`AccountSwitcher.tsx:165-166`、`ChatArea.tsx:239-240, 456-457`，以及 `styles/common.ts:17-31` 的 `hoverHandlers()` |
| **R5** | **主界面背离了 Login 页的设计语言**：Login 用 mint `--lp-primary: #00d4aa` + Inter 字体 + 多层阴影 + 玻璃拟态 + hover 上浮，主界面却用蓝色 `--accent: #3b82f6` + system-ui + 单层阴影 + 仅改 bg 的 hover——**Login 是设计基准，主界面是"次品"** | `index.css:29`（蓝）vs `index.css:419`（mint，应作为全局基准） |

### 1.2 间距违规——文字贴边 / 缺 padding 的具体位置

| 文件:行 | 元素 | 问题 |
|---|---|---|
| `ConversationList.tsx:116-141` | Tab 切换栏 `<button className="py-3">全部/私聊/群聊</button>` | **`borderBottom: 2px solid` 直接画在按钮上，文字下方只有 `py-3`（12px）就被下边框切掉**，没有 `margin-bottom` 让下划线与文字保持呼吸 |
| `ConversationList.tsx:134-138` | Tab 标签后面的 `<span>{count}</span>` 徽章 | `px-1.5 py-0.5`（6/2px），`text-[10px]`，徽章左右紧贴文字（`ml-1.5`=6px）—— 数字贴边，几乎不可读 |
| `Sidebar.tsx:188-193` | 搜索按钮 `<button>搜索</button>` | `px-4 py-2.5`，但按钮里**没有图标**；与左侧 input `gap-2`（8px），input 内部 `px-3.5`（14px），整体间距混乱 |
| `Sidebar.tsx:201-204` | 搜索结果项 `<div className="p-3 rounded-lg">` | 头像 div `w-9 h-9`（36px）+ `<span>` 文字，`gap-3`（12px）。文字 `text-sm` 贴头像无 margin，**头像和文字之间纯靠 `gap` 撑开**——一旦 flex 失效文字就贴头像 |
| `Sidebar.tsx:208-214` | 搜索结果项的"聊天"按钮 `<button>聊天</button>` | `px-3 py-1.5`（12/6px），`text-xs`，**没有任何 hover 态**（既无 CSS hover 也无 JS hover），按钮看起来死板 |
| `ChatArea.tsx:364` | 消息容器 `<div style={{ padding: 20, gap: 15 }}>` | padding 20px（不是 10 的倍数），gap 15px（不是 10 的倍数）—— **直接违反 10px 网格** |
| `ChatArea.tsx:407-417` | 消息气泡 `<div style={{ padding: '12px 16px' }}>` | 12px 不是 10 的倍数 |
| `ChatArea.tsx:401-405` | 群聊发送者昵称 `<span className="text-[11px] ml-1">` | `ml-1`（4px）太小，且 `text-[11px]` 不在字号体系内 |
| `ChatArea.tsx:423-429` | 消息时间戳 `<span className="text-[10px] mt-0.5">` | `mt-0.5`（2px）+ `text-[10px]`，太小且不规整 |
| `FriendList.tsx:80-88` | "好友申请"标题 `<div className="text-xs ... mb-2 px-1">` | `px-1`（4px）让标题与右侧徽章紧贴，徽章 `px-1.5 py-0.5` 自身又过窄 |
| `FriendList.tsx:104-115` | "同意/忽略"按钮 `<button>同意</button>` | `px-2.5 py-1`（10/4px），4px 上下内边距让文字几乎贴按钮上下边 |
| `ProfilePanel.tsx:87-103` | 头部标题栏 `<div className="p-4 flex items-center justify-between">` | `p-4`（16px），标题 `<h3 className="text-sm">` 与关闭按钮无 gap，按钮 `w-7 h-7`（28px） |
| `ProfilePanel.tsx:105-186` | 资料主体 `<div className="p-6 text-center">` | `p-6`（24px）—— 与头部 `p-4` 不连续，跳跃 |
| `ProfilePanel.tsx:161-167` | 用户名 `<h2 className="mt-4 text-lg">` + `<p className="text-xs mt-1">` + bio `<p className="mt-3 text-sm px-2">` | `mt-1`（4px）/`mt-3`（12px）/`mt-4`（16px）三连跳，不规整；bio `px-2` 让文字贴容器边 |
| `GroupMembers.tsx:74` | 列表容器 `<div className="flex-1 overflow-y-auto p-3 space-y-1">` | `p-3`（12px）+ `space-y-1`（4px），成员项之间间距过窄 |
| `GroupMembers.tsx:77` | 成员项 `<div className="flex items-center gap-2.5 p-2 rounded-xl">` | `p-2`（8px）+ `gap-2.5`（10px），头像 `w-8 h-8`（32px），**昵称贴头像无独立 margin** |
| `GroupMembers.tsx:90-95` | 角色徽章 `<span className="text-[10px] px-1.5 py-0.5 rounded">` | `text-[10px]` 不在体系；`py-0.5`（2px）文字贴上下边 |
| `AccountSwitcher.tsx:111-129` | 账号面板头部 `<div className="px-4 py-3 flex items-center justify-between">` | "账号"标签 + 关闭按钮，按钮 `w-6 h-6`（24px），`py-3`（12px）整体过窄 |
| `AccountSwitcher.tsx:117-120` | `<span className="text-xs uppercase tracking-wider">账号</span>` | `text-xs`（12px）+ `tracking-wider` 与中文"账号"不搭 |
| `EmojiPicker.tsx:18` | 容器 `<div className="p-3 rounded-lg w-[320px]">` | `p-3`（12px），与按钮 `w-8 h-8`（32px）的尺寸不匹配；`gap-0.5`（2px）让表情按钮互相贴着 |
| `Login.tsx:86-95` | 品牌头 `<div className="lp-brand">` 内 logo + 文字 | logo `w-12 h-12`（48px）内嵌 svg `width: 26px` 居中，但 logo 与右侧文字 `gap: 14px`（写在 CSS 里），**14px 不是 10 的倍数** |
| `index.css:588` | `.lp-brand { gap: 14px; margin-bottom: 40px; }` | 14px 违反 10px 网格 |
| `index.css:656-658` | `.lp-feature-list { gap: 14px; }` | 14px 违反 10px 网格 |
| `index.css:663-664` | `.lp-feature-item { gap: 12px; padding: 12px 16px; }` | 12px 违反 |
| `index.css:722-724` | `.lp-form-group { margin-bottom: 20px; }` | 20px ✓ 但下一组 label `margin-bottom: 8px` 不在网格 |

### 1.3 图标使用问题

**`icons.tsx` 是好底子**：17 个图标统一 `viewBox="0 0 24 24"` + `currentColor` + `strokeWidth=2`，接口 `{size, className, style}` 标准化。

**但被大量绕过**——直接在组件里写 raw inline SVG：

| 文件:行 | 用途 | raw SVG 内容 | 应替换为 |
|---|---|---|---|
| `ChatArea.tsx:479-482` | 表情按钮 | `<svg>` 笑脸路径 | 新增 `SmileIcon` |
| `ChatArea.tsx:494-496` | 图片按钮 | `<svg>` 图片路径 | 新增 `ImageIcon` |
| `ChatArea.tsx:502-504` | 文件按钮 | `<svg>` 回形针变体 | 复用 `PaperclipIcon` |
| `ProfilePanel.tsx:99-101` | 关闭按钮 | X 图标 | `CloseIcon size={14}` |
| `ProfilePanel.tsx:118-121` | 相机（换头像） | `<svg>` camera 路径 | 新增 `CameraIcon` |
| `ProfilePanel.tsx:191-194` | 邮箱 | `<svg>` envelope 路径 | 新增 `MailIcon` |
| `GroupMembers.tsx:68-70` | 关闭按钮 | X 图标 | `CloseIcon size={14}` |
| `GroupMembers.tsx:106-108` | 移出群聊 | X 图标 | `CloseIcon size={12}` 或新增 `XIcon` |
| `Login.tsx:86-90` | 品牌 logo | `<svg>` 对话气泡 | 新增 `BrandIcon` |
| `Login.tsx:120-123` | 4 个特性图标 | 4 段 SVG path | 新增 `BoltIcon` / `ShieldIcon` / `BoxIcon` / `BadgeIcon` |
| `Login.tsx:284-296` | GitHub / 微信 / QQ | brand svg | 新增 `GithubIcon` / `WechatIcon` / `QQIcon` |

**图标尺寸不一致**（同样的图标不同组件不同 size）：
- `SearchIcon`：`ConversationList.tsx:100` size=16；`FriendList.tsx:63` size=14；`ChatArea.tsx:311` size=18
- `UsersIcon`：`Sidebar.tsx:107,130` size=20；`ConversationList.tsx:179` size=18；`ChatArea.tsx:271,318` size=16/18
- `CloseIcon`：`Sidebar.tsx:172,243` size=16；`AccountSwitcher.tsx:127` size=14；`AccountSwitcher.tsx:209` size=16

### 1.4 其他显眼问题

| 问题 | 位置 |
|---|---|
| 头像尺寸七种：`w-7`(28) `w-8`(32) `w-9`(36) `w-10`(40) `w-11`(44) `w-20`(80) `h-12`(48 brand) | 7 个组件随机 |
| 圆角随意：`rounded`(4) `rounded-md`(6) `rounded-lg`(8) `rounded-xl`(12) `rounded-2xl`(16) `rounded-3xl`(24) `rounded-full` 混用 | 全项目 |
| 面板宽度随意：Sidebar 64 / ConversationList 300 / FriendList 320 / ProfilePanel 320 / GroupMembers 280 / AccountSwitcher 260 | `pages/Chat.tsx` 与组件内 width |
| `ChatArea.tsx:272` `getConvoName[0]?.toUpperCase()` | 若 name 为空字符串会抛错 |
| `index.css:396` `.weather-tag` 类名是"天气"，但实际用于在线状态标签 | 命名错乱 |
| `index.css` 中没有 `.online-dot` / `.offline-dot` 定义，但 `ConversationList.tsx:184` 引用了 | 类名断链 |
| `index.css:1013` 行巨型文件 | 登录页样式（445-1013 行）+ 主界面样式 + 工具类混在一起 |
| `ErrorBoundary`（`App.tsx:14-67`）用 inline style + 硬编码 `#0a0e1a`/`#ef4444`/`#3b82f6` | 不走 CSS 变量 |
| 无 `:focus-visible` 全局样式 | 键盘用户看不到焦点环 |
| 无 light mode | 只硬编码 dark |
| `index.css:84` 滚动条 `width: 5px` 太细，且无 Firefox `scrollbar-width` 兼容 | 全局 |

---

## 二、硬性约束（不可妥协）

> 以下规则在 PR review 时**逐条勾验**，违反任何一条不予合并。

### 2.1 间距约束（10px 网格）

- **C1**：所有 `margin` / `padding` / `gap` 必须是 `4px`、`8px`、`10px`、`12px`、`16px`、`20px`、`24px`、`32px`、`40px`、`48px` 之一（即 Tailwind 的 `1 / 1.5 / 2 / 2.5 / 3 / 4 / 5 / 6 / 8 / 10 / 12`）。**禁止使用** `0.5`(2px) `2.5`(10px 已允许) `3.5`(14px) `7` `9` `11` `13` 等不在网格上的值。
- **C2**：默认水平间距 = 10px（即 `gap-2.5` 或 `px-2.5`），最小内边距 = 10px。**任何文字必须距离边框 ≥ 10px**。
- **C3**：相邻组件之间必须留 `gap ≥ 10px`；列表项之间 `gap ≥ 8px`；分组之间 `gap ≥ 20px`。

### 2.2 图标 + 文字约束

- **C4**：图标与相邻文字**必须**有 `gap ≥ 8px`（推荐 10px）。**禁止**图标和文字 0 间距相邻。
- **C5**：图标在按钮内时，按钮 `padding ≥ 8px`，图标 `width === height`，尺寸为 `12 / 14 / 16 / 18 / 20` 之一。
- **C6**：图标必须使用 `currentColor`；不允许硬编码 `stroke="white"` / `stroke="#fff"` 等。
- **C7**：所有 SVG 图标**必须**通过 `components/icons.tsx` 暴露，**禁止**在组件内直接写 `<svg>` 例外：Login 页品牌大 logo 可保留独立 svg（但需抽到 `BrandLogo.tsx`）。

### 2.3 文字贴边约束

- **C8**：所有可见文字距离其容器边缘 `≥ 10px`（按钮、徽章、卡片、面板、tooltip）。
- **C9**：按钮内文字 `padding` 至少 `8px 12px`（小按钮）或 `10px 20px`（主按钮）。**禁止** `py-0.5` `py-1`（< 4px）这种贴边 padding。
- **C10**：徽章 / tag 内文字 `padding` 至少 `2px 8px`，且 `min-height: 20px`。

### 2.4 颜色约束

- **C11**：所有颜色**必须**使用 CSS 变量（`var(--accent)` 等），**禁止**在组件中硬编码 `#3b82f6` / `#00d4aa` 等。例外：avatar 颜色池（动态生成）。
- **C12**：**Login 页是设计基准**。`--lp-primary: #00d4aa`（mint）上升为全局 `--accent`，主界面原来的蓝色 `#3b82f6` 降级为辅助分类色。**Login 页本身不改颜色**，只是把它的 token 提升为整站基准。

### 2.5 交互约束

- **C13**：hover 状态**必须**用 CSS `:hover` 实现，**禁止**用 `onMouseEnter/Leave` 改 `style`。删除 `styles/common.ts:17-31` 的 `hoverHandlers()`。
- **C14**：所有可聚焦元素必须有 `:focus-visible` 样式（环 / 描边）。
- **C15**：所有交互元素必须有过渡 `transition: all 0.15s ease`（已在 `index.css:92-94` 全局声明，确认保留）。

### 2.6 尺寸约束

- **C16**：头像尺寸收敛到 3 档：`sm=28px`（侧边栏徽章）/ `md=36px`（列表项）/ `lg=64px`（资料卡）。**禁止** 32/40/44 等中间值。
- **C17**：圆角收敛到 4 档：`sm=6px`（小按钮）/ `md=10px`（卡片、按钮默认）/ `lg=14px`（面板、对话框）/ `full`（头像圆、徽章）。**删除** `rounded`(4) / `rounded-2xl`(16) / `rounded-3xl`(24)。
- **C18**：图标尺寸收敛到 5 档：`12 / 14 / 16 / 18 / 20`。

---

## 三、设计 Token 体系

### 3.1 颜色（以 Login 页为基准重写 `index.css:13-59`）

```css
:root {
  /* ===== 主色：mint（来自 Login 页 --lp-primary） ===== */
  --accent:         #00d4aa;
  --accent-hover:   #00b894;
  --accent-active:  #009d7e;
  --accent-soft:    rgba(0, 212, 170, 0.12);
  --accent-glow:    rgba(0, 212, 170, 0.25);

  /* ===== 辅助分类色（来自 Login 页） ===== */
  --accent-blue:    #3b82f6;   /* 私聊/链接 */
  --accent-purple:  #8b5cf6;   /* 群聊/分类 */
  --accent-orange:  #f59e0b;   /* 警告/管理员 */
  --accent-pink:    #ec4899;   /* 在线/特殊 */

  /* ===== 背景层（与 Login 页对齐，更深一档） ===== */
  --bg-base:        #0a0e17;   /* 全局底色（原 #0a0e1a → 更接近 Login 的 #0a0e17） */
  --bg-surface:     #111827;   /* 面板/侧栏底色 */
  --bg-elevated:    #1a2234;   /* 浮层/卡片 */
  --bg-hover:       #1e293b;   /* hover 态 */
  --bg-active:      #252d3d;   /* 选中态 */
  --bg-input:       #0d1420;   /* 输入框底色（来自 Login --lp-bg-dark） */
  --bg-overlay:     rgba(0, 0, 0, 0.45);

  /* ===== 文字 ===== */
  --text-primary:   #f1f5f9;
  --text-secondary: #94a3b8;
  --text-muted:     #64748b;
  --text-on-accent: #0a0e17;   /* mint 上的文字用深色（Login 风格） */

  /* ===== 语义色 ===== */
  --success:        #10b981;
  --warning:        #f59e0b;
  --danger:         #ef4444;
  --danger-soft:    rgba(239, 68, 68, 0.10);

  /* ===== 在线状态 ===== */
  --online:         #10b981;
  --offline:        #64748b;

  /* ===== 边框 ===== */
  --border:         #1e293b;
  --border-strong:  #334155;
  --border-focus:   var(--accent);

  /* ===== 消息气泡 ===== */
  --bubble-mine:    linear-gradient(135deg, #00d4aa, #00b894);  /* mint 渐变 */
  --bubble-other:   #1a2234;
  --bubble-mine-text:    #0a0e17;  /* mint 上用深色字 */
  --bubble-other-text:   #f1f5f9;

  /* ===== 阴影：多层叠加（来自 Login 页 .lp-container 的 box-shadow） ===== */
  --shadow-xs:      0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-sm:      0 2px 8px rgba(0, 0, 0, 0.30);
  --shadow-md:      0 4px 20px rgba(0, 0, 0, 0.40);
  --shadow-lg:      0 12px 32px rgba(0, 0, 0, 0.50);
  --shadow-xl:      0 25px 50px -12px rgba(0, 0, 0, 0.50);   /* Login 主容器同款 */
  --shadow-glow:    0 0 100px rgba(0, 212, 170, 0.03);       /* 主色 glow tint */
  --shadow-focus:   0 0 0 3px var(--accent-glow);
  --shadow-accent:  0 4px 20px rgba(0, 212, 170, 0.30);      /* 主按钮阴影 */
}
```

> **变更说明**：
> - 主色由蓝色 `#3b82f6` 改为 mint `#00d4aa`（来自 Login 页 `--lp-primary`）。
> - 蓝色保留为辅助分类色 `--accent-blue`，用于私聊/链接等场景。
> - 紫色 / 橙色 / 粉色作为分类色补齐（来自 Login 特性卡）。
> - 引入 `--shadow-glow` 和 `--shadow-accent`，主色 tint 让阴影带 mint glow（Login 标志性效果）。
> - 消息气泡 mine 由蓝紫渐变改为 mint 渐变，文字由白改深色（Login 风格）。

### 3.2 间距（10px 网格）

```css
:root {
  --space-1:  4px;    /* 紧贴元素间，最小 */
  --space-2:  8px;    /* 默认行内间距 */
  --space-3:  10px;   /* ★ 默认水平间距 / 最小内边距 */
  --space-4:  12px;   /* 列表项内边距 */
  --space-5:  16px;   /* 卡片内边距 */
  --space-6:  20px;   /* 分组间 */
  --space-7:  24px;   /* 大段落 */
  --space-8:  32px;   /* 区块间 */
  --space-9:  40px;   /* 登录页大块 */
  --space-10: 48px;   /* 页面级 */
}
```

> Tailwind 用户仍可用 `gap-2.5`(10px) / `p-2.5` / `gap-4`(16px) 等。**新规则**：项目根目录 `tailwind.config`（v4 在 `@theme` 里）显式声明只暴露上述 spacing 尺度。

### 3.3 字号与字体（来自 Login 页）

```css
/* ===== 字体家族（来自 Login --lp-font） ===== */
--font-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono:  'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
--font-zh:    'PingFang SC', 'Microsoft YaHei', sans-serif;  /* 中文 fallback */

body {
  font-family: var(--font-sans), var(--font-zh);
}

/* 技术标签用 mono：GO IM PROJECT、版本号、时间戳 */
.mono { font-family: var(--font-mono); }

/* ===== 字号尺度 ===== */
--font-xs:    11px;   /* 时间戳、徽章数字 */
--font-sm:    12px;   /* 辅助文字、备注、副标题 */
--font-base:  13px;   /* 列表项（QQ 风格偏小） */
--font-md:    14px;   /* 默认正文、消息 */
--font-lg:    16px;   /* 标题、输入框 */
--font-xl:    18px;   /* 二级标题、按钮主文字 */
--font-2xl:   22px;   /* 一级标题 */
--font-3xl:   28px;   /* 登录页主标题（仅 Login 用） */

/* ===== 字重 ===== */
--fw-normal:    400;
--fw-medium:    500;
--fw-semibold:  600;
--fw-bold:      700;
--fw-extrabold: 800;   /* Login h1 用 */

/* ===== 行高 ===== */
--lh-tight:    1.2;    /* 标题 */
--lh-snug:     1.35;   /* 按钮、列表项 */
--lh-normal:   1.5;    /* 正文、消息 */

/* ===== 字间距（来自 Login） ===== */
--tracking-tight:  -0.5px;  /* 大标题 */
--tracking-normal: 0;
--tracking-wide:   1px;     /* mono 标签 */
--tracking-wider:  2px;     /* uppercase 小标签 */
```

> **变更说明**：
> - 引入 **Inter** 作为主字体（来自 Login `--lp-font`），中文 fallback PingFang/微软雅黑。
> - 引入 **JetBrains Mono** 用于技术标签（GO IM PROJECT、版本号、时间戳）。
> - 当前散落使用 `text-[10px]` `text-[11px]` `text-xs`(12) `text-sm`(14) `text-base`(16) `text-lg`(18) `text-xl`(20) `text-2xl`(24) —— 收敛到上述 8 档。
> - **加载字体**：在 `index.html` 加 Google Fonts：
>   ```html
>   <link rel="preconnect" href="https://fonts.googleapis.com">
>   <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
>   ```

### 3.4 圆角

```css
--radius-sm:   6px;    /* 小按钮、徽章 */
--radius-md:   10px;   /* 默认（按钮、卡片、输入框） */
--radius-lg:   14px;   /* 面板、对话框 */
--radius-full: 9999px; /* 头像、tag */
```

> 删除 `index.css:5` 的 `--radius-sm: 4px`（太小），删除 `--radius-2xl: 16px` 和 `--radius-3xl: 20px`（不在网格）。

### 3.5 头像 / 图标尺寸

```css
--avatar-sm: 28px;   /* Sidebar、AccountSwitcher */
--avatar-md: 36px;   /* 列表项（会话、好友、群成员） */
--avatar-lg: 64px;   /* 资料面板 */

--icon-xs: 12px;
--icon-sm: 14px;
--icon-md: 16px;
--icon-lg: 18px;
--icon-xl: 20px;
```

### 3.6 动效（来自 Login 页的核心动画）

```css
/* ===== 缓动与时长 ===== */
--ease:         cubic-bezier(0.4, 0, 0.2, 1);     /* 默认 */
--ease-out:     cubic-bezier(0.16, 1, 0.3, 1);    /* 出场（来自 Login lp-container-appear） */
--ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1); /* 弹性（hover 上浮） */

--dur-fast:     0.15s;
--dur-base:     0.2s;
--dur-slow:     0.3s;
--dur-slower:   0.5s;   /* 入场动画 */
```

#### 必带动画（从 Login 迁移到主界面）

```css
/* 1. 卡片/面板入场 —— 来自 Login .lp-container-appear */
@keyframes panel-appear {
  0%   { opacity: 0; transform: translateY(20px) scale(0.98); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-panel-appear { animation: panel-appear 0.5s var(--ease-out) forwards; }

/* 2. 列表项淡入上移 —— 来自 Login .lp-feature-item */
@keyframes item-appear {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-item-appear { animation: item-appear 0.3s var(--ease-out) forwards; }

/* 3. hover 上浮（列表项、卡片、按钮）—— 来自 Login .lp-feature-item:hover */
.hover-lift {
  transition: transform var(--dur-base) var(--ease),
              box-shadow var(--dur-base) var(--ease),
              background-color var(--dur-base) var(--ease);
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* 4. hover 横移（侧边栏列表项）—— 来自 Login .lp-feature-item:hover */
.hover-slide {
  transition: transform var(--dur-base) var(--ease),
              background-color var(--dur-base) var(--ease);
}
.hover-slide:hover {
  transform: translateX(4px);
}

/* 5. 主按钮 shimmer（光扫过）—— 来自 Login .lp-submit-btn::after */
.btn-shimmer {
  position: relative;
  overflow: hidden;
}
.btn-shimmer::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.6s var(--ease);
}
.btn-shimmer:hover::after { left: 100%; }

/* 6. 渐变文字 —— 来自 Login .lp-highlight */
.gradient-text {
  background: linear-gradient(135deg, var(--accent), var(--accent-blue));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 7. 玻璃拟态 —— 来自 Login .glass */
.glass {
  background: rgba(17, 24, 39, 0.85);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 8. pulse（"正在输入"指示器）—— 保留原有 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
```

#### 不迁移（保留 Login 专属）

以下效果**仅留在 Login 页**，不带到主界面（避免聊天界面过花）：

- `lp-streamline-rotate` —— 主容器流线边框旋转
- `lp-float-particle` —— 浮动粒子
- 600px 光晕背景 blobs
- 60px 网格背景

> **判断依据**：用户在 2026-06-18 确认采用"克制"方案——配色/字体/玻璃/hover lift/多层阴影/入场动画 带入主界面；粒子/流线/光晕 仅 Login 保留。

---

### 3.7 设计语言迁移表（Login → 主界面）

| 设计元素 | Login 中的实现 | 主界面是否采纳 | 主界面如何用 |
|---|---|---|---|
| **主色 mint** | `--lp-primary: #00d4aa` | ✅ 全局采纳 | 提升为 `--accent`，替换原蓝色 |
| **辅助色** | blue / purple / orange | ✅ 采纳 | 私聊=blue，群聊=purple，管理员=orange |
| **Inter 字体** | `--lp-font: 'Inter', ...` | ✅ 全局 body | 替换 system-ui |
| **JetBrains Mono** | 品牌副标 `GO IM PROJECT` | ✅ 限场景 | 时间戳、版本号、技术标签 |
| **多层阴影** | `0 25px 50px -12px + glow` | ✅ 采纳 | 弹窗、hover 态卡片、主按钮 |
| **主色 glow tint** | `rgba(0,212,170,0.03)` | ✅ 采纳 | 阴影最外层带 mint 微光 |
| **玻璃拟态** | `.glass` blur(16) saturate(120) | ✅ 弹窗/浮层 | Modal、下拉菜单、右键菜单 |
| **hover 上浮** | `translateY(-2px)` | ✅ 列表项/卡片 | `.hover-lift` 工具类 |
| **hover 横移** | `translateX(4px)` | ✅ 侧栏列表项 | `.hover-slide` 工具类 |
| **按钮 shimmer** | `.lp-submit-btn::after` | ✅ 主按钮 | `.btn-shimmer` 工具类 |
| **渐变文字** | `.lp-highlight` | ✅ 标题关键词 | `.gradient-text` 工具类 |
| **卡片入场动画** | `lp-container-appear` | ✅ 面板/弹窗 | `.animate-panel-appear` |
| **圆角** | `border-radius: 24px`（容器）/ `14px`（按钮） | ⚠️ 收敛 | 主界面收敛到 6/10/14，不用 24 |
| **网格背景** | `.login-bg-grid` 60px 线 | ❌ 不带 | 仅 Login |
| **光晕 blobs** | `.login-bg-glow` 600px | ❌ 不带 | 仅 Login |
| **粒子漂浮** | `.login-particle` | ❌ 不带 | 仅 Login |
| **流线边框** | `.lp-streamline-border` | ❌ 不带 | 仅 Login |
| **特征卡列表** | `.lp-feature-list` | ❌ 不带 | 仅 Login 左面板 |

#### Avatar 颜色池调整

当前 5 个组件各自维护 10 色头像池，且颜色与主色冲突（红橙黄绿青蓝紫）。统一为（含 mint 在内）：

```ts
// web/src/components/Avatar.tsx
const AVATAR_COLORS = [
  '#00d4aa',  // mint（主色）
  '#3b82f6',  // blue
  '#8b5cf6',  // purple
  '#ec4899',  // pink
  '#f59e0b',  // orange
  '#10b981',  // green
  '#06b6d4',  // cyan
  '#ef4444',  // red（保留语义色）
  '#14b8a6',  // teal
  '#6366f1',  // indigo
];
```

> mint 放第一位，确保至少 1/10 头像会用到主色。

---

## 四、10px 间距网格规范（核心）

### 4.1 默认值表

| 场景 | 推荐值 | Tailwind | CSS var |
|---|---|---|---|
| 按钮内边距（小） | `8px 12px` | `py-2 px-3` | `padding: var(--space-2) var(--space-4);` |
| 按钮内边距（主） | `10px 20px` | `py-2.5 px-5` | `padding: var(--space-3) var(--space-6);` |
| 输入框内边距 | `10px 14px` | `py-2.5 px-3.5` | **改 12px** `py-3 px-3` |
| 列表项内边距 | `10px 12px` | `py-2.5 px-3` | — |
| 卡片内边距 | `16px` | `p-4` | — |
| 面板内边距 | `20px` | `p-5` | — |
| 行内元素 gap | `10px` | `gap-2.5` | — |
| 列表项 gap | `8px` | `gap-2` | — |
| 分组 gap | `20px` | `gap-5` | — |
| 区块 gap | `32px` | `gap-8` | — |

### 4.2 图标 + 文字组合模板

```tsx
// ✅ 正确：图标 + 文字 10px gap
<button className="flex items-center gap-2.5 px-3 py-2 rounded-md">
  <SearchIcon size={16} />
  <span className="text-md">搜索</span>
</button>

// ✅ 正确：仅图标按钮（带 aria-label）
<button
  className="flex items-center justify-center w-9 h-9 rounded-md hover:bg-[var(--bg-hover)]"
  aria-label="搜索"
>
  <SearchIcon size={16} />
</button>

// ❌ 错误：图标文字零 gap
<button className="flex items-center px-3 py-2">
  <SearchIcon size={16} />搜索
</button>

// ❌ 错误：用 JS 模拟 hover
<button
  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
>
  <SearchIcon size={16} />
</button>
```

### 4.3 文字与边框距离

```css
/* 所有内含文字的元素强制最小内边距 */
.btn        { padding: 8px 12px; }     /* 最小 */
.btn-primary { padding: 10px 20px; }
.badge      { padding: 2px 8px; min-height: 20px; }
.tag        { padding: 4px 10px; }
.card       { padding: 16px; }
.panel      { padding: 20px; }
```

---

## 五、图标系统改造

### 5.1 扩充 `icons.tsx`

在现有 17 个图标基础上，新增以下图标（统一 `viewBox=0 0 24 24` + `currentColor` + `strokeWidth=2`）：

```tsx
// 新增到 web/src/components/icons.tsx
export function SmileIcon({ size = 18, className }: IconProps) { /* ChatArea 表情 */ }
export function ImageIcon({ size = 18, className }: IconProps) { /* ChatArea 图片 */ }
export function CameraIcon({ size = 18, className }: IconProps) { /* ProfilePanel 换头像 */ }
export function MailIcon({ size = 16, className }: IconProps) { /* ProfilePanel 邮箱 */ }
export function BrandIcon({ size = 26, className }: IconProps) { /* Login 品牌 */ }
export function BoltIcon({ size = 18, className }: IconProps) { /* Login 百万级并发 */ }
export function ShieldIcon({ size = 18, className }: IconProps) { /* Login 加密 */ }
export function BoxIcon({ size = 18, className }: IconProps) { /* Login 分布式 */ }
export function BadgeIcon({ size = 18, className }: IconProps) { /* Login 高可用 */
  // 注意现有 AlertIcon 已有"盾牌+对勾"语义，可复用
}
export function GithubIcon({ size = 20, className }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
    <path d="..." />
  </svg>;
  // brand 图标用 fill 而非 stroke
}
export function WechatIcon({ size = 20, className }: IconProps) { /* fill 版本 */ }
export function QQIcon({ size = 20, className }: IconProps) { /* fill 版本 */ }
```

### 5.2 替换映射

按 §1.3 表格逐处替换。替换完成后全项目 grep `<svg` 应该 0 命中（除 `icons.tsx` 和 `BrandLogo.tsx`）。

### 5.3 尺寸标准化

| 图标用途 | 尺寸 |
|---|---|
| Sidebar 导航 Tab（44x44 按钮内） | 20px |
| ChatArea 顶栏按钮（36x36 内） | 18px |
| 列表项辅助图标 | 14px |
| 输入框前缀图标 | 16px |
| 弹窗标题栏关闭按钮 | 14px |
| 徽章内小图标 | 12px |

---

## 六、hover / focus 交互改造（删除所有 JS hover）

### 6.1 删除 `styles/common.ts` 的 `hoverHandlers`

**当前**（`web/src/styles/common.ts:17-31`）：

```ts
export function hoverHandlers(opts?: { hoverBg?: string; leaveBg?: string; }) {
  return {
    onMouseEnter: (e) => { e.currentTarget.style.background = hoverBg; },
    onMouseLeave: (e) => { e.currentTarget.style.background = leaveBg; },
  };
}
```

**问题**：
1. 键盘 Tab 无法触发 hover，键盘用户看不到反馈
2. 每次渲染都创建新函数对象，破坏 memo
3. JS 改 inline style 优先级高于 CSS class，调试困难
4. 同一组件不同实例可能传不同 hoverBg，视觉不一致

**改造**：完全删除该函数，全部改用 CSS class。

### 6.2 在 `index.css` 新增工具类

```css
/* hover-bg —— 默认 hover 背景 */
.hover-bg {
  transition: background-color var(--dur-base) var(--ease);
}
.hover-bg:hover {
  background-color: var(--bg-hover);
}

/* hover-bg-danger —— 删除/退出按钮 hover */
.hover-bg-danger:hover {
  background-color: var(--danger-soft);
  color: var(--danger);
}

/* hover-bg-active —— 列表项 hover（保留选中态） */
.list-item {
  transition: background-color var(--dur-base) var(--ease);
}
.list-item:hover { background-color: var(--bg-hover); }
.list-item.is-active { background-color: var(--bg-active); }
.list-item.is-active:hover { background-color: var(--bg-active); }

/* focus-visible 全局 */
*:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* input focus（保留原有但用 var） */
input:focus, textarea:focus {
  border-color: var(--accent);
  box-shadow: var(--shadow-focus);
  outline: none;
}
```

### 6.3 组件迁移示例

**Sidebar.tsx 退出按钮（before）**：

```tsx
<button
  onClick={logout}
  className="nav-item-qq"
  style={{ color: 'var(--text-muted)' }}
  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'var(--danger)'; }}
  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
>
  <LogoutIcon size={20} />
</button>
```

**after**：

```tsx
<button onClick={logout} className="nav-item-qq hover-bg-danger" title="退出登录">
  <LogoutIcon size={20} />
</button>
```

`nav-item-qq` 类（`index.css:331-352`）已经处理了默认 hover，再加 `hover-bg-danger` 即可。

---

## 七、逐组件改造清单

### 7.1 `Sidebar.tsx`（335 行 → 目标 ~250 行）

#### 当前问题

| 行号 | 问题 |
|---|---|
| 75-80 | Sidebar 宽 64px，但导航按钮 44x44，两侧只剩 10px——可以；但 `py-4`（16px）顶部 + `gap-2`（8px）项目间距，节奏乱 |
| 85 | 分隔线 `<div className="w-8 h-px my-1" />`，`my-1`=4px 太挤 |
| 149-150 | 退出按钮 JS hover（见 §6.3） |
| 162-224 | 搜索弹窗整体 padding `p-5`（20px），但内部 input `<div className="mb-4">`（16px），按钮 `px-4 py-2.5`——按钮文字"搜索"贴 input 边距 8px 太挤 |
| 195-216 | 搜索结果项 `<div className="p-3">`（12px）+ 头像 `w-9 h-9`（36px）+ `<span>` 文字 `gap-3`——头像不在尺寸档（应 36px md 或 28px sm） |
| 277-287 | 选中成员 chip `<span className="px-2 py-1 rounded-md text-xs">`——chip 太小且删除按钮 `<CloseIcon size={10} />` 太小 |
| 295-313 | 候选成员项 `<div className="p-2.5 rounded-lg">`（10px）+ `gap-2`（8px）+ 头像 `w-7 h-7`（28px）—— 28px 不在档（sm 应 28px ✓），但选中态边框 `border: 1px solid var(--accent)` 与未选中 `transparent` 切换会让项跳动 |

#### 改造目标

```
Sidebar 宽度：64px（不变）
导航按钮：44x44，gap 10px（原 gap-2 → gap-2.5）
分隔线：宽 24px，高 1px，my-2（8px 上下）
头像（顶部）：avatar-sm 28px
弹窗：宽 400px（不变），内部 padding 20px，input 与按钮间 gap 10px
弹窗关闭按钮：32x32（w-8 h-8），CloseIcon 14px
搜索结果项：p-3（12px），avatar-md 36px，文字 text-md，"聊天"按钮 hover-bg
创建群聊 chip：px-2.5 py-1.5（10/6px），CloseIcon 12px
候选成员项：p-3（12px），avatar-sm 28px，选中态用 box-shadow 而非 border 避免跳动
```

### 7.2 `ConversationList.tsx`（242 行 → 目标 ~220 行）

#### 当前问题

| 行号 | 问题 |
|---|---|
| 90 | 宽 300px → 改为 320px（与 FriendList 对齐） |
| 96 | `padding: '20px 20px 0'`，但下面 Tab `px-5`（20px），节奏 OK；标题 `<h2>` `fontSize: 20` `marginBottom: 12`——20/12 不连续 |
| 98-112 | 搜索框：左侧 SearchIcon size=16 用 `absolute left-3`（12px），input `pl-9`（36px）—— 图标贴 input 左边 12px，文字距图标 36-16-12=8px ✓ 但 `py-2.5`（10px） OK |
| 109-110 | input 用 JS 改 borderColor / boxShadow，删除 |
| 116 | Tab 栏 `flex gap-5 px-5`（20px gap）—— 20px 太宽 |
| 122-140 | Tab 按钮 `py-3`（12px）+ `borderBottom: 2px solid` 直接画在按钮上，文字下方距下划线 0px（实际是 borderBottom 内嵌）→ **下划线贴文字** |
| 134-138 | Tab 计数徽章 `ml-1.5 px-1.5 py-0.5`（6/6/2px）`text-[10px]`——贴文字贴边 |
| 144 | 列表容器 `padding: 8`（8px）OK |
| 159-167 | 会话项 `padding: 12` + `gap-3`（12px），头像 `w-11 h-11`（44px）不在档；JS hover |
| 192-196 | 未读徽章 `-top-1 -right-1 min-w-[18px] h-[18px] text-[10px] px-1`——18px 高度不在档 |
| 201-209 | 昵称 + 时间戳 `mb-1`（4px）OK；时间戳 `text-xs` |
| 212-218 | 最后消息 `text-xs`，未读用 `fontWeight: 500` 区分——可读但字号偏小 |

#### 改造目标

```
宽度：320px
头部：padding 20px，标题 fontSize 20px marginBottom 12px
搜索框：input py-2.5 px-3 pl-9（保留图标 absolute），CSS focus 态
Tab 栏：px-5 gap-6（24px），按钮 py-3 text-md，
        下划线用伪元素 ::after 单独画（高度 2px，width 100%，margin-top 10px）
        → 解决"文字贴下划线"
Tab 计数徽章：ml-2（8px）px-2 py-0.5（min-height 18px）text-xs
列表项：padding 10px 12px，rounded-md（10px），hover 用 .list-item class
头像：avatar-md 36px（替换 w-11 h-11）
昵称：text-md（14px）fontWeight 600
最后消息：text-sm（12px）
时间戳：text-xs（12px）
未读徽章：min-w 20px height 20px text-xs px-1.5
选中指示条：保留 convo-active-indicator
```

### 7.3 `ChatArea.tsx`（544 行 → 拆分后 ~300 行主 + 子组件）

#### 拆分计划

```
components/chat/
├── ChatHeader.tsx       # 顶栏（avatar + 名称 + 操作按钮组）
├── MessageList.tsx      # 消息区（含时间分隔、空状态）
├── MessageBubble.tsx    # 单条消息气泡（mine/other/system 三态）
├── MessageComposer.tsx  # 底部输入区（toolbar + textarea + send）
├── MessageSearch.tsx    # 顶栏内嵌的消息搜索条
└── MessageContextMenu.tsx # 右键撤回菜单
```

`ChatArea.tsx` 只保留状态编排和布局。

#### 当前问题（重点）

| 行号 | 问题 |
|---|---|
| 220-247 | 空状态：圆图标 `w-20 h-20 rounded-3xl`（80px 圆角 24px）+ `<MessageIcon size={40}>`——尺寸不在档；下方"开始新对话"和提示文字 `mb-1` `mb-6` 跳跃；快捷消息 chip `px-4 py-2` + JS hover |
| 255-326 | 顶栏高度 64px `padding: '0 24px'`（24px ✓），avatar `w-10 h-10 rounded-xl`（40px 不在档），文字区 `gap-3`（12px） + 标题 + 副标题 `marginBottom: 2` 不在网格；操作按钮 `w-9 h-9 rounded-xl`（36px）+ `gap-2`（8px） |
| 364 | 消息容器 `padding: 20, gap: 15`——**15px 不在网格**，改 `gap: 16` 或 `12` |
| 369 | 时间分隔条 `margin: '10px 0'` ✓ |
| 387-398 | 消息行 `gap-2.5`（10px）✓，`maxWidth: '70%'` OK，头像 `w-9 h-9 rounded-xl`（36px ✓ md 档），空位 `<div className="w-9 flex-shrink-0" />` 占位 OK |
| 400-405 | 群昵称 `<span className="text-[11px] ml-1">` —— **11px 不在字号档**，改 12px |
| 407-417 | 气泡 `padding: '12px 16px'` ✓，`borderRadius: '16px 16px 4px 16px'`——**16px 不在圆角档**，改 14px + 4px |
| 423-429 | 时间戳 `text-[10px]`——改 11px；已读 `<span className="ml-1">`（4px）改 8px |
| 466-531 | 输入区 `padding: '16px 24px'` ✓；toolbar 按钮 `toolbar-btn`（CSS 已定义 32x32）+ 三个 raw SVG（表情/图片/文件）→ 替换为 icons.tsx；textarea + 发送按钮 `gap-3`（12px）OK |
| 479-505 | 三个 raw SVG 替换为 SmileIcon / ImageIcon / PaperclipIcon |

#### 改造目标

```
顶栏：height 64px padding 0 24px
       avatar-md 36px（替换 w-10 h-10）
       avatar + 文字 gap-3（12px）
       标题 text-lg lineHeight 1.2
       副标题 text-sm gap-1（4px）
       操作按钮组 gap-2（8px），每按钮 36x36 rounded-md
       按钮 hover 用 .hover-bg
消息区：padding 20px gap 12px（替换 15px）
消息行：gap-2.5（10px）
气泡：padding 10px 14px（替换 12 16），rounded-[14px_14px_4px_14px]（替换 16/4）
       字号 text-md lineHeight 1.5
气泡内时间戳：text-xs（11px）marginLeft 8px
输入区：padding 16px 24px
        toolbar 按钮：32x32 rounded-md，gap 8px
        textarea：rounded-md padding 10px 14px
        发送按钮：44x44 rounded-md（保留 modern-send-btn 类）
空状态：圆 64x64 rounded-full，图标 size 32
```

### 7.4 `FriendList.tsx`（223 行 → 目标 ~200 行）

#### 改造目标

```
宽度：320px（已是）
头部：padding 16px 20px 12px
       标题 text-xl（18px）fontWeight 700 marginBottom 12px
       搜索框：与 ConversationList 完全一致
好友申请区：padding 12px 16px
            标题 text-sm fontWeight 600 + 计数徽章 ml-2
            申请项：padding 10px 12px rounded-md bg-elevated
            申请项 avatar-sm 28px + 文字 gap-3（12px）
            按钮 "同意" px-3 py-1.5（12/6px）min-height 28px
            按钮 "忽略" px-3 py-1.5 同上
好友列表：padding 8px 12px
          列表项：padding 10px 12px rounded-md hover-bg
          avatar-md 36px
          昵称 text-md（14px）
          bio text-sm（12px）muted
右键菜单：min-width 160px padding 4px
          菜单项：padding 8px 16px text-md hover-bg
          分隔线：height 1px my-2
```

### 7.5 `ProfilePanel.tsx`（201 行 → 目标 ~180 行）

#### 改造目标

```
宽度：320px
头部：height 56px padding 0 20px border-bottom
       标题 text-md（14px）fontWeight 600
       关闭按钮 32x32 rounded-md hover-bg，CloseIcon 14px
资料区：padding 24px 20px
        avatar-lg 64px（替换 w-20 h-20）
        圆形头像 rounded-full
        hover "编辑头像"遮罩：camera icon 20px
        昵称：text-xl（18px）mt-4
        username：text-sm mt-1
        bio：text-md mt-3 padding 0 8px
操作区：mt-5
        按钮 "编辑资料" / "发送消息"：px-5 py-2.5 rounded-md
邮箱区：padding 0 20px 20px
        邮箱图标：16px + 文字 text-md gap-3
编辑态：input / textarea padding 10px 14px rounded-md
        按钮 flex gap-2
```

### 7.6 `GroupMembers.tsx`（127 行 → 目标 ~110 行）

#### 改造目标

```
宽度：280px
头部：同 ProfilePanel
列表：padding 8px，列表项间 gap 4px（space-y-1）
       列表项：padding 10px 12px rounded-md hover-bg
       avatar-sm 28px
       昵称：text-md
       角色徽章：ml-2 px-2 py-0.5 min-height 20px text-xs
       踢人按钮：24x24 rounded hover-bg-danger，CloseIcon 12px
底部退出按钮：padding 16px 20px
              按钮：w-full py-2.5 rounded-md bg-danger-soft text-danger
```

### 7.7 `AccountSwitcher.tsx`（262 行）

#### 改造目标

```
入口头像：avatar-sm 28px（替换 w-9 h-9）
账号徽章：min-w 20px height 20px text-xs
账号面板：top 80px left 84px width 280px
         padding 12px
         头部：height 40px padding 0 16px
                标题 text-sm uppercase tracking-wider
                关闭按钮：28x28 hover-bg
         账号项：padding 10px 12px rounded-md hover-bg
                 avatar-sm 28px
                 昵称：text-md
                 username：text-xs（12px）
                 选中态：CheckIcon 16px accent
                 hover 时显示退出按钮：28x28 hover-bg-danger
         分隔线：my-2
         "添加账号"按钮：padding 10px 12px rounded-md hover-bg
                       UserPlusIcon 16px + 文字 gap-3（12px）
添加账号弹窗：width 400px（统一）
              padding 24px
              输入框：padding 12px 16px rounded-md
              提交按钮：padding 12px rounded-md
```

### 7.8 `EmojiPicker.tsx`（43 行）

#### 改造目标

```
宽度：320px
padding：16px
分组间：mb-3（12px）
分组标题：text-xs uppercase mb-2
表情网格：gap 4px
表情按钮：32x32 rounded-md hover-bg text-2xl
```

### 7.9 `Login.tsx`（314 行）—— ⚠️ 基本不动，仅修小问题

> Login 页是设计基准（见 §3.7），**不删除 `--lp-*` 变量，不改配色，不改布局**。只修以下细小问题以遵守 10px 网格和图标系统统一。

#### 仅修这些问题

| 行号 | 问题 | 修复 |
|---|---|---|
| `index.css:588` | `.lp-brand { gap: 14px; }` | 改 `gap: 12px` |
| `index.css:656-658` | `.lp-feature-list { gap: 14px; }` | 改 `gap: 12px` |
| `index.css:663-664` | `.lp-feature-item { gap: 12px; padding: 12px 16px; }` | 保留（已在网格） |
| `index.css:722-724` | `.lp-form-group { margin-bottom: 20px; }` | 保留（已在网格） |
| `Login.tsx:84-95` | brand-logo 内嵌 raw SVG | 抽到 `components/BrandLogo.tsx`，复用 `BrandIcon` |
| `Login.tsx:117-130` | 4 个特性图标 raw SVG path | 用新增的 `BoltIcon` / `ShieldIcon` / `BoxIcon` / `BadgeIcon` 替换 |
| `Login.tsx:283-297` | GitHub / 微信 / QQ raw SVG | 用新增的 `GithubIcon` / `WechatIcon` / `QQIcon` 替换 |
| `index.css:853` | submit-btn box-shadow 用 `rgba(0,212,170,0.3)` 硬编码 | 改用 `var(--shadow-accent)` |

#### 不动的内容

- `--lp-primary: #00d4aa` ✅ 保留（这正是要推广到主界面的颜色）
- `--lp-bg-dark`、`--lp-border` 等 ✅ 保留
- 双面板布局 ✅ 保留
- 粒子、流线边框、光晕、网格背景 ✅ 保留（Login 专属）
- `Inter` / `JetBrains Mono` 字体加载 ✅ 保留

> **目标**：让 Login 页继续是"高级感标杆"，其他页面慢慢向它对齐。

### 7.10 `App.tsx` ErrorBoundary（84 行）

将 `App.tsx:14-67` 的 inline style 改为 CSS 类：

```tsx
// 新增 index.css
.error-boundary {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-base);
  font-family: system-ui;
}
.error-boundary-card {
  text-align: center;
  padding: 48px;
  max-width: 480px;
}
.error-boundary-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg);
  background: var(--danger-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}
.error-boundary-title {
  color: var(--text-primary);
  font-size: var(--font-xl);
  font-weight: 600;
  margin-bottom: 8px;
}
.error-boundary-stack {
  font-size: var(--font-sm);
  color: var(--text-secondary);
  white-space: pre-wrap;
  margin-bottom: 20px;
  background: var(--bg-elevated);
  padding: 12px;
  border-radius: var(--radius-md);
  text-align: left;
}
.error-boundary-retry {
  padding: 10px 24px;
  background: var(--accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-md);
  font-weight: 500;
}
.error-boundary-retry:hover {
  background: var(--accent-hover);
}
```

---

## 八、全局改造任务

### 8.1 重构 `index.css`

**目标**：从 1013 行拆分为 5 个文件：

```
web/src/styles/
├── tokens.css        # 设计变量（颜色、间距、字号、圆角、阴影）—— §3.1-3.6 全部进这里
├── base.css          # reset + body + 字体加载 + 滚动条 + 全局过渡
├── components.css    # 通用组件类（btn / input / list-item / hover-lift / nav-item 等）
├── animations.css    # keyframes + .animate-* 类（含 panel-appear / item-appear）
└── login.css         # ⚠️ Login 页专属样式（保留 lp-* 变量、粒子、流线、光晕、网格背景）
```

`index.css` 只剩 `@import` 5 个文件 + Tailwind：

```css
@import "tailwindcss";
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/components.css";
@import "./styles/animations.css";
@import "./styles/login.css";   /* Login 页专属，最后加载避免覆盖 */
```

#### 关键原则

- **`--lp-*` 变量保留**在 `login.css` 内，**不被删除**——它们是 Login 页的私有 token，独立于全局 `--accent` 等。
- **Login 页用 `--lp-*`**（私有），**主界面用全局 `--accent`**（公共）—— 两套独立但视觉一致（因为 `--lp-primary` 的值 `#00d4aa` 与全局 `--accent` 相同）。
- 全局 `tokens.css` 不依赖 `login.css`，删除 `login.css` 后主界面仍可正常运行（只是 Login 页会丢样式）。
- 如果未来想让 Login 也用全局 token，可以把 `--lp-primary: var(--accent)`，但**本次不做**，避免引入耦合。

### 8.2 删除 `styles/common.ts`

```diff
- web/src/styles/common.ts  （删除整个文件）
```

全部 hover 改用 CSS class（见 §6）。

### 8.3 修复 `index.css` 内部问题

| 问题 | 修复 |
|---|---|
| `index.css:396` `.weather-tag` 类名（用于在线状态） | 改名 `.online-tag` |
| `index.css` 无 `.online-dot` / `.offline-dot` 定义但 ConversationList 引用 | 新增或删除引用 |
| 滚动条 `width: 5px` 太细 | 改 `width: 8px`，加 `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;` |
| 无 `:focus-visible` 全局 | 新增（见 §6.2） |

### 8.4 抽取 `Avatar` 公共组件

当前**每个组件都自己实现一遍**头像 + 颜色 hash + online dot：

```
components/Sidebar.tsx       (AccountSwitcher 内)
components/ConversationList.tsx (10 行颜色池)
components/FriendList.tsx    (10 行颜色池)
components/ProfilePanel.tsx  (10 行颜色池)
components/GroupMembers.tsx  (10 行颜色池)
```

抽取：

```tsx
// web/src/components/Avatar.tsx
interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';   // 28 / 36 / 64
  isOnline?: boolean;
  showOnlineDot?: boolean;
  shape?: 'circle' | 'rounded';
  onClick?: () => void;
}

const COLORS = [
  '#00d4aa',  // mint（主色，第一位）
  '#3b82f6',  // blue
  '#8b5cf6',  // purple
  '#ec4899',  // pink
  '#f59e0b',  // orange
  '#10b981',  // green
  '#06b6d4',  // cyan
  '#6366f1',  // indigo
  '#14b8a6',  // teal
  '#ef4444',  // red（语义色，最后）
];

function hashColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ name, src, size = 'md', isOnline, showOnlineDot, shape = 'rounded', onClick }: AvatarProps) {
  const px = { sm: 28, md: 36, lg: 64 }[size];
  // ... 渲染
}
```

所有组件改用 `<Avatar />`，颜色 hash 函数也只此一处。

### 8.5 抽取 `Modal` 公共组件

当前 4 处弹窗各自实现 mask + 居中 + 关闭：

- `Sidebar.tsx:158-224`（搜索用户）
- `Sidebar.tsx:229-331`（创建群聊）
- `AccountSwitcher.tsx:195-258`（添加账号）

抽取：

```tsx
// web/src/components/Modal.tsx
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;  // 默认 400
}
```

样式统一：mask `rgba(0,0,0,0.45)` + `backdrop-filter: blur(4px)`，弹窗 `padding: 24px`，头部高度 56px 含标题 + 32x32 关闭按钮。

### 8.6 抽取 `Button` 公共组件

当前按钮散落写法几十种：

```tsx
// web/src/components/Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  block?: boolean;  // w-full
}
```

变体：

| variant | bg | color | hover bg |
|---|---|---|---|
| primary | `--accent`（mint） | `--text-on-accent`（深色） | `--accent-hover` |
| secondary | `--bg-elevated` | `--text-primary` | `--bg-hover` |
| ghost | transparent | `--text-secondary` | `--bg-hover` |
| danger | `--danger-soft` | `--danger` | rgba(239,68,68,0.18) |

尺寸：

| size | padding | font | height |
|---|---|---|---|
| sm | 6px 12px | 12px | 28px |
| md | 8px 16px | 14px | 36px |
| lg | 10px 20px | 16px | 44px |

按钮内图标默认与文字 `gap: 8px`，图标尺寸跟随字号（sm=14, md=16, lg=18）。

### 8.7 抽取 `Input` 公共组件

```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix?: React.ReactNode;   // 前置图标
  suffix?: React.ReactNode;   // 后置图标（如密码可见切换）
}
```

统一：高度 40px，padding `10px 14px`，圆角 `--radius-md`，前置图标 `padding-left: 40px`，focus 态 `box-shadow: var(--shadow-focus)`。

---

## 九、实施阶段

### 阶段 0：基线准备（半天）

- [ ] 在 `web/` 跑 `npm run build` 确认当前可构建，截图保存作为 before 对比
- [ ] 创建 `web/src/styles/` 目录，按 §8.1 拆分 `index.css`
- [ ] 写完 §3 的所有 CSS 变量到 `tokens.css`
- [ ] 写完 §6.2 的工具类到 `components.css`
- [ ] **此阶段不改任何业务组件**，确认拆分后页面渲染不变

### 阶段 1：基础设施（1 天）

- [ ] 实现 §8.4 `Avatar` 组件
- [ ] 实现 §8.5 `Modal` 组件
- [ ] 实现 §8.6 `Button` 组件
- [ ] 实现 §8.7 `Input` 组件
- [ ] 扩充 `icons.tsx`（§5.1 新增 12 个图标）
- [ ] 删除 `styles/common.ts`，全部改 CSS class

### 阶段 2：Sidebar + AccountSwitcher（半天）

- [ ] 按 §7.1、§7.7 改造
- [ ] 替换所有 raw SVG
- [ ] 用 `Modal` 替换内嵌弹窗
- [ ] 用 `Button` 替换所有按钮
- [ ] 验收：截图对比，检查 hover / focus / 10px 网格

### 阶段 3：ConversationList + FriendList（半天）

- [ ] 按 §7.2、§7.4 改造
- [ ] 用 `Avatar` 替换头像
- [ ] Tab 下划线改 `::after` 伪元素
- [ ] 验收同上

### 阶段 4：ChatArea 拆分 + 改造（1.5 天）

- [ ] 按 §7.3 拆分到 `components/chat/`
- [ ] 改造 MessageBubble（最关键，影响主体验）
- [ ] 改造 MessageComposer（含 Emoji / File / Send）
- [ ] 改造 ChatHeader
- [ ] 验收：发送消息、撤回、搜索、表情、上传 5 条路径

### 阶段 5：ProfilePanel + GroupMembers + EmojiPicker（半天）

- [ ] 按 §7.5、§7.6、§7.8 改造

### 阶段 6：Login + ErrorBoundary（半天）

- [ ] 按 §7.9、§7.10 改造
- [ ] 删除 `--lp-*` 变量，统一到主色

### 阶段 7：全局回归（半天）

- [ ] grep `<svg` 应该 0 命中（白名单：icons.tsx, BrandLogo.tsx）
- [ ] grep `onMouseEnter` 应该 0 命中
- [ ] grep `text-\[` 应该 0 命中（除 `text-[0]` 这种特殊用法）
- [ ] grep `#[0-9a-fA-F]{3,6}` 在 .tsx 中应该 0 命中（颜色都用 var）
- [ ] 浏览器实测：登录→发消息→撤回→创建群→加好友→切账号→退出
- [ ] Lighthouse 跑分对比
- [ ] 截图存档 after

**预计总工期：4.5 天**

---

## 十、验收清单

### 10.1 自动化检查（grep 必须为 0）

```bash
# 1. 组件内不允许直接写 svg（除 icons.tsx 和 BrandLogo.tsx）
grep -rn "<svg" web/src/components web/src/pages \
  --include="*.tsx" \
  | grep -v "icons.tsx" \
  | grep -v "BrandLogo.tsx"

# 2. 不允许 JS hover
grep -rn "onMouseEnter" web/src --include="*.tsx"

# 3. 不允许硬编码颜色
grep -rn "#[0-9a-fA-F]\{3,6\}" web/src --include="*.tsx"

# 4. 不允许不在网格上的 Tailwind 间距
grep -rnE "(p|m|gap)-(0\.5|3\.5|7|9|11|13|17|19)" web/src --include="*.tsx"

# 5. 不允许不在网格上的字号
grep -rnE "text-\[(10|11|13|15|17|19|21)px\]" web/src --include="*.tsx"

# 6. 不允许 hoverHandlers 引用
grep -rn "hoverHandlers" web/src
```

### 10.2 手动验收（浏览器）

| # | 检查项 | 通过标准 |
|---|---|---|
| V1 | 全站间距节奏 | 用 DevTools 量任意相邻元素间距，必须是 4/8/10/12/16/20/24/32/40/48 之一 |
| V2 | 文字与边框 | 任何可见文字距其容器边 ≥ 10px |
| V3 | 图标与文字 | 任何图标与相邻文字 ≥ 8px gap |
| V4 | 图标尺寸 | 所有图标尺寸 ∈ {12, 14, 16, 18, 20} |
| V5 | 头像尺寸 | 所有头像 ∈ {28, 36, 64} |
| V6 | 圆角 | 所有圆角 ∈ {6, 10, 14, full} |
| V7 | hover 一致性 | 鼠标悬停所有可点击元素，反馈一致（颜色 + 过渡） |
| V8 | 键盘可达 | Tab 键遍历所有交互元素，每个都有 focus-visible 环 |
| V9 | 颜色统一 | 登录页与主界面同色系（mint `#00d4aa` 为主色） |
| V10 | 三栏布局对齐 | Sidebar(64) + List(320) + ChatArea 三栏顶/底对齐 |
| V11 | 切账号 | 切账号后 UI 不抖动、消息列表正确刷新 |
| V12 | 暗色对比度 | 所有文字与背景对比度 ≥ 4.5:1（WCAG AA） |

### 10.3 验收命令

```bash
cd web
npm run build         # 必须无 TS 错误、无 lint 错误
npm run dev           # 启动后人工走查 V1-V12
```

---

## 附录 A：常用间距速查

| 场景 | 推荐值 | Tailwind | CSS |
|---|---|---|---|
| 主按钮 padding | 10 / 20 | py-2.5 px-5 | `10px 20px` |
| 次按钮 padding | 8 / 16 | py-2 px-4 | `8px 16px` |
| 输入框 padding | 10 / 14 | py-2.5 px-3.5 | `10px 14px` |
| 列表项 padding | 10 / 12 | py-2.5 px-3 | `10px 12px` |
| 卡片 padding | 16 | p-4 | `16px` |
| 面板 padding | 20 | p-5 | `20px` |
| 按钮组 gap | 8 | gap-2 | `8px` |
| 头像 + 文字 gap | 12 | gap-3 | `12px` |
| 表单分组 mb | 20 | mb-5 | `20px` |
| 区块间 gap | 32 | gap-8 | `32px` |

## 附录 B：图标 + 文字组合速查

```tsx
// 按钮：图标 + 文字
<Button variant="primary" icon={<SearchIcon size={16} />}>搜索</Button>

// 列表项：头像 + 主标题 + 副标题
<div className="flex items-center gap-3 p-3">
  <Avatar name="张三" size="md" />
  <div className="flex flex-col gap-1">
    <span className="text-md font-medium">张三</span>
    <span className="text-sm text-muted">最后消息</span>
  </div>
</div>

// 顶栏：标题 + 操作按钮
<div className="flex items-center justify-between px-5 h-16">
  <h2 className="text-lg font-semibold">消息</h2>
  <div className="flex items-center gap-2">
    <Button variant="ghost" size="sm" icon={<MoreIcon size={16} />} aria-label="更多" />
  </div>
</div>
```

---

**文档版本**：v1.0
**编写者**：Claude（基于 2026-06-18 代码快照）
**下一步**：与产品/设计 review 本计划书 → 进入阶段 0
