// 管理后台 UI 测试：入口 / 统计 / 六张表 / 搜索 / 分页 / 权限
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

async function loginApi(username, password) {
  const res = await fetch(API + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

const browser = await puppeteer.launch({ executablePath: EDGE, headless: 'new', defaultViewport: { width: 1500, height: 940 } });
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

async function loginPage(acc) {
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('golang_qq_accounts', JSON.stringify({ accounts: [{ userId: user.id, token, user }], activeId: user.id }));
  }, acc);
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
}

const alice = await loginApi('alice_demo', 'secret123');

console.log('\n=== 1. 管理员入口与统计 ===\n');
await loginPage(alice);
const hasAdminBtn = await page.evaluate(() => !!document.querySelector('button[aria-label="管理后台"]'));
check('侧边栏显示"管理后台"按钮（管理员）', hasAdminBtn);
await page.click('button[aria-label="管理后台"]');
await new Promise((r) => setTimeout(r, 1800));
const statsText = await page.evaluate(() => document.body.textContent);
check('显示"管理后台"标题', statsText.includes('管理后台'));
check('显示"用户总数"统计卡片', statsText.includes('用户总数'));
check('统计数值 > 0（用户总数）', /用户总数/.test(statsText) && parseInt(statsText.match(/([\d,]+)\s*用户总数/)?.[1]?.replace(/,/g, '') || '0', 10) > 0);
await page.screenshot({ path: OUT + 'admin-1-stats.png' });

console.log('\n=== 2. 用户表（默认 Tab） ===\n');
const userRows = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('tbody tr')];
  return rows.slice(0, 3).map((r) => r.textContent?.trim().slice(0, 60));
});
check('用户表渲染出数据行', userRows.length >= 1 && userRows[0].length > 0, JSON.stringify(userRows));
// 搜索管理员账号，验证角色徽章列
await page.type('input[placeholder="搜索用户名/昵称/邮箱"]', 'alice_demo');
await new Promise((r) => setTimeout(r, 1200));
check('管理员用户行显示"管理员"角色徽章', await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('alice_demo'));
  return !!tr && tr.textContent.includes('管理员');
}));
await page.evaluate(() => {
  const input = document.querySelector('input[placeholder="搜索用户名/昵称/邮箱"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 1200));

console.log('\n=== 3. 其余五张表 ===\n');
const tabs = [
  ['会话', '会话数'],
  ['消息', '发送者'],
  ['群聊', '群主'],
  ['好友', '好友'],
  ['好友申请', '发起人'],
];
for (const [label, expectCol] of tabs) {
  await page.evaluate((t) => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === t)?.click();
  }, label);
  await new Promise((r) => setTimeout(r, 1200));
  const txt = await page.evaluate(() => document.body.textContent);
  check(`${label}表渲染`, txt.includes(expectCol) && /共 \d+ 条/.test(txt));
}
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '消息')?.click();
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: OUT + 'admin-2-messages.png' });

console.log('\n=== 4. 搜索与分页 ===\n');
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '用户')?.click();
});
await new Promise((r) => setTimeout(r, 1000));
await page.type('input[placeholder="搜索用户名/昵称/邮箱"]', 'alice_demo');
await new Promise((r) => setTimeout(r, 1200));
const filtered = await page.evaluate(() => document.body.textContent);
check('搜索"alice_demo"只显示匹配结果', filtered.includes('共 1 条'), filtered.match(/共 \d+ 条/)?.[0]);
await page.evaluate(() => {
  const input = document.querySelector('input[placeholder="搜索用户名/昵称/邮箱"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 1200));
const totalText = await page.evaluate(() => document.body.textContent.match(/共 ([\d,]+) 条/)?.[1]?.replace(/,/g, ''));
const total = parseInt(totalText || '0', 10);
check('清除搜索恢复全量', total > 5, `total=${totalText}`);
if (total > 20) {
  await page.evaluate(() => {
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '下一页')?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const page2 = await page.evaluate(() => document.body.textContent.match(/第 (\d+) \/ \d+ 页/)?.[1]);
  check('下一页分页生效', page2 === '2', `page=${page2}`);
}

console.log('\n=== 5. 非管理员无入口 ===\n');
const stamp = Date.now().toString().slice(-6);
const reg = await fetch(API + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: `plain2_${stamp}`, password: 'secret123', nickname: 'Plain2' }),
}).then((r) => r.json());
await loginPage(reg);
const noBtn = await page.evaluate(() => !document.querySelector('button[aria-label="管理后台"]'));
check('普通用户不显示管理入口', noBtn);
// 直接调管理接口应 403
const forbidden = await fetch(API + '/api/admin/stats', {
  headers: { Authorization: `Bearer ${reg.token}` },
});
check('普通用户调用管理接口返回 403', forbidden.status === 403, `status=${forbidden.status}`);

console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====`);
if (errors.length) {
  console.log('控制台错误:');
  for (const e of errors.slice(0, 6)) console.log(`  - ${e}`);
}
await browser.close();
process.exit(failed > 0 ? 1 : 0);
