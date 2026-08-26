// 通话（语音/视频/拒绝/忙线）+ 更多菜单 + 既有图标回归测试
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = fileURLToPath(new URL('./', import.meta.url));
const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080';
let passed = 0;
let failed = 0;
const failures = [];
const check = (name, cond, detail = '') => {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; failures.push({ name, detail }); console.log(`  FAIL  ${name}  ${detail}`); }
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function ensureUser(username, nickname) {
  const reg = await api('/api/auth/register', { method: 'POST', body: { username, password: 'secret123', nickname } });
  if (reg.status === 201) return reg.data;
  return (await api('/api/auth/login', { method: 'POST', body: { username, password: 'secret123' } })).data;
}

const stamp = Date.now().toString().slice(-6);
const P = await ensureUser(`ic_p_${stamp}`, 'IC-Peter');
const Q = await ensureUser(`ic_q_${stamp}`, 'IC-Quinn');
const R = await ensureUser(`ic_r_${stamp}`, 'IC-Rita');
console.log(`用户: ${P.user.nickname} / ${Q.user.nickname} / ${R.user.nickname}\n`);

// 关系：P-Q 好友+私聊；R-Q 好友+私聊；P 建群(含 Q、R)
const pqReq = await api('/api/friends/request', { method: 'POST', token: P.token, body: { to_user_id: Q.user.id } });
const qReqs = await api('/api/friends/requests', { token: Q.token });
const pqPending = qReqs.data.find((r) => r.from_user.id === P.user.id);
if (pqPending) await api(`/api/friends/requests/${pqPending.id}`, { method: 'PUT', token: Q.token, body: { action: 'accept' } });
const rqReq = await api('/api/friends/request', { method: 'POST', token: R.token, body: { to_user_id: Q.user.id } });
const qReqs2 = await api('/api/friends/requests', { token: Q.token });
const rqPending = qReqs2.data.find((r) => r.from_user.id === R.user.id);
if (rqPending) await api(`/api/friends/requests/${rqPending.id}`, { method: 'PUT', token: Q.token, body: { action: 'accept' } });
const pqConvo = (await api('/api/conversations', { method: 'POST', token: P.token, body: { user_id: Q.user.id } })).data;
const rqConvo = (await api('/api/conversations', { method: 'POST', token: R.token, body: { user_id: Q.user.id } })).data;
const groupRes = (await api('/api/groups', { method: 'POST', token: P.token, body: { name: 'IC测试群', member_ids: [Q.user.id, R.user.id] } })).data;

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  defaultViewport: { width: 1500, height: 940 },
});
const ctxP = await browser.createBrowserContext();
const ctxQ = await browser.createBrowserContext();
const ctxR = await browser.createBrowserContext();
const pP = await ctxP.newPage();
const pQ = await ctxQ.newPage();
const pR = await ctxR.newPage();
const errs = { P: [], Q: [], R: [] };
const hookErrors = (page, key) => {
  page.on('console', (m) => { if (m.type() === 'error') errs[key].push(m.text()); });
  page.on('pageerror', (e) => errs[key].push(String(e)));
};
hookErrors(pP, 'P'); hookErrors(pQ, 'Q'); hookErrors(pR, 'R');

async function login(page, acc) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('golang_qq_accounts', JSON.stringify({ accounts: [{ userId: user.id, token, user }], activeId: user.id }));
  }, acc);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2200));
}

async function openPrivateChat(page, nickname) {
  const clicked = await page.evaluate((name) => {
    const rows = [...document.querySelectorAll('.conversation-pane div[style*="padding: 12px"]')];
    const row = rows.find((el) => el.textContent?.includes(name)) ?? rows[0];
    if (row) { row.click(); return true; }
    return false;
  }, nickname);
  await new Promise((r) => setTimeout(r, 1200));
  return clicked;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitOverlayGone(page, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const gone = await page.evaluate(() => !document.querySelector('.fixed.inset-0.z-\\[100\\]'));
    if (gone) return true;
    await wait(300);
  }
  return false;
}

