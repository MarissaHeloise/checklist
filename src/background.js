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
const { app, BrowserWindow, ipcMain, dialog, globalShortcut, screen } = require("electron");
const { createProtocol } = require("vue-cli-plugin-electron-builder/lib");
const fs = require("fs");

let win;
let isQuitting = false;

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

  win.on("close", e => {
    if (isQuitting) return;
    e.preventDefault();
    isQuitting = true;
    try {
      win.webContents.send("closeall");
    } catch {}
    setTimeout(() => {
      try {
        app.quit();
      } catch {}
    }, 300);
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
    if (w) w.minimize();
  } catch {}
});

ipcMain.handle("close", event => {
  try {
    const w = BrowserWindow.fromWebContents(event.sender);
    if (w) w.close();
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
