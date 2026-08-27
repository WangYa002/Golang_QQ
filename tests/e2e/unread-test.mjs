// DOM 级验证：红点元素真实消失 + 重复群会话检查
import puppeteer from 'puppeteer-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080';
const WS = 'ws://localhost:8080/ws';
let passed = 0, failed = 0;
const check = (n, c, d = '') => { if (c) { passed++; console.log('  PASS  ' + n); } else { failed++; console.log('  FAIL  ' + n + '  ' + d); } };

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function loginUser(username, password) {
  return (await api('/api/auth/login', { method: 'POST', body: { username, password } })).data;
}
function wsSend(token, payload) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}?token=${token}`);
    ws.onopen = () => {
      ws.send(JSON.stringify(payload));
      setTimeout(() => { ws.close(); resolve(); }, 400);
    };
  });
}

const alice = await loginUser('alice_demo', 'secret123');
const bob = await loginUser('bob_demo', 'secret123');
const convos = (await api('/api/conversations', { token: alice.token })).data;
const groups = convos.filter((c) => c.type === 'group');
console.log('群会话数量:', groups.length, groups.map((g) => g.id));
check('不存在重复群会话', groups.length <= 1, `count=${groups.length}`);
const group = groups[0];
const privateC = convos.find((c) => c.type === 'private');

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 1500, height: 940 } });
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'networkidle0' });
await page.evaluate(({ token, user }) => {
  localStorage.setItem('golang_qq_accounts', JSON.stringify({ accounts: [{ userId: user.id, token, user }], activeId: user.id }));
}, { token: alice.token, user: alice.user });
await page.reload({ waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));

const groupBadge = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.conversation-pane div[style*="padding: 12px"]')];
  const row = rows.find((el) => /运动|小分队/.test(el.textContent || ''));
  if (!row) return null;
  const badge = row.querySelector('[class*="min-w-["]');
  return badge ? badge.textContent?.trim() : null;
});
const navBadge = () => page.evaluate(() => document.querySelector('button[aria-label="消息"] .nav-badge')?.textContent?.trim() ?? null);

// 打开私聊
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.conversation-pane div[style*="padding: 12px"]')];
  rows.find((el) => el.textContent?.includes('Bob'))?.click();
});
await new Promise((r) => setTimeout(r, 1200));
// B 连发 3 条群消息
for (let i = 0; i < 3; i++) {
  await wsSend(bob.token, { type: 'chat', data: { conversation_id: group.id, type: 'text', content: `U${i}-${Date.now().toString().slice(-5)}` } });
  await new Promise((r) => setTimeout(r, 300));
}
await new Promise((r) => setTimeout(r, 1800));
console.log('收到 3 条群消息后：群行徽章 =', await groupBadge(), '| 消息 nav 徽章 =', await navBadge());

// 真实鼠标点击群行
const box = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.conversation-pane div[style*="padding: 12px"]')];
  const row = rows.find((el) => /运动|小分队/.test(el.textContent || ''));
  const r = row?.getBoundingClientRect();
  return r ? { x: r.x + 80, y: r.y + r.height / 2 } : null;
});
await page.mouse.click(box.x, box.y);
await new Promise((r) => setTimeout(r, 1800));
console.log('点开群后：群行徽章 =', await groupBadge(), '| 消息 nav 徽章 =', await navBadge());
check('点开群后群行红点消失', (await groupBadge()) === null);
check('点开群后消息 nav 红点消失', (await navBadge()) === null);

// 正在群里时来消息 → 不应出现红点
await wsSend(bob.token, { type: 'chat', data: { conversation_id: group.id, type: 'text', content: 'U3-' + Date.now().toString().slice(-5) } });
await new Promise((r) => setTimeout(r, 1800));
console.log('群里来消息后：群行徽章 =', await groupBadge(), '| nav =', await navBadge());
check('正在群里时来消息不产生红点', (await groupBadge()) === null);

// 切到联系人页，B 再发消息 → 当前应记未读（真实缺口场景）
await page.click('button[aria-label="联系人"]');
await new Promise((r) => setTimeout(r, 1000));
await wsSend(bob.token, { type: 'chat', data: { conversation_id: group.id, type: 'text', content: 'U4-' + Date.now().toString().slice(-5) } });
await new Promise((r) => setTimeout(r, 1800));
const storeUnread = await page.evaluate(async () => {
  const m = await import('/src/store/chat.ts');
  return { ...m.useChatStore.getState().unreadCount };
});
console.log('联系人页收到群消息后 store unread =', JSON.stringify(storeUnread));
check('离开会话后收消息计入未读', Object.values(storeUnread).reduce((a, b) => a + b, 0) >= 1, JSON.stringify(storeUnread));
// 切回消息页点开群 → 清除
await page.click('button[aria-label="消息"]');
await new Promise((r) => setTimeout(r, 1000));
const box2 = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.conversation-pane div[style*="padding: 12px"]')];
  const row = rows.find((el) => /运动|小分队/.test(el.textContent || ''));
  const r = row?.getBoundingClientRect();
  return r ? { x: r.x + 80, y: r.y + r.height / 2 } : null;
});
await page.mouse.click(box2.x, box2.y);
await new Promise((r) => setTimeout(r, 1800));
check('联系人页消息后点开群红点消失', (await groupBadge()) === null);

console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
