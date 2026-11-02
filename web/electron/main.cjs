/**
 * Golang QQ 桌面客户端主进程
 *
 * 加载策略：
 * 1. 环境变量 ELECTRON_START_URL 存在（本地联调：electron . 且 Vite dev server 在跑）→ 直接加载该 URL
 * 2. 否则加载打包进应用的 dist/index.html（生产），API/WS 地址由构建期 .env.electron 注入
 */
const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const START_URL = process.env.ELECTRON_START_URL || '';

function resolveIndexHtml() {
  // 打包后 main.cjs 位于 app.asar/electron/ 内，dist 与 electron 同级
  const candidates = [
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(process.resourcesPath || '', 'app.asar', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1120,
    minHeight: 640,
    backgroundColor: '#0f1115',
    title: 'Golang QQ',
    frame: false, // 无边框：自绘标题栏（应用内 TopBar 提供窗口控制）
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  win.on('maximize', () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));

  if (START_URL) {
    win.loadURL(START_URL);
  } else {
    const html = resolveIndexHtml();
    if (html) {
      win.loadFile(html);
    } else {
      win.loadURL('http://localhost:5173/');
    }
  }

  // 外部链接（如文件下载链接）交给系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('context-menu', () => {
    /* 保留默认空白右键行为；应用内自定义菜单由页面层处理 */
  });
}

// 去掉默认菜单栏（保留 Alt 隐藏逻辑由 autoHideMenuBar 处理）
Menu.setApplicationMenu(null);

ipcMain.handle('win:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.handle('win:maximize', () => {
  const w = BrowserWindow.getFocusedWindow();
  if (w) {
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  }
});
ipcMain.handle('win:close', () => BrowserWindow.getFocusedWindow()?.close());
ipcMain.handle('win:isMaximized', () => BrowserWindow.getFocusedWindow()?.isMaximized() ?? false);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