console.log('=== 1. 语音通话：呼叫 → 接听 → 通话中 → 挂断 ===\n');
await login(pP, { token: P.token, user: P.user });
await login(pQ, { token: Q.token, user: Q.user });
check('P 打开与 Q 的私聊', await openPrivateChat(pP, 'IC-Quinn'));
await pP.click('button[title="语音通话"]');
await wait(1200);
check('P 显示"正在呼叫..."', await pP.evaluate(() => document.body.textContent.includes('正在呼叫')));
check('Q 收到来电并显示接听/拒绝', await pQ.evaluate(() => document.body.textContent.includes('邀请你进行语音通话')
  && !!document.querySelector('button[title="接听"]') && !!document.querySelector('button[title="拒绝"]')));
await pQ.screenshot({ path: OUT + 'call-1-incoming.png' });
await pQ.click('button[title="接听"]');
await wait(2500);
check('P 进入通话中', await pP.evaluate(() => document.body.textContent.includes('通话中')));
check('Q 进入通话中', await pQ.evaluate(() => document.body.textContent.includes('通话中')));
await pP.screenshot({ path: OUT + 'call-2-active.png' });
await pP.click('button[title="挂断"]');
await wait(1200);
check('P 显示通话已结束', await pP.evaluate(() => document.body.textContent.includes('通话已结束')));
check('Q 显示通话已结束', await pQ.evaluate(() => document.body.textContent.includes('通话已结束')));
await wait(3200);
check('结束提示自动消失（回到空闲）', !(await pP.evaluate(() => document.body.textContent.includes('通话已结束'))));

console.log('\n=== 2. 拒绝通话 ===\n');
await pP.click('button[title="语音通话"]');
await wait(1200);
await pQ.click('button[title="拒绝"]');
await wait(1200);
check('P 显示对方拒绝', await pP.evaluate(() => document.body.textContent.includes('对方拒绝了通话')));
await wait(3200);

console.log('\n=== 3. 忙线：Q 通话中，R 呼叫 Q 被自动拒绝 ===\n');
await login(pR, { token: R.token, user: R.user });
await openPrivateChat(pR, 'IC-Quinn');
await pR.click('button[title="语音通话"]');
await wait(1200);
await pQ.click('button[title="接听"]');
await wait(2500);
// Q 正在与 R 通话，空闲的 P 呼叫 Q → 应提示忙线
await openPrivateChat(pP, 'IC-Quinn');
await pP.click('button[title="语音通话"]');
await wait(1000);
check('P 显示对方忙线', await pP.evaluate(() => document.body.textContent.includes('对方忙线中')));
await pP.screenshot({ path: OUT + 'call-3-busy.png' });
await pR.click('button[title="挂断"]');
await wait(1500);

console.log('\n=== 4. 视频通话 ===\n');
await openPrivateChat(pP, 'IC-Quinn');
await pP.click('button[title="视频通话"]');
await wait(1200);
check('Q 收到视频通话邀请', await pQ.evaluate(() => document.body.textContent.includes('邀请你进行视频通话')));
await pQ.click('button[title="接听"]');
await wait(2500);
check('P 通话中（视频）', await pP.evaluate(() => document.body.textContent.includes('通话中')));
check('Q 通话中（视频）', await pQ.evaluate(() => document.body.textContent.includes('通话中')));
const hasVideo = await pP.evaluate(() => !!document.querySelector('video'));
check('P 页面存在视频元素', hasVideo);
await pP.screenshot({ path: OUT + 'call-4-video.png' });
await pQ.click('button[title="挂断"]');
await wait(1500);
await waitOverlayGone(pP);

console.log('\n=== 5. 群聊通话提示 ===\n');
await openPrivateChat(pP, 'IC测试群');
await pP.click('button[title="语音通话"]');
await wait(600);
check('群聊点通话出现提示', await pP.evaluate(() => document.body.textContent.includes('群聊暂不支持通话')));
await wait(3000);

