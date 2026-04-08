# Sticky TodoList (Electron + Vue2)

一个极简的本地 TodoList 便签应用（单窗口）：只做待办清单，数据保存在本地，不做云同步。

## 功能

- 勾选待办（checkbox）
- 拖拽排序（拖动过程中实时重排）
- 自动编号（锁定时可隐藏编号）
- 导入/导出（`.txt` / `.json`）
- 导入后可回退（单步回退导入）
- 删除可撤销（1 分钟内）
- 全选/全不选、批量删除（仅编辑模式可用）
- 字体颜色选择
- 锁定模式（隐藏操作区；仍可移动窗口与拖拽排序）
- 置顶（标题栏按钮 / 快捷键）
- 自动调整窗口高度以适配内容（不超过 Windows 可用高度）

## 快捷键

- **Ctrl + Alt + T**：置顶/取消置顶
- **Ctrl + Alt + B**：尽量置底（取消置顶并失焦）

## 数据保存位置

所有数据都写在项目目录下的 `data/`：

- `data/profile`：当前 profile 名（默认 `default`）
- `data/<profile>/todos.json`：待办数据
- `data/<profile>/settings.json`：设置（如 `textColor`、`locked`）

## 导出格式

- **TXT**：每行一个条目，形如：
  - `1. [ ] 内容`
  - `2. [x] 已完成内容`
- **JSON**：数组格式（包含 `id/text/done/createdAt`）

## 导入说明

- 支持导入 **TXT/JSON**
- 默认行为是 **追加导入**（不会覆盖现有条目）
- 导入完成后会出现 **“回退导入”** 按钮（后续有其它编辑/拖拽操作会自动失效）

## 开发与运行

### 环境要求

- Node.js >= 18
- pnpm（项目使用 pnpm 作为包管理器）

### 安装依赖

```bash
pnpm install
```

### 启动开发模式

```bash
pnpm start
```

### 构建

```bash
pnpm run build
```

### 打包为 Windows EXE（安装版 + 免安装便携版）

打包前建议先关闭正在运行的开发模式（`pnpm start`）以及已启动的应用窗口，避免文件占用导致打包异常。

在项目根目录执行：

```powershell
Set-Location "D:\stickynotes\StickyNotes"
pnpm install
pnpm run build
```

打包产物输出在 `dist_electron_out/`：

- **安装版（NSIS）**：`dist_electron_out/stickynotes Setup <version>.exe`
- **免安装便携版（portable）**：`dist_electron_out/stickynotes <version>.exe`（可直接双击运行）

## Licence

MIT License (MIT)

Copyright (c) 2020 Playork

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
