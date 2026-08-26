// 好友功能后端 API 测试矩阵（测试工程师用例）
import fs from 'node:fs';

const BASE = 'http://localhost:8080';
const stamp = Date.now().toString().slice(-6);
let passed = 0;
let failed = 0;
const failures = [];

async function api(path, { method = 'GET', token, body, expect } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* 空响应 */ }
  return { status: res.status, data };
}

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  FAIL  ${name}  ${detail}`);
  }
}

async function ensureUser(username, nickname) {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { username, password: 'secret123', nickname },
  });
  if (reg.status === 201) return reg.data;
  if (reg.status === 409) {
    const login = await api('/api/auth/login', {
      method: 'POST',
      body: { username, password: 'secret123' },
    });
    return login.data;
  }
  throw new Error(`register ${username} failed: ${reg.status}`);
}

console.log(`\n=== 好友功能 API 测试矩阵 (${new Date().toISOString()}) ===\n`);

const A = await ensureUser(`qa_a_${stamp}`, 'QA-Alice');
const B = await ensureUser(`qa_b_${stamp}`, 'QA-Bob');
const C = await ensureUser(`qa_c_${stamp}`, 'QA-Carol');
const D = await ensureUser(`qa_d_${stamp}`, 'QA-Dave');
const E = await ensureUser(`qa_e_${stamp}`, 'QA-Erin');
console.log(`用户: ${A.user.username} / ${B.user.username} / ${C.user.username} / ${D.user.username} / ${E.user.username}\n`);

// TC01 发送好友申请
const r1 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: B.user.id, message: '你好 Bob' } });
check('TC01 发送好友申请(A→B) 返回 201', r1.status === 201, `got ${r1.status}`);

// TC02 重复申请（pending 中）
const r2 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: B.user.id } });
check('TC02 重复申请(pending) 返回 409', r2.status === 409, `got ${r2.status}`);

// TC03 反向申请（pending 中，双向互斥）
const r3 = await api('/api/friends/request', { method: 'POST', token: B.token, body: { to_user_id: A.user.id } });
check('TC03 反向申请(pending) 返回 409', r3.status === 409, `got ${r3.status}`);

// TC04 添加自己
const r4 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: A.user.id } });
check('TC04 添加自己 返回 400', r4.status === 400, `got ${r4.status}`);

// TC05 不存在用户
const r5 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: '000000000000000000000000' } });
check('TC05 添加不存在用户 返回 404', r5.status === 404, `got ${r5.status}`);

// TC06 处理不存在的申请
const r6 = await api('/api/friends/requests/000000000000000000000000', { method: 'PUT', token: B.token, body: { action: 'accept' } });
check('TC06 处理不存在申请 返回 404', r6.status === 404, `got ${r6.status}`);

// TC07 非法 action
const reqs1 = await api('/api/friends/requests', { token: B.token });
const pendingId = reqs1.data[0]?.id;
const r7 = await api(`/api/friends/requests/${pendingId}`, { method: 'PUT', token: B.token, body: { action: 'maybe' } });
check('TC07 非法 action 返回 400', r7.status === 400, `got ${r7.status}`);

// TC08 拒绝申请
const r8 = await api(`/api/friends/requests/${pendingId}`, { method: 'PUT', token: B.token, body: { action: 'reject' } });
check('TC08 拒绝申请 返回 200', r8.status === 200, `got ${r8.status}`);
const reqs2 = await api('/api/friends/requests', { token: B.token });
check('TC08b 拒绝后 B 的 pending 列表为空', reqs2.data.length === 0, `count=${reqs2.data.length}`);
const r8c = await api(`/api/friends/requests/${pendingId}`, { method: 'PUT', token: B.token, body: { action: 'accept' } });
check('TC08c 重复处理已拒绝申请 返回 404', r8c.status === 404, `got ${r8c.status}`);

// TC09 拒绝后可重新申请
const r9 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: B.user.id, message: '再试一次' } });
check('TC09 拒绝后重新申请 返回 201', r9.status === 201, `got ${r9.status}`);
const reqs3 = await api('/api/friends/requests', { token: B.token });
const newPending = reqs3.data[0];

// TC10 接受申请 → 双向好友
const r10 = await api(`/api/friends/requests/${newPending.id}`, { method: 'PUT', token: B.token, body: { action: 'accept' } });
check('TC10 接受申请 返回 200', r10.status === 200, `got ${r10.status}`);
const fa = await api('/api/friends', { token: A.token });
const fb = await api('/api/friends', { token: B.token });
check('TC10b A 的好友列表包含 B', fa.data.some((f) => f.user.id === B.user.id), JSON.stringify(fa.data.map((f) => f.user.username)));
check('TC10c B 的好友列表包含 A', fb.data.some((f) => f.user.id === A.user.id), JSON.stringify(fb.data.map((f) => f.user.username)));

// TC11 已是好友再次申请
const r11 = await api('/api/friends/request', { method: 'POST', token: A.token, body: { to_user_id: B.user.id } });
check('TC11 已是好友再次申请 返回 409', r11.status === 409, `got ${r11.status}`);

// TC12 备注（本人好友）
const aFriendB = fa.data.find((f) => f.user.id === B.user.id);
const r12 = await api(`/api/friends/${aFriendB.id}/remark`, { method: 'PUT', token: A.token, body: { remark: '铁哥们' } });
const fa2 = await api('/api/friends', { token: A.token });
const remarkOk = fa2.data.find((f) => f.user.id === B.user.id)?.remark === '铁哥们';
check('TC12 本人好友备注 200 且生效', r12.status === 200 && remarkOk, `got ${r12.status}`);

// TC13 备注别人的好友关系（越权）
const bFriendA = fb.data.find((f) => f.user.id === A.user.id);
const r13 = await api(`/api/friends/${bFriendA.id}/remark`, { method: 'PUT', token: C.token, body: { remark: 'hack' } });
check('TC13 越权备注（C 改 A↔B 的关系）应 404', r13.status === 404, `got ${r13.status} -> ${JSON.stringify(r13.data)}`);

// TC14 删除好友 → 双向移除
const r14 = await api(`/api/friends/${aFriendB.id}`, { method: 'DELETE', token: A.token });
const fa3 = await api('/api/friends', { token: A.token });
const fb3 = await api('/api/friends', { token: B.token });
check('TC14 删除好友 返回 200', r14.status === 200, `got ${r14.status}`);
check('TC14b A 列表不再包含 B', !fa3.data.some((f) => f.user.id === B.user.id));
check('TC14c B 列表不再包含 A（双向删除）', !fb3.data.some((f) => f.user.id === A.user.id));

// TC15 删除不存在的好友关系
const r15 = await api(`/api/friends/${aFriendB.id}`, { method: 'DELETE', token: A.token });
check('TC15 删除不存在好友 返回 404', r15.status === 404, `got ${r15.status}`);

// TC16 空列表
const r16 = await api('/api/friends', { token: C.token });
check('TC16 新用户好友列表为空数组', Array.isArray(r16.data) && r16.data.length === 0, `got ${JSON.stringify(r16.data)}`);

// TC17 给 A 加多个好友（E、D → A 申请，A 接受）
for (const u of [D, E]) {
  await api('/api/friends/request', { method: 'POST', token: u.token, body: { to_user_id: A.user.id, message: `我是${u.user.nickname}` } });
}
const reqsA = await api('/api/friends/requests', { token: A.token });
check('TC17 A 收到 2 个新申请', reqsA.data.length === 2, `count=${reqsA.data.length}`);
for (const r of reqsA.data) {
  await api(`/api/friends/requests/${r.id}`, { method: 'PUT', token: A.token, body: { action: 'accept' } });
}
const fa4 = await api('/api/friends', { token: A.token });
check('TC17b A 好友数 = 2（D、E）', fa4.data.length === 2, `count=${fa4.data.length}`);
check('TC17c A 好友包含 D 和 E', fa4.data.some((f) => f.user.id === D.user.id) && fa4.data.some((f) => f.user.id === E.user.id));

fs.writeFileSync(new URL('./qa-data.json', import.meta.url), JSON.stringify({ A, B, C, D, E }, null, 2));
console.log(`\n===== 结果: ${passed} 通过 / ${failed} 失败 =====`);
if (failures.length) {
  console.log('失败用例:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
}
process.exit(failed > 0 ? 1 : 0);
