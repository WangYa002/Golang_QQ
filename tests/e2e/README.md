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
node call-more-test.mjs    # 语音/视频通话、拒绝/忙线、更多菜单、图标回归（26 例）
node admin-test.mjs        # 管理后台：入口、统计、六张表、搜索、分页、权限（16 例）
node unread-test.mjs       # 未读红点：计数/清零/查看中不计数/联系人页计数（6 例）
```

脚本会自建测试账号与数据（`*_<时间戳>`），不影响已有数据。退出码非 0 表示有用例失败。

`admin-test.mjs` 依赖 `server/.env` 中 `ADMIN_USERNAME` 配置的管理员账号
（默认 `alice_demo` / `secret123`）。

## 说明

- `call-more-test.mjs` 需要浏览器支持音视频：已内置
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` 假设备参数。
- 通话信令走 WebSocket（`call` / `call_event`），WebRTC 媒体走浏览器点对点。
