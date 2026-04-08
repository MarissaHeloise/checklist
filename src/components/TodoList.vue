<template>
  <div class="todo" :style="{ color: settings.textColor }">
    <div ref="bar" class="bar" v-if="!locked" @click.stop>
      <input
        v-model="draft"
        class="draft"
        type="text"
        placeholder="输入待办事项…（回车添加）"
        @keydown.enter.prevent="addTodo"
        @click.stop
      />
      <button class="btn" :disabled="!draft.trim()" @click.stop="addTodo">添加</button>

      <label class="color">
        字体颜色
        <input type="color" v-model="settings.textColor" @input="saveSettings" @click.stop />
      </label>

      <button class="btn ghost" @click.stop="editMode = !editMode">
        {{ editMode ? "完成" : "编辑" }}
      </button>

      <button
        v-if="!locked"
        class="btn ghost"
        :disabled="!editMode || todos.length === 0"
        @click.stop="toggleAll"
      >
        {{ allDone ? "全不选" : "全选" }}
      </button>

      <button class="btn ghost" @click.stop="exportList">
        导出
      </button>

      <button class="btn ghost" @click.stop="importList">
        导入
      </button>

      <button
        class="btn ghost"
        v-if="canUndoDelete"
        @click.stop="undoDelete"
      >
        撤销删除
      </button>

      <button
        class="btn ghost"
        :disabled="locked || !editMode || !hasDone"
        @click.stop="deleteSelected"
      >
        全选删除
      </button>

      <button
        class="btn ghost"
        :disabled="!canUndoImport"
        v-if="canUndoImport"
        @click.stop="undoImport"
      >
        回退导入
      </button>

      <button v-if="!locked" class="btn ghost" :disabled="!editMode || !hasDone" @click.stop="clearDone">
        清除已完成
      </button>
    </div>

    <div ref="list" class="list" @click.self="clearSelection">
      <div
        v-for="(t, idx) in todos"
        :key="t.id"
        class="row"
        :class="{
          selected: selectedId === t.id,
          dragging: dragId === t.id,
          dragOver: dragId && dragId !== t.id && dragOverId === t.id,
          noNum: locked
        }"
        draggable="true"
        @click.stop="selectedId = t.id"
        @dragstart="onRowDragStart(t.id, $event)"
        @dragover.prevent="onDragOver(t.id)"
        @drop.prevent="onDrop"
        @dragend="onDragEnd"
      >
        <div v-if="!locked" class="num">{{ idx + 1 }}.</div>
        <label class="item">
          <input type="checkbox" v-model="t.done" @change="scheduleSave" @dragstart.stop.prevent />
          <template v-if="editMode && selectedId === t.id">
            <textarea
              class="text"
              :class="{ done: t.done }"
              v-model="t.text"
              rows="1"
              wrap="soft"
              ref="texts"
              draggable="false"
              @dragstart.stop.prevent
              @input="onTextInput($event); scheduleSave()"
            />
          </template>
          <template v-else>
            <div class="textDisplay" :class="{ done: t.done }">
              {{ t.text }}
            </div>
          </template>
        </label>
        <button
          v-if="editMode && selectedId === t.id"
          class="del"
          title="删除"
          @click.stop="removeTodo(t.id)"
          @dragstart.stop.prevent
        >
          ×
        </button>
      </div>

      <div v-if="todos.length === 0" class="empty">还没有待办事项。</div>
    </div>
  </div>
</template>

<script>
import { ipcRenderer } from "electron";
import fs from "fs";

