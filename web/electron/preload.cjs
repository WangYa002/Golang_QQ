const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('win', {
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximizeChange: (cb) => {
    const listener = (_e, value) => cb(value);
    ipcRenderer.on('win:maximized', listener);
    return () => ipcRenderer.removeListener('win:maximized', listener);
  },
});
