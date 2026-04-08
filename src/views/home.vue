<template>
  <div id="home" @click="clearTodoSelection">
    <div @click.stop>
      <TitleBar
        :message="titleMsg"
        :flash="titleFlash"
        :locked="locked"
        @toggle-lock="toggleLocked"
      />
    </div>
    <div @click.stop>
      <TodoList ref="todo" @status="onStatus" @lock="locked = $event" />
    </div>
  </div>
</template>

<script>
import TodoList from "../components/TodoList.vue";
import TitleBar from "../components/TitleBar.vue";

export default {
  data() {
    return {
      titleMsg: "",
      titleFlash: false,
      flashTimer: null,
      locked: false
    };
  },
  components: {
    TitleBar,
    TodoList
  },
  methods: {
    clearTodoSelection() {
      try {
        if (this.$refs.todo && this.$refs.todo.clearSelection) {
          this.$refs.todo.clearSelection();
        }
      } catch {}
    },
    toggleLocked() {
      try {
        const next = !this.locked;
        if (this.$refs.todo && this.$refs.todo.setLocked) {
          this.$refs.todo.setLocked(next);
        } else {
          this.locked = next;
        }
      } catch {}
    },
    onStatus(payload) {
      const text = payload && payload.text ? payload.text : "";
      const flash = !!(payload && payload.flash);
      this.titleMsg = text;
      if (flash) {
        this.titleFlash = false;
        this.$nextTick(() => {
          this.titleFlash = true;
        });
        if (this.flashTimer) clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
          this.titleFlash = false;
          this.flashTimer = null;
        }, 950);
      }
    }
  }
};
</script>
