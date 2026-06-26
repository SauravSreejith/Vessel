'use strict';

const {
  app,
  BrowserWindow,
  session,
  ipcMain,
  Notification,
  Tray,
  Menu,
  shell,
  nativeImage,
  globalShortcut,
  dialog
} = require('electron');
const path = require('path');
const fs = require('fs');

const DISCORD_URL = 'https://discord.com/app';
const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'clipboard-read',
  'fullscreen',
]);

let mainWindow = null;
let tray = null;
let isQuitting = false;

const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json');

function loadWindowState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { width: 1280, height: 800, x: undefined, y: undefined, maximized: false };
  }
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    const state = { ...bounds, maximized: win.isMaximized() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (err) {
    console.error('[vessel] Failed to save window state:', err.message);
  }
}

function getIconPath() {
  const candidates = [
    path.join(__dirname, 'icons', 'icon.png'),
    path.join(__dirname, 'icon.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildNativeImage(size = 32) {
  const iconPath = getIconPath();
  if (iconPath) return nativeImage.createFromPath(iconPath);

  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  );
}

function createTray() {
  const icon = buildNativeImage(22);
  tray = new Tray(icon);
  tray.setToolTip('Vessel — Discord for Linux');
  rebuildTrayMenu();

  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

function rebuildTrayMenu(unreadCount = 0) {
  if (!tray) return;
  const label = unreadCount > 0 ? `Show Vessel  (${unreadCount} unread)` : 'Show Vessel';

  const menu = Menu.buildFromTemplate([
    { label, click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Reload Discord',
      click: () => mainWindow?.webContents.reload(),
    },
    {
      label: 'Open DevTools',
      click: () => mainWindow?.webContents.openDevTools({ mode: 'detach' }),
      visible: !app.isPackaged,
    },
    { type: 'separator' },
    {
      label: 'About Vessel',
      click: showAboutDialog,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function showAboutDialog() {
  const pkg = loadPackageJson();
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Vessel',
    message: `Vessel v${pkg.version}`,
    detail: [
      'A lightweight, secure Discord wrapper for Linux.',
      '',
      `Electron: ${process.versions.electron}`,
      `Chromium: ${process.versions.chrome}`,
      `Node.js:  ${process.versions.node}`,
      '',
      'MIT License — github.com/youruser/vessel',
    ].join('\n'),
    buttons: ['OK'],
    icon: getIconPath() ? buildNativeImage() : undefined,
  });
}

function loadPackageJson() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  } catch {
    return { version: '0.0.0' };
  }
}

function setupPermissions(ses) {
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const isDiscordOrigin =
      details?.requestingUrl?.startsWith('https://discord.com') ||
      details?.requestingUrl?.startsWith('https://cdn.discordapp.com');

    if (isDiscordOrigin && ALLOWED_PERMISSIONS.has(permission)) {
      callback(true);
    } else {
      console.warn(`[vessel] Denied permission "${permission}" for ${details?.requestingUrl}`);
      callback(false);
    }
  });

  ses.setPermissionCheckHandler((webContents, permission) => {
    return ALLOWED_PERMISSIONS.has(permission);
  });
}

const DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'discord.gg',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'discord-attachments-uploads-prd.storage.googleapis.com',
]);

function isDiscordUrl(urlString) {
  try {
    const { hostname } = new URL(urlString);
    return DISCORD_HOSTS.has(hostname) || hostname.endsWith('.discord.com');
  } catch {
    return false;
  }
}

function setupNavigationGuard(win) {
  win.webContents.on('will-navigate', (event, url) => {
    if (!isDiscordUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isDiscordUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function registerShortcuts() {
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Vessel',
    autoHideMenuBar: true,
    icon: getIconPath() ?? undefined,
    backgroundColor: '#313338', 
    show: false,               
    webPreferences: {
      nodeIntegration: false,   
      contextIsolation: true,   
      sandbox: true,            
      backgroundThrottling: false,
      spellcheck: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (state.maximized) mainWindow.maximize();
  let saveTimer = null;
  const debounceSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveWindowState(mainWindow), 500);
  };
  mainWindow.on('resize', debounceSave);
  mainWindow.on('move', debounceSave);
  mainWindow.on('maximize', debounceSave);
  mainWindow.on('unmaximize', debounceSave);

  setupNavigationGuard(mainWindow);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;

    if (ctrl && input.key === 'r') {
      mainWindow.webContents.reload();
      event.preventDefault();
    }
    if (ctrl && input.shift && input.key === 'I') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
      event.preventDefault();
    }
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    injectCSS(mainWindow.webContents);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDesc, url) => {
    if (errorCode === -3) return;
    console.error(`[vessel] Load failed (${errorCode} ${errorDesc}) for ${url}`);
    mainWindow.webContents.loadFile(path.join(__dirname, 'error.html'));
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      saveWindowState(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(DISCORD_URL, { userAgent: USER_AGENT });
}

function injectCSS(webContents) {
  const cssPath = path.join(app.getPath('userData'), 'custom.css');
  if (fs.existsSync(cssPath)) {
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      webContents.insertCSS(css);
      console.log('[vessel] Loaded custom.css');
    } catch (err) {
      console.error('[vessel] Failed to inject custom.css:', err.message);
    }
  }
}


ipcMain.on('show-notification', (_event, { title = '', body = '', icon } = {}) => {
  if (!Notification.isSupported()) return;

  const notif = new Notification({
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 500),
    icon: icon ?? getIconPath() ?? undefined,
    urgency: 'normal',
  });

  notif.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  notif.show();
});

ipcMain.on('set-badge', (_event, count) => {
  const n = Math.max(0, parseInt(count, 10) || 0);
  app.setBadgeCount?.(n);
  rebuildTrayMenu(n);
});

app.whenReady().then(() => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.setAppUserModelId('com.vessel.discord');

  setupPermissions(session.defaultSession);

  createTray();
  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
});


app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[vessel] Renderer gone:', details.reason);
  if (['crashed', 'oom'].includes(details.reason)) {
    mainWindow?.webContents.reload();
  }
});

app.on('child-process-gone', (_event, details) => {
  console.error('[vessel] Child process gone:', details.type, details.reason);
});
