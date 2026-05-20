const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printInvoice: () => ipcRenderer.invoke('print-invoice'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  saveBackupFile: (json, name) =>
    ipcRenderer.invoke('save-backup-file', json, name),
  isElectron: true,
});