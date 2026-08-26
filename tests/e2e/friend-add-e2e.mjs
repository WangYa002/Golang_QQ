// 端到端：UI 发起加好友 → 对方接受 → 双方实时成为好友（双浏览器上下文）
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./', import.meta.url));
const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080';
let passed = 0;
let failed = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}  ${detail}`); }
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const stamp = Date.now().toString().slice(-6);
const xReg = await api('/api/auth/register', { method: 'POST', body: { username: `e2e_x_${stamp}`, password: 'secret123', nickname: 'E2E-Xavier' } });
const yReg = await api('/api/auth/register', { method: 'POST', body: { username: `e2e_y_${stamp}`, password: 'secret123', nickname: 'E2E-Yolanda' } });
const X = xReg.data;
const Y = yReg.data;
console.log(`用户: ${X.user.username} (X) / ${Y.user.username} (Y)\n`);

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 1500, height: 940 } });
const ctxX = await browser.createBrowserContext();
const ctxY = await browser.createBrowserContext();
const px = await ctxX.newPage();
const py = await ctxY.newPage();

async function login(page, acc) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('golang_qq_accounts', JSON.stringify({ accounts: [{ userId: user.id, token, user }], activeId: user.id }));
  }, acc);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2200));
}

async function openAddFriend(page, query) {
  await page.click('button[aria-label="添加好友"]');
  await new Promise((r) => setTimeout(r, 600));
  await page.type('input[placeholder="输入用户名或昵称"]', query);
  const btns = await page.$$('button');
  for (const b of btns) {
    const t = await b.evaluate((el) => el.textContent?.trim());
    if (t === '搜索') { await b.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 1200));
}

console.log('=== E2E-1: X 在 UI 搜索 Y 并发起好友申请 ===\n');
await login(px, { token: X.token, user: X.user });
await openAddFriend(px, Y.user.username);
const btns1 = await px.evaluate(() => {
  const items = [...document.querySelectorAll('body > div div')].filter((el) => el.textContent?.includes('E2E-Yolanda'));
  const container = items.find((el) => el.querySelectorAll('button').length >= 2) ?? document.body;
  return [...container.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean);
});
check('搜索结果出现"加好友"按钮', btns1.includes('加好友'), JSON.stringify(btns1));
check('搜索结果同时有"聊天"按钮', btns1.includes('聊天'), JSON.stringify(btns1));

await px.evaluate(() => {
  const items = [...document.querySelectorAll('body > div div')];
  const container = items.find((el) => el.textContent?.includes('E2E-Yolanda') && el.querySelectorAll('button').length >= 2);
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === '加好友')?.click();
});
await new Promise((r) => setTimeout(r, 1200));
const sentState = await px.evaluate(() => document.body.textContent?.includes('已发送') ?? false);
check('点击后按钮变为"已发送"', sentState);
const pending = await api('/api/friends/requests', { token: Y.token });
check('后端 Y 收到 1 条 pending 申请', pending.data.length === 1, `count=${pending.data.length}`);

// 重复点：重新搜索，按钮应为"已发送"且不产生新申请
await px.click('.fixed.inset-0').catch(() => {});
await px.click('button[aria-label="添加好友"]').catch(() => {});
await new Promise((r) => setTimeout(r, 500));
await openAddFriend(px, Y.user.username);
const dupState = await px.evaluate(() => {
  const items = [...document.querySelectorAll('body > div div')];
  const container = items.find((el) => el.textContent?.includes('E2E-Yolanda') && el.querySelectorAll('button').length >= 2);
  return container ? container.textContent ?? '' : '';
});
check('重复搜索显示"已发送"而非"加好友"', dupState.includes('已发送') && !dupState.includes('加好友'), dupState.slice(0, 120));
const pending2 = await api('/api/friends/requests', { token: Y.token });
check('重复操作未产生新申请（仍为 1 条）', pending2.data.length === 1, `count=${pending2.data.length}`);
await px.screenshot({ path: OUT + 'e2e-1-sent.png' });
// 关闭 X 的搜索弹窗，回到聊天页
await px.evaluate(() => { document.querySelector('.fixed.inset-0')?.click(); });
await new Promise((r) => setTimeout(r, 600));

console.log('\n=== E2E-2: Y 登录收到申请 → 同意 → 双方实时成为好友 ===\n');
await login(py, { token: Y.token, user: Y.user });
const badgeY = await py.evaluate(() => document.querySelector('button[aria-label="联系人"] .nav-badge')?.textContent?.trim() ?? null);
check('Y 登录后联系人徽章 = 1（无需先打开联系人页）', badgeY === '1', `badge=${badgeY}`);
await py.click('button[aria-label="联系人"]');
await new Promise((r) => setTimeout(r, 1200));
const cardVisible = await py.evaluate(() => document.body.textContent?.includes('E2E-Xavier') ?? false);
check('Y 联系人页显示 X 的申请卡片', cardVisible);
// 监听 X 页面在 Y 接受后是否自动请求 /api/friends（WS friend_accepted 触发）
const xFriendRequests = [];
const cdp = await px.createCDPSession();
await cdp.send('Network.enable');
cdp.on('Network.requestWillBeSent', (e) => {
  if (e.request.url.includes('/api/friends')) xFriendRequests.push(e.request.url);
});
await py.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '同意')?.click();
});
await new Promise((r) => setTimeout(r, 1500));
check('X 页面自动请求 /api/friends（WS 推送触发刷新）', xFriendRequests.length > 0, `count=${xFriendRequests.length}`);
const yFriend = await py.evaluate(() => document.querySelector('.contacts-pane')?.textContent?.includes('E2E-Xavier') ?? false);
check('同意后 Y 好友列表出现 X', yFriend);
await py.screenshot({ path: OUT + 'e2e-2-accepted.png' });

// X 打开联系人页，好友列表应包含 Y
await px.click('button[aria-label="联系人"]');
await new Promise((r) => setTimeout(r, 1500));
const xFriend = await px.evaluate(() => document.querySelector('.contacts-pane')?.textContent?.includes('E2E-Yolanda') ?? false);
check('X 联系人页好友列表出现 Y', xFriend);

const xb = await api('/api/friends', { token: X.token });
const yb = await api('/api/friends', { token: Y.token });
check('后端双向好友关系成立', xb.data.some((f) => f.user.id === Y.user.id) && yb.data.some((f) => f.user.id === X.user.id));

console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