console.log('\n=== 6. 更多菜单：添加好友 / 发起群聊 / 标为已读 / 清空记录 ===\n');
await openPrivateChat(pP, 'IC-Quinn');
await waitOverlayGone(pP);
await pP.click('button[title="更多操作"]');
await wait(600);
const menuText = await pP.evaluate(() => {
  const menus = [...document.querySelectorAll('div')].filter((d) => d.className.includes('absolute right-0') && d.querySelectorAll('button').length >= 4);
  return menus[menus.length - 1]?.textContent ?? '';
});
check('更多菜单包含 4 项', ['发起群聊', '添加好友', '标为已读', '清空聊天记录'].every((t) => menuText.includes(t)), menuText.slice(0, 80));
await pP.evaluate(() => {
  const menus = [...document.querySelectorAll('div')].filter((d) => d.className.includes('absolute right-0'));
  const el = menus[menus.length - 1];
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === '添加好友')?.click();
});
await wait(800);
check('添加好友弹窗打开', await pP.evaluate(() => !!document.querySelector('input[placeholder="输入用户名或昵称"]')));
await pP.evaluate(() => { document.querySelector('.fixed.inset-0')?.click(); });
await wait(500);
await pP.click('button[title="更多操作"]');
await wait(600);
await pP.evaluate(() => {
  const menus = [...document.querySelectorAll('div')].filter((d) => d.className.includes('absolute right-0'));
  const el = menus[menus.length - 1];
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === '发起群聊')?.click();
});
await wait(800);
check('发起群聊弹窗打开', await pP.evaluate(() => document.body.textContent.includes('创建群聊')));
await pP.evaluate(() => { document.querySelector('.fixed.inset-0')?.click(); });
await wait(500);

// 发送一条消息 → 清空聊天记录
await pP.type('textarea', '这是要清空的测试消息');
await pP.click('button[title="发送"]');
await wait(1500);
const msgShown = await pP.evaluate(() => document.body.textContent.includes('这是要清空的测试消息'));
check('消息发送成功（回归）', msgShown);
await pP.click('button[title="更多操作"]');
await wait(600);
await pP.evaluate(() => {
  const menus = [...document.querySelectorAll('div')].filter((d) => d.className.includes('absolute right-0'));
  const el = menus[menus.length - 1];
  [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === '清空聊天记录')?.click();
});
await wait(1000);
check('清空后消息消失', !(await pP.evaluate(() => document.body.textContent.includes('这是要清空的测试消息'))));
check('清空提示出现', await pP.evaluate(() => document.body.textContent.includes('已清空当前会话记录')));
await wait(3000);

console.log('\n=== 7. 既有图标回归：表情 / 图片 / 文件 / 搜索消息 ===\n');
await pP.click('button[title="表情"]');
await wait(800);
check('表情面板打开', await pP.evaluate(() => document.body.textContent.includes('手势')));
await pP.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === '😀');
  btn?.click();
});
await wait(500);
check('选择表情后输入框有内容', (await pP.$eval('textarea', (el) => el.value)).includes('😀'));
await pP.evaluate(() => {
  window.__spyFileClicks = [];
  const input = document.querySelector('input[type="file"]');
  if (input) input.addEventListener('click', () => window.__spyFileClicks.push('clicked'), { once: true });
});
await pP.click('button[title="图片"]');
await wait(400);
check('图片按钮触发文件选择', await pP.evaluate(() => window.__spyFileClicks.length > 0));
await pP.click('button[title="文件"]');
await wait(400);
check('文件按钮触发文件选择', await pP.evaluate(() => window.__spyFileClicks.length > 0));
await pP.type('textarea', '搜索目标消息ABC');
await pP.click('button[title="发送"]');
await wait(1200);
await pP.click('button[title="搜索消息"]');
await wait(500);
await pP.type('input[placeholder="搜索消息..."]', 'ABC');
await pP.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '搜索')?.click();
});
await wait(1200);
check('消息搜索有结果', await pP.evaluate(() => document.body.textContent.includes('搜索目标消息ABC')));

console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====`);
if (failures.length) {
  console.log('失败用例:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
}
for (const [k, list] of Object.entries(errs)) {
  if (list.length) console.log(`页面 ${k} 控制台错误:`, list.slice(0, 5));
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);
