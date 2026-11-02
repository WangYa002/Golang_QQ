const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.disableHardwareAcceleration();

const USER = process.env.SHOT_USER || 'alice';
const PASS = process.env.SHOT_PASS || 'alice123';
const GROUP = process.env.SHOT_GROUP || '2025重邮江南分院';
const OUT = process.env.SHOT_OUT || path.resolve(__dirname, '..', 'docs', 'qq-screenshot.png');
const WIDTH = parseInt(process.env.SHOT_WIDTH || '1280', 10);
const HEIGHT = parseInt(process.env.SHOT_HEIGHT || '840', 10);

function waitFor(fn, timeout = 20000, every = 250) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      try {
        if (await fn()) return resolve();
      } catch (e) { /* ignore js errors while waiting */ }
      if (Date.now() - start > timeout) return reject(new Error('waitFor timeout'));
      setTimeout(tick, every);
    };
    tick();
  });
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: {
      backgroundThrottling: false,
      offscreen: true,
      webgl: false,
    },
  });

  win.webContents.setFrameRate(15);
  await win.loadURL('http://localhost:5173/');
  console.log('STEP loaded');

  const js = (code) => win.webContents.executeJavaScript(code);

  // 等待“登录表单”或“已进入主界面”
  await waitFor(() => js(`!!document.querySelector('.app-shell') || !!document.querySelector('.lg-submit')`), 25000);
  const loggedIn = await js(`!!document.querySelector('.app-shell')`);
  console.log('STEP already logged in = ' + loggedIn);

  if (!loggedIn) {
    await js(`
      (() => {
        const setVal = (el, v) => {
          const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          s.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const user = document.querySelector('input[placeholder="请输入用户名"]');
        const pwd = document.querySelector('input[placeholder="输入您的密码"]');
        if (user) setVal(user, ${JSON.stringify(USER)});
        if (pwd) setVal(pwd, ${JSON.stringify(PASS)});
        const btn = document.querySelector('.lg-submit');
        if (btn) btn.click();
        return !!btn;
      })()
    `);
    await waitFor(() => js(`!!document.querySelector('.app-shell')`), 20000);
    console.log('STEP logged in via form');
  }
  await new Promise((r) => setTimeout(r, 2000));

  // 点击目标群聊
  const clicked = await win.webContents.executeJavaScript(`
    (() => {
      const rows = [...document.querySelectorAll('.convo-item')];
      const row = rows.find((r) => r.textContent.includes(${JSON.stringify(GROUP)}));
      if (row) row.click();
      return !!row;
    })()
  `);
  console.log('STEP clicked = ' + clicked);
  if (process.env.SHOT_OPEN_GROUP === '1') {
    await win.webContents.executeJavaScript(`
      (() => { const b = document.querySelector('button[title="更多操作"]'); if (b) { b.click(); return true; } return false; })()
    `);
    await new Promise((r) => setTimeout(r, 400));
    await win.webContents.executeJavaScript(`
      (() => { const items = [...document.querySelectorAll('.menu-item')]; const it = items.find((el) => el.textContent.includes('群成员')); if (it) { it.click(); return true; } return false; })()
    `);
    await new Promise((r) => setTimeout(r, 900));
    console.log('STEP opened group popover');
  }
  await new Promise((r) => setTimeout(r, 3000));

  const img = await win.webContents.capturePage();
  fs.writeFileSync(OUT, img.toPNG());
  console.log('SAVED ' + OUT + ' clicked=' + clicked);
  app.quit();
}).catch((e) => {
  console.error('ERROR ' + (e && e.message ? e.message : e));
  app.exit(1);
});
