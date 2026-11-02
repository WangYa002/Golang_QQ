# E2E 测试脚本

基于无头 Edge + puppeteer-core 的自动化测试，覆盖好友功能与通话/图标功能。

## 前置条件

1. MongoDB（默认 `localhost:27017`）、后端（`:8080`）、前端 dev server（`:5173`）已启动。
2. 安装依赖（在 `tests/e2e` 目录）：

   ```bash
   npm init -y
   npm install puppeteer-core
   ```

3. 脚本内的 Edge 路径按需修改（默认 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`）。

## 运行

```bash
node friend-api-test.mjs   # 后端好友 API 矩阵（25 例）
node friend-add-e2e.mjs    # 端到端：UI 发起加好友 → 接受 → WS 实时刷新（12 例）
node call-more-test.mjs    # 语音/视频通话、拒绝/忙线、更多菜单、确认弹窗、图标回归（27 例）
node admin-test.mjs        # 管理后台：入口、统计、六张表、搜索、分页、权限（16 例）
node unread-test.mjs       # 未读红点：计数/清零/查看中不计数/联系人页计数（6 例）
node visual-check.mjs      # 视觉验收：新登录页表单真实登录 + squircle 头像 + 死按钮禁用态
```

> 浏览器套件默认访问 `http://localhost:5173`。若该端口被其他项目占用
> （如另一个 Vite 绑在 `::1`），用环境变量指定 QQ 前端实际地址：
>
> ```bash
> BASE_URL=http://127.0.0.1:5173 node call-more-test.mjs
> ```

脚本会自建测试账号与数据（`*_<时间戳>`），不影响已有数据。退出码非 0 表示有用例失败。

登录态注入方式（与多窗口多账号存储方案一致）：写
`localStorage['golang_qq_accounts']`（含 `lastActive`）**和**
`sessionStorage['golang_qq_active']`，缺一会回到登录页。

`admin-test.mjs` 依赖 `server/.env` 中 `ADMIN_USERNAME` 配置的管理员账号
（默认 `alice_demo` / `secret123`）。

## 说明

- `call-more-test.mjs` 需要浏览器支持音视频：已内置
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` 假设备参数。
- 通话信令走 WebSocket（`call` / `call_event`），WebRTC 媒体走浏览器点对点。