function safeJsonParse(buf) {
  if (!buf) return undefined;
  const s = typeof buf === "string" ? buf : buf.toString("utf8");
  if (!s || !s.trim()) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function ensureDir(p) {
  try {
    if (!fs.existsSync(p)) fs.mkdirSync(p);
  } catch {}
}

export default {
  data() {
    return {
      profile: "default",
      draft: "",
      todos: [],
      saveTimer: null,
      settings: { textColor: "#000000", locked: false },
      locked: false,
      editMode: false,
      selectedId: null,
      undoImportSnapshot: null,
      canUndoImport: false,
      lastDeleted: null,
      canUndoDelete: false,
      undoDeleteTimer: null,
      dragId: null,
      dragOverId: null,
      dragDirty: false,
      lastOverId: null,
      dragOverRaf: null,
      windowIsCapped: false
    };
  },
  computed: {
    todosPath() {
      return `data/${this.profile}/todos.json`;
    },
    settingsPath() {
      return `data/${this.profile}/settings.json`;
    },
    hasDone() {
      return this.todos.some(t => t.done);
    },
    allDone() {
      return this.todos.length > 0 && this.todos.every(t => t.done);
    }
  },
  mounted() {
    ensureDir("data");
    ensureDir("data/default");

    fs.readFile("data/profile", (e, d) => {
      const p = e ? "default" : (d || "").toString("utf8").trim();
      this.profile = p || "default";
      ensureDir(`data/${this.profile}`);
      this.loadSettings();
      this.loadTodos();
    });
  },
  methods: {
    scheduleWindowResize() {
      if (this._resizeWinRaf) cancelAnimationFrame(this._resizeWinRaf);
      this._resizeWinRaf = requestAnimationFrame(() => {
        this._resizeWinRaf = null;
        this.resizeWindowToContent();
      });
    },
    async resizeWindowToContent() {
      try {
        const titleBarH = 40;
        const body = this.$el;
        if (!body) return;
        const desired = titleBarH + body.scrollHeight + 8;
        const res = await ipcRenderer.invoke("resize-to-content", desired);
        const maxH = res && typeof res.maxH === "number" ? res.maxH : null;
        const h = res && typeof res.height === "number" ? res.height : null;
        this.windowIsCapped = !!(maxH && h && h >= maxH - 2);
        this.applyListOverflow();
      } catch {}
    },
    applyListOverflow() {
      const list = this.$refs.list;
      if (!list) return;

      if (!this.windowIsCapped) {
        list.style.overflow = "hidden";
        list.style.maxHeight = "none";
        return;
      }

      // 触顶时才允许列表滚动
      const titleBarH = 40;
      const bar = this.$refs.bar;
      const barH = bar ? bar.offsetHeight : 0;
      const padding = 18;
      const avail = Math.max(140, window.innerHeight - titleBarH - barH - padding);
      list.style.maxHeight = `${avail}px`;
      list.style.overflow = "auto";
    },
    setLocked(v) {
      const next = !!v;
      this.locked = next;
      this.settings.locked = next;
      this.saveSettings();
      this.clearSelection();
      if (next) this.editMode = false;
      this.$emit("lock", next);
      this.$emit("status", { text: next ? "已锁定" : "已解锁", flash: true });
      this.scheduleWindowResize();
    },
    clearUndoImport() {
      this.undoImportSnapshot = null;
      this.canUndoImport = false;
    },
    clearUndoDelete() {
      this.lastDeleted = null;
      this.canUndoDelete = false;
      if (this.undoDeleteTimer) {
        clearTimeout(this.undoDeleteTimer);
        this.undoDeleteTimer = null;
      }
    },
    undoDelete() {
      if (!this.canUndoDelete || !this.lastDeleted) return;
      if (this.lastDeleted.type === "bulk") {
        this.todos = this.normalizeTodos(this.lastDeleted.snapshot);
      } else {
        const { item, index } = this.lastDeleted;
        const safeIndex = Math.min(Math.max(0, index), this.todos.length);
        this.todos.splice(safeIndex, 0, item);
        this.todos = this.normalizeTodos(this.todos);
      }
      this.saveNow();
      this.resizeAll();
      this.clearUndoDelete();
      this.$emit("status", { text: "已撤销删除", flash: true });
      this.scheduleWindowResize();
    },
    deleteSelected() {
      const count = this.todos.filter(t => t.done).length;
      if (count === 0) return;

      // 批量删除前保存快照，支持撤销
      try {
        this.lastDeleted = {
          type: "bulk",
          snapshot: JSON.parse(JSON.stringify(this.todos || [])),
          deletedCount: count
        };
        this.canUndoDelete = true;
        if (this.undoDeleteTimer) clearTimeout(this.undoDeleteTimer);
        this.undoDeleteTimer = setTimeout(() => {
          this.clearUndoDelete();
        }, 60000);
      } catch {
        this.lastDeleted = null;
        this.canUndoDelete = false;
      }

      this.todos = this.todos.filter(t => !t.done);
      this.saveNow();
      this.resizeAll();
      this.clearUndoImport();
      this.$emit("status", { text: `已删除 ${count} 条（可撤销）`, flash: true });
      this.scheduleWindowResize();
    },
    undoImport() {
      if (!this.canUndoImport || !this.undoImportSnapshot) return;
      this.todos = this.normalizeTodos(this.undoImportSnapshot);
      this.saveNow();
      this.resizeAll();
      this.clearUndoImport();
      this.clearUndoDelete();
      this.$emit("status", { text: "已回退导入", flash: true });
      this.scheduleWindowResize();
    },
    clearSelection() {
      this.selectedId = null;
      this.$emit("status", { text: "", flash: false });
    },
    resizeAll() {
      this.$nextTick(() => {
        const list = this.$refs.texts;
        const els = Array.isArray(list) ? list : list ? [list] : [];
        els.forEach(el => this.resizeEl(el));
      });
    },
    resizeEl(el) {
      if (!el) return;
      try {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      } catch {}
    },
    onTextInput(e) {
      const el = e && e.target;
      if (!el) return;
      this.resizeEl(el);
    },
    loadSettings() {
      fs.readFile(this.settingsPath, (e, d) => {
        const v = e ? undefined : safeJsonParse(d);
        const c = v && typeof v.textColor === "string" ? v.textColor : "#000000";
        const locked = !!(v && typeof v === "object" && v.locked);
        this.settings.textColor = c === "#ffffff" ? "#000000" : c;
        this.settings.locked = locked;
        this.locked = locked;
        this.$emit("lock", this.locked);
        this.saveSettings();
      });
    },
    saveSettings() {
      try {
        fs.writeFile(this.settingsPath, JSON.stringify(this.settings, null, 2), () => {});
      } catch {}
    },
    normalizeTodos(list) {
      if (!Array.isArray(list)) return [];
      const out = list
        .filter(x => x && typeof x === "object")
        .map(x => ({
          id: typeof x.id === "string" && x.id ? x.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          text: typeof x.text === "string" ? x.text : "",
          done: !!x.done,
          createdAt: typeof x.createdAt === "number" ? x.createdAt : Date.now()
        }))
        .filter(x => x.text.trim() !== "");
      out.sort((a, b) => a.createdAt - b.createdAt);
      return out;
    },
    loadTodos() {
      fs.readFile(this.todosPath, (e, d) => {
        const parsed = e ? [] : safeJsonParse(d);
        this.todos = this.normalizeTodos(parsed);
        this.saveNow();
        this.resizeAll();
        this.scheduleWindowResize();
      });
    },
    saveNow() {
      try {
        fs.writeFile(this.todosPath, JSON.stringify(this.todos, null, 2), () => {});
      } catch {}
    },
    scheduleSave() {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        this.saveNow();
      }, 250);
    },
    addTodo() {
      const text = this.draft.trim();
      if (!text) return;
      const now = Date.now();
      this.todos.push({ id: `${now}-${Math.random().toString(16).slice(2)}`, text, done: false, createdAt: now });
      this.draft = "";
      this.scheduleSave();
      this.resizeAll();
      this.clearUndoImport();
      this.clearUndoDelete();
      this.$emit("status", { text: "已添加", flash: true });
      this.scheduleWindowResize();
    },
    removeTodo(id) {
      const idx = this.todos.findIndex(t => t.id === id);
      const removed = idx >= 0 ? this.todos[idx] : null;
      this.todos = this.todos.filter(t => t.id !== id);
      this.scheduleSave();
      this.resizeAll();
      this.clearUndoImport();
      if (removed) {
        this.lastDeleted = {
          type: "single",
          item: JSON.parse(JSON.stringify(removed)),
          index: idx
        };
        this.canUndoDelete = true;
        if (this.undoDeleteTimer) clearTimeout(this.undoDeleteTimer);
        this.undoDeleteTimer = setTimeout(() => {
          this.clearUndoDelete();
        }, 60000);
      }
      this.$emit("status", { text: "已删除（可撤销）", flash: true });
      this.scheduleWindowResize();
    },
    clearDone() {
      this.todos = this.todos.filter(t => !t.done);
      this.scheduleSave();
      this.resizeAll();
      this.clearUndoImport();
      this.clearUndoDelete();
      this.$emit("status", { text: "已清除完成项", flash: true });
      this.scheduleWindowResize();
    },
    toggleAll() {
      const next = !this.allDone;
      this.todos.forEach(t => {
        t.done = next;
      });
      this.scheduleSave();
      this.clearUndoImport();
      this.clearUndoDelete();
      this.$emit("status", { text: next ? "已全选" : "已全不选", flash: true });
    },
    async exportList() {
      const lines = this.todos.map((t, i) => {
        const mark = t.done ? "[x]" : "[ ]";
        return `${i + 1}. ${mark} ${t.text}`;
      });
      const text = lines.join("\n");
      const json = JSON.stringify(this.todos, null, 2);

      try {
        const res = await ipcRenderer.invoke("export-todos", { text, json });
        if (res && res.ok) {
          this.$emit("status", { text: "导出成功", flash: true });
        } else if (res && res.canceled) {
          this.$emit("status", { text: "", flash: false });
        } else {
          this.$emit("status", { text: "导出失败", flash: true });
        }
      } catch {
        this.$emit("status", { text: "导出失败", flash: true });
      }
    },
    parseTxtTodos(text) {
      const lines = (text || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      const items = [];
      for (const line of lines) {
        // 支持：
        // 1. [x] xxx
        // 2. 1. [ ] xxx
        const m = line.match(/^(?:\d+\.\s*)?\[(x| )\]\s*(.+)$/i);
        if (!m) continue;
        const done = (m[1] || "").toLowerCase() === "x";
        const t = (m[2] || "").trim();
        if (!t) continue;
        items.push({ done, text: t });
      }
      return items;
    },
    normalizeImported(list) {
      const now = Date.now();
      return (Array.isArray(list) ? list : [])
        .filter(x => x && typeof x === "object")
        .map((x, i) => ({
          id: `${now + i}-${Math.random().toString(16).slice(2)}`,
          text: typeof x.text === "string" ? x.text : "",
          done: !!x.done,
          createdAt: now + i
        }))
        .filter(x => x.text.trim() !== "");
    },
    async importList() {
      try {
        this.clearUndoDelete();
        const res = await ipcRenderer.invoke("import-todos");
        if (!res || !res.ok) {
          if (res && res.canceled) return;
          this.$emit("status", { text: "导入失败", flash: true });
          return;
        }

        // 导入前保存快照（单步回退）
        try {
          this.undoImportSnapshot = JSON.parse(JSON.stringify(this.todos || []));
          this.canUndoImport = true;
        } catch {
          this.undoImportSnapshot = null;
          this.canUndoImport = false;
        }

        const path = (res.path || "").toString();
        const content = (res.content || "").toString();
        const lower = path.toLowerCase();

        let imported = [];
        if (lower.endsWith(".json")) {
          const parsed = safeJsonParse(content);
          imported = this.normalizeImported(parsed);
        } else {
          imported = this.normalizeImported(this.parseTxtTodos(content));
        }

        if (imported.length === 0) {
          this.clearUndoImport();
          this.$emit("status", { text: "没有可导入内容", flash: true });
          return;
        }

        // 默认：追加导入到末尾（不覆盖现有）
        this.todos = this.normalizeTodos([...this.todos, ...imported]);
        this.saveNow();
        this.resizeAll();
        this.$emit("status", { text: `已导入 ${imported.length} 条`, flash: true });
        this.scheduleWindowResize();
      } catch {
        this.clearUndoImport();
        this.$emit("status", { text: "导入失败", flash: true });
      }
    },
    onRowDragStart(id, ev) {
      // 如果从可编辑控件上开始拖动，交给控件自身（比如选中文本）
      const tag = (ev && ev.target && ev.target.tagName) || "";
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || tag === "SELECT") {
        try {
          ev.preventDefault();
        } catch {}
        return;
      }

      this.selectedId = id;
      this.dragId = id;
      this.dragOverId = null;
      this.dragDirty = false;
      this.lastOverId = null;
      this.$emit("status", { text: "拖动中…", flash: true });
      try {
        if (ev && ev.dataTransfer) {
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", id);
        }
      } catch {}
    },
    onDragOver(targetId) {
      if (!this.dragId || this.dragId === targetId) return;
      if (this.lastOverId === targetId) return;
      this.lastOverId = targetId;
      this.dragOverId = targetId;

      if (this.dragOverRaf) return;
      this.dragOverRaf = requestAnimationFrame(() => {
        this.dragOverRaf = null;
        const from = this.todos.findIndex(t => t.id === this.dragId);
        const to = this.todos.findIndex(t => t.id === this.dragOverId);
        if (from < 0 || to < 0 || from === to) return;
        const [m] = this.todos.splice(from, 1);
        this.todos.splice(to, 0, m);
        this.dragDirty = true;
        this.resizeAll();
      });
    },
    onDrop() {
      if (this.dragDirty) {
        this.saveNow();
        this.clearUndoImport();
        this.clearUndoDelete();
        this.$emit("status", { text: "拖拽成功", flash: true });
        this.scheduleWindowResize();
      } else {
        this.$emit("status", { text: "", flash: false });
      }
    },
    onDragEnd() {
      this.dragId = null;
      this.dragOverId = null;
      this.lastOverId = null;
      if (this.dragOverRaf) {
        cancelAnimationFrame(this.dragOverRaf);
        this.dragOverRaf = null;
      }
      this.$emit("status", { text: "", flash: false });
    }
  }
};
</script>

