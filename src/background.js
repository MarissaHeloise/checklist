/* MIT License

Copyright (c) 2020 Playork

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE. */

"use strict";
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen, Tray, Menu, nativeImage } = require("electron");
const { createProtocol } = require("vue-cli-plugin-electron-builder/lib");
const fs = require("fs");
const path = require("path");

let win;
let isQuitting = false;
let tray = null;

function trayLogoPng() {
  // 优先使用项目内的 logo.png 作为托盘图标（开发环境可直接读取 src/assets）
  // 打包后路径可能变化，因此这里做多路径尝试；失败则返回 null 走兜底。
  const candidates = [
    // 生产环境：electron-builder extraResources 会把文件拷贝到 resources 目录
    path.join(process.resourcesPath || "", "tray-logo.png"),
    path.join(process.cwd(), "src", "assets", "logo.png"),
    // vue-cli-plugin-electron-builder 在生产环境通常会把静态资源放到 __static
    typeof __static === "string" ? path.join(__static, "img", "logo.png") : null,
    typeof __static === "string" ? path.join(__static, "logo.png") : null
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      const img = nativeImage.createFromPath(p);
      if (img && !img.isEmpty()) {
        // Windows 托盘常见 16/20/24px，这里先用 16px，系统会按 DPI 缩放
        return img.resize({ width: 16, height: 16 });
      }
    } catch {}
  }
  return null;
}

function trayImage() {
  // 高对比度黄色便签 + 对勾（SVG 渲染为托盘图标）
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="10" y="10" width="44" height="44" rx="10" fill="#FFD84D"/>
  <path d="M22 34.5l6.2 6.2L43 26" fill="none" stroke="#111" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  const img = nativeImage.createFromDataURL(dataUrl);
  return img && !img.isEmpty() ? img : null;
}

function ensureTray() {
  if (tray) return tray;
  try {
    let img = trayLogoPng() || trayImage();
    if (!img) {
      // 兜底：保证托盘仍会出现
      img = nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAV0lEQVR4AWP4z8Dwn4GBgQGJgQHh/4+BgYHhP4gZGBgYkB8YGBgY/0dDQ0P+/////w8MDAz8H5oYGBgY2B8kGBgYGAwAAkK8T5c4GegAAAABJRU5ErkJggg=="
      );
    }
    tray = new Tray(img);
    tray.setToolTip("Sticky Todo");
    const menu = Menu.buildFromTemplate([
      {
        label: "显示",
        click: () => {
          try {
            if (!win || win.isDestroyed()) return;
            win.show();
            win.focus();
          } catch {}
        }
      },
      {
        label: "退出",
        click: () => {
          try {
            isQuitting = true;
            app.quit();
          } catch {}
        }
      }
    ]);
    tray.setContextMenu(menu);
    tray.on("click", () => {
      try {
        if (!win || win.isDestroyed()) return;
        win.show();
        win.focus();
      } catch {}
    });
  } catch {}
  return tray;
}

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p);
  } catch {}
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 640,
    transparent: true,
    title: "Sticky Todo",
    frame: false,
    resizable: true,
    show: false,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  createProtocol("app");
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    win.loadURL("http://localhost:8080/#/home");
  } else {
    win.loadURL("app://./index.html#/home");
  }

  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

  // 最小化到托盘
  win.on("minimize", e => {
    try {
      const t = ensureTray();
      if (t) {
        e.preventDefault();
        win.hide();
      }
    } catch {}
  });

  win.on("close", e => {
    // 关闭按钮 = 真正退出（不驻留托盘），便于卸载/更新
    // 只对“最小化”进行托盘隐藏
    if (!isQuitting) {
      isQuitting = true;
      try {
        win.webContents.send("closeall");
      } catch {}
    }
  });
}

app.on("ready", () => {
  ensureDir("data");
  ensureDir("data/default");
  createWindow();

  // 快捷键：
  // Ctrl+Alt+T：置顶/取消置顶
  // Ctrl+Alt+B：取消置顶并尽量置于底部
  try {
    globalShortcut.register("Control+Alt+T", () => {
      try {
        if (!win || win.isDestroyed()) return;
        const next = !win.isAlwaysOnTop();
        win.setAlwaysOnTop(next);
      } catch {}
    });
    globalShortcut.register("Control+Alt+B", () => {
      try {
        if (!win || win.isDestroyed()) return;
        win.setAlwaysOnTop(false);
        // 单窗口下“置于底部”只能尽量失焦
        win.blur();
      } catch {}
    });
  } catch {}
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
  } catch {}
});

ipcMain.handle("minimize", event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) {
      const t = ensureTray();
      if (t) {
        w.hide();
      } else {
        w.minimize();
      }
    }
  } catch {}
});

ipcMain.handle("close", event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) {
      isQuitting = true;
      w.close();
    }
  } catch {}
});

ipcMain.handle("get-always-on-top", event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    return !!(w && w.isAlwaysOnTop());
  } catch {
    return false;
  }
});

ipcMain.handle("toggle-always-on-top", event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w) return false;
    const next = !w.isAlwaysOnTop();
    w.setAlwaysOnTop(next);
    return next;
  } catch {
    return false;
  }
});

ipcMain.handle("resize-to-content", (event, desiredHeight) => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (!w || w.isDestroyed()) return { ok: false };

    const n = Number(desiredHeight);
    if (!Number.isFinite(n)) return { ok: false };

    const bounds = w.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const maxH = display && display.workAreaSize ? display.workAreaSize.height : 900;

    const minH = 220;
    const targetH = Math.max(minH, Math.min(Math.round(n), maxH));
    if (Math.abs(bounds.height - targetH) < 2) return { ok: true, height: bounds.height };

    w.setSize(bounds.width, targetH, true);
    return { ok: true, height: targetH, maxH };
  } catch {
    return { ok: false };
  }
});

ipcMain.handle("export-todos", async (event, payload) => {
  try {
    const text = payload && typeof payload.text === "string" ? payload.text : "";
    const json = payload && typeof payload.json === "string" ? payload.json : "";

    const w = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showSaveDialog(w, {
      title: "导出 TodoList",
      defaultPath: "todolist.txt",
      filters: [
        { name: "文本文件", extensions: ["txt"] },
        { name: "JSON", extensions: ["json"] }
      ]
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    const fp = result.filePath;
    const lower = fp.toLowerCase();
    const content = lower.endsWith(".json") ? json || "[]" : text || "";
    fs.writeFileSync(fp, content, "utf8");
    return { ok: true, path: fp };
  } catch (e) {
    return { ok: false, error: e ? e.toString() : "unknown" };
  }
});

ipcMain.handle("import-todos", async event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(w, {
      title: "导入 TodoList",
      properties: ["openFile"],
      filters: [
        { name: "支持的文件", extensions: ["txt", "json"] },
        { name: "文本文件", extensions: ["txt"] },
        { name: "JSON", extensions: ["json"] }
      ]
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) {
      return { ok: false, canceled: true };
    }

    const fp = result.filePaths[0];
    const content = fs.readFileSync(fp, "utf8");
    return { ok: true, path: fp, content };
  } catch (e) {
    return { ok: false, error: e ? e.toString() : "unknown" };
  }
});
