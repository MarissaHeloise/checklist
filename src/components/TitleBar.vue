<template>
  <header class="tb">
    <div class="drag" :class="{ locked: locked }">
      <div class="title" v-if="!locked">
        <span class="base">TodoList</span>
        <span class="msg" :class="{ show: flashOn }" aria-live="polite">
          {{ messageText }}
        </span>
      </div>
      <div class="controls">
        <button
          class="btn"
          :class="{ lock: locked }"
          :title="locked ? '解锁' : '锁定'"
          @click="toggleLock"
        >
          {{ locked ? "解锁" : "锁定" }}
        </button>
        <button
          class="btn"
          :class="{ pin: alwaysOnTop }"
          :title="alwaysOnTop ? '取消置顶' : '置顶'"
          @click="togglePin"
        >
          {{ alwaysOnTop ? "取消置顶" : "置顶" }}
        </button>
        <button class="btn" title="最小化" @click="minimize">—</button>
        <button class="btn close" title="关闭" @click="close">×</button>
      </div>
    </div>
  </header>
</template>

<script>
import { ipcRenderer } from "electron";

export default {
  props: {
    message: {
      type: String,
      default: ""
    },
    flash: {
      type: Boolean,
      default: false
    },
    locked: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      messageText: "",
      flashOn: false,
      flashTimer: null,
      alwaysOnTop: false
    };
  },
  async mounted() {
    try {
      this.alwaysOnTop = !!(await ipcRenderer.invoke("get-always-on-top"));
    } catch {
      this.alwaysOnTop = false;
    }
  },
  watch: {
    message: {
      immediate: true,
      handler(v) {
        this.messageText = v || "";
      }
    },
    flash(v) {
      if (!v) return;
      if (this.flashTimer) clearTimeout(this.flashTimer);
      this.flashOn = false;
      this.$nextTick(() => {
        this.flashOn = true;
        this.flashTimer = setTimeout(() => {
          this.flashOn = false;
          this.flashTimer = null;
        }, 900);
      });
    }
  },
  methods: {
    async togglePin() {
      try {
        this.alwaysOnTop = !!(await ipcRenderer.invoke("toggle-always-on-top"));
      } catch {}
    },
    toggleLock() {
      this.$emit("toggle-lock");
    },
    minimize() {
      try {
        ipcRenderer.invoke("minimize");
      } catch {}
    },
    close() {
      try {
        ipcRenderer.invoke("close");
      } catch {}
    }
  }
};
</script>

<style scoped>
.tb {
  height: 40px;
  width: 100%;
}
.drag {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  -webkit-app-region: drag;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: rgba(0, 0, 0, 0.18) 0 1px 8px;
}
.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
}
.base {
  opacity: 0.92;
}
.msg {
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
}
.msg.show {
  opacity: 1;
  transform: translateY(0);
  filter: saturate(1.15);
}
.controls {
  display: flex;
  gap: 6px;
  -webkit-app-region: no-drag;
}
.btn {
  min-width: 34px;
  padding: 0 10px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: rgba(17, 17, 17, 0.08);
  color: #111;
  cursor: pointer;
}
.btn:hover {
  background: rgba(17, 17, 17, 0.14);
}
.btn.lock {
  background: rgba(17, 17, 17, 0.14);
  box-shadow: inset rgba(0, 0, 0, 0.12) 0 0 0 1px;
}
.btn.pin {
  background: rgba(17, 17, 17, 0.14);
  box-shadow: inset rgba(0, 0, 0, 0.12) 0 0 0 1px;
}
.btn.close:hover {
  background: rgba(255, 0, 0, 0.18);
}
</style>