<style scoped>
.todo { padding: 10px; }
.bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  background: rgba(255,255,255,0.45);
  border-radius: 10px; padding: 8px;
  box-shadow: rgba(0,0,0,0.18) 0 1px 8px;
}
.draft { flex: 1; min-width: 160px; border: none; outline: none; padding: 8px 10px; border-radius: 8px; background: rgba(17,17,17,0.08); }
.btn { border: none; border-radius: 8px; padding: 8px 10px; background: #111; color: #fff; }
.btn:disabled { opacity: 0.45; }
.btn.ghost { background: rgba(17,17,17,0.08); color: #111; }
.color { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #111; }
.list {
  margin-top: 10px;
  padding-right: 2px;
}
.row {
  display: grid;
  grid-template-columns: 36px 1fr 30px;
  gap: 10px;
  align-items: start;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.34);
  margin-bottom: 10px;
  cursor: grab;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease,
    outline-color 120ms ease,
    background 120ms ease;
}
.row.noNum {
  grid-template-columns: 1fr 30px;
}
.row:active { cursor: grabbing; }
.row:hover {
  background: rgba(255, 255, 255, 0.44);
  box-shadow: rgba(0, 0, 0, 0.12) 0 6px 18px;
}
.row.selected {
  outline: 2px solid rgba(0, 0, 0, 0.14);
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.62),
    rgba(255, 255, 255, 0.38)
  );
  box-shadow:
    rgba(0, 0, 0, 0.18) 0 10px 28px,
    inset rgba(255, 255, 255, 0.65) 0 1px 0;
  transform: translateY(-1px);
}
.row.dragging {
  opacity: 0.55;
}
.row.dragOver {
  outline: 2px dashed rgba(17, 17, 17, 0.18);
}
.num { opacity: 0.75; }
.item { display: flex; gap: 8px; align-items: start; }
.text {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 14px;
  color: inherit;
  resize: none;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  padding: 2px 0;
  cursor: text;
}
.textDisplay {
  width: 100%;
  font-size: 14px;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 2px 0;
}
.text.done { text-decoration: line-through; opacity: 0.65; }
.textDisplay.done { text-decoration: line-through; opacity: 0.65; }
.del { border: none; background: transparent; font-size: 18px; line-height: 18px; opacity: 0.65; }
.del:hover { opacity: 1; }
.empty { opacity: 0.7; padding: 12px 4px; }
</style>
