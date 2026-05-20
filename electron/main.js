```js
import { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDistIndexPath, getPreloadPath } from './paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !app.isPackaged;

const appIconPath = path.join(__dirname, '../build/icon.png');

function getAppIcon() {
  if (!fs.existsSync(appIconPath)) return undefined;
  return nativeImage.createFromPath(appIconPath);
}

function loadProductionPage(win) {
  const indexPath = getDistIndexPath();

  if (!fs.existsSync(indexPath)) {
    const message = `Missing production build: ${indexPath}\n\nRun: npm run build`;

    dialog.showErrorBox('Arizona Car World', message);

    return;
  }

  win.loadFile(indexPath).catch((err) => {
    console.error('loadFile failed:', indexPath, err);

    dialog.showErrorBox(
      'Arizona Car World',
      `Could not load the app UI.\n\n${err.message}`
    );
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    title: 'Arizona Car World',
    icon: getAppIcon(),

    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },

    autoHideMenuBar: true,
    show: false,
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (isDev) return;

    console.error('did-fail-load', {
      code,
      description,
      url,
    });
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');

    win.webContents.openDevTools({
      mode: 'detach',
    });
  } else {
    loadProductionPage(win);
  }
}

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url);

  return {
    success: true,
  };
});

ipcMain.handle(
  'save-backup-file',
  async (_event, jsonContent, defaultName) => {
    const win = BrowserWindow.getFocusedWindow();

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName || 'arizona-pos-backup.json',

      filters: [
        {
          name: 'JSON',
          extensions: ['json'],
        },
      ],
    });

    if (canceled || !filePath) {
      return {
        success: false,
        canceled: true,
      };
    }

    fs.writeFileSync(filePath, jsonContent, 'utf8');

    return {
      success: true,
      path: filePath,
    };
  }
);

ipcMain.handle('print-invoice', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win) {
    return {
      success: false,
      error: 'No window',
    };
  }

  return new Promise((resolve) => {
    win.webContents.print(
      {
        silent: false,
        printBackground: true,

        margins: {
          marginType: 'none',
        },
      },
      (success, failureReason) => {
        resolve({
          success,
          error: failureReason,
        });
      }
    );
  });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```
