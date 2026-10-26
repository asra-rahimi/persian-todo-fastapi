/* کارهای من — فرانت‌اند متصل به بک‌اند FastAPI */
(() => {
  "use strict";

  const API = "/api";
  const THEME_KEY = "todos.theme";

  const TAGS = [
    { id: "personal", label: "شخصی", color: "#8b5cf6" },
    { id: "uni", label: "دانشگاه", color: "#22d3ee" },
    { id: "work", label: "کار", color: "#ff4d8d" },
    { id: "shop", label: "خرید", color: "#fbbf24" },
  ];
  const tagOf = (id) => TAGS.find((t) => t.id === id) || TAGS[0];

  /** @type {{id:number, text:string, done:boolean, prio:string, tag:string}[]} */
  let todos = [];
  let filter = "all";
  let prio = "med";
  let newTag = "personal";
  let tagFilter = null;
  let query = "";

  /* ---------- عناصر ---------- */
  const $ = (id) => document.getElementById(id);
  const listEl = $("list");
  const emptyEl = $("empty");
  const formEl = $("form");
  const inputEl = $("input");
  const searchEl = $("search");
  const barEl = $("bar");
  const pctEl = $("pct");
  const clearEl = $("clear");
  const toastEl = $("toast");
  const tagbarEl = $("tagbar");

  /* ---------- ابزارها ---------- */
  const fa = (n) => String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }

  /* ---------- ارتباط با سرور ---------- */
  async function api(path, options = {}) {
    const response = await fetch(API + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data.detail;
      throw new Error(typeof detail === "string" ? detail : "خطا در ارتباط با سرور");
    }
    return data;
  }

  /** خطا را بدون شکستن رابط کاربری نشان می‌دهد */
  async function guard(action, fallbackMessage) {
    try {
      await action();
    } catch (error) {
      toast(error.message || fallbackMessage);
      console.error(error);
    }
  }

  function replaceLocal(updated) {
    const index = todos.findIndex((t) => t.id === updated.id);
    if (index !== -1) todos[index] = updated;
  }

  /* ---------- عملیات ---------- */
  async function refresh() {
    const data = await api("/todos");
    todos = data.todos;
    render();
  }

  async function add(text) {
    const value = text.trim();
    if (!value) return;

    const created = await api("/todos", {
      method: "POST",
      body: JSON.stringify({ text: value, prio: prio, tag: newTag }),
    });
    todos.unshift(created);
    render();
    toast("اضافه شد ✓");
  }

  async function toggle(id) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const updated = await api(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ done: !todo.done }),
    });
    replaceLocal(updated);
    render();
    if (updated.done) celebrate();
  }

  async function remove(id) {
    const node = listEl.querySelector(`[data-id="${id}"]`);
    if (node) node.classList.add("leaving");
    await api(`/todos/${id}`, { method: "DELETE" });
    todos = todos.filter((t) => t.id !== id);
    setTimeout(render, node ? 190 : 0);
  }

  async function rename(id, text) {
    const value = text.trim();
    if (!value) {
      await remove(id);
      return;
    }
    const updated = await api(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ text: value }),
    });
    replaceLocal(updated);
    render();
    toast("ویرایش شد ✓");
  }

  async function clearDone() {
    const { deleted } = await api("/todos/clear-done", { method: "POST" });
    await refresh();
    toast(fa(deleted) + " کار پاک شد");
  }

  function celebrate() {
    if (!todos.length || !todos.every((t) => t.done)) return;
    toast("همه‌ی کارها انجام شد! 🎉");
  }

  /* ---------- فیلتر و نمایش ---------- */
  function visible() {
    const needle = query.trim().toLowerCase();
    return todos.filter((todo) => {
      if (filter === "active" && todo.done) return false;
      if (filter === "done" && !todo.done) return false;
      if (tagFilter && todo.tag !== tagFilter) return false;
      if (needle && todo.text.toLowerCase().indexOf(needle) === -1) return false;
      return true;
    });
  }

  function startEdit(container, textEl, id) {
    if (container.querySelector("input.edit")) return;
    const editor = document.createElement("input");
    editor.className = "edit";
    editor.value = textEl.textContent;
    editor.maxLength = 140;

    Object.assign(editor.style, {
      width: "100%",
      font: "inherit",
      color: "inherit",
      background: "rgba(0,0,0,.25)",
      border: "1.5px solid #8b5cf6",
      borderRadius: "10px",
      padding: "6px 10px",
      outline: "none",
    });

    container.replaceChild(editor, textEl);
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);

    let finished = false;
    const commit = () => {
      if (finished) return;
      finished = true;
      guard(() => rename(id, editor.value), "ویرایش انجام نشد");
    };

    editor.addEventListener("blur", commit);
    editor.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") {
        finished = true;
        render();
      }
    });
  }

  function itemNode(todo) {
    const li = el("li", "item" + (todo.done ? " done" : ""));
    li.dataset.id = todo.id;
    li.dataset.prio = todo.prio;

    const check = el("button", "check");
    check.type = "button";
    check.setAttribute(
      "aria-label",
      todo.done ? "برگرداندن به فعال" : "علامت زدن به‌عنوان انجام‌شده"
    );
    check.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';
    check.addEventListener("click", () => guard(() => toggle(todo.id), "تغییر وضعیت نشد"));

    const content = el("div", "content");
    const text = el("span", "text", todo.text);
    text.tabIndex = 0;
    text.title = "برای ویرایش دوبار کلیک کن";
    text.addEventListener("dblclick", () => startEdit(content, text, todo.id));

    const tag = tagOf(todo.tag);
    const tagEl = el("span", "tag", tag.label);
    tagEl.style.setProperty("--tag-color", tag.color);
    tagEl.title = "فیلتر بر اساس این برچسب";
    tagEl.addEventListener("click", () => {
      tagFilter = tagFilter === tag.id ? null : tag.id;
      render();
    });

    content.append(text, tagEl);

    const del = el("button", "del", "✕");
    del.type = "button";
    del.setAttribute("aria-label", "حذف کار");
    del.addEventListener("click", () => guard(() => remove(todo.id), "حذف نشد"));

    li.append(check, content, del);
    return li;
  }

  function updateStats() {
    const done = todos.filter((t) => t.done).length;
    const total = todos.length;
    const percent = total ? Math.round((done / total) * 100) : 0;

    barEl.style.width = percent + "%";
    pctEl.textContent = fa(percent) + "٪";
    $("progress").setAttribute("aria-valuenow", String(percent));

    $("c-all").textContent = fa(total);
    $("c-active").textContent = fa(total - done);
    $("c-done").textContent = fa(done);

    clearEl.hidden = done === 0;
  }

  function updateTagbar() {
    if (!tagFilter) {
      tagbarEl.hidden = true;
      return;
    }
    const tag = tagOf(tagFilter);
    tagbarEl.hidden = false;
    const label = $("tagbar-text");
    label.textContent = "نمایش برچسب «" + tag.label + "»";
    label.style.color = tag.color;
  }

  function render() {
    listEl.replaceChildren();
    const items = visible();
    items.forEach((todo) => listEl.appendChild(itemNode(todo)));

    const isEmpty = items.length === 0;
    emptyEl.classList.toggle("show", isEmpty);

    if (isEmpty) {
      const titleEl = emptyEl.querySelector(".empty-title");
      const subEl = emptyEl.querySelector(".empty-sub");
      if (query.trim()) {
        titleEl.textContent = "چیزی پیدا نشد";
        subEl.textContent = "عبارت دیگری را امتحان کن";
      } else if (tagFilter) {
        titleEl.textContent = "در این برچسب کاری نیست";
        subEl.textContent = "فیلتر برچسب را بردار یا کار جدیدی اضافه کن";
      } else if (filter === "active" && todos.length) {
        titleEl.textContent = "همه‌ی کارها انجام شده";
        subEl.textContent = "چیزی برای انجام باقی نمانده 🎉";
      } else if (filter === "done" && todos.length) {
        titleEl.textContent = "هنوز کاری انجام نشده";
        subEl.textContent = "اولین تیک را بزن";
      } else {
        titleEl.textContent = "هنوز کاری اضافه نکردی";
        subEl.textContent = "اولین کارت را بنویس و شروع کن";
      }
    }

    updateTagbar();
    updateStats();
  }

  /* ---------- انتخاب برچسب ---------- */
  function buildTagPicker() {
    const box = $("tagPick");
    TAGS.forEach((tag) => {
      const btn = el("button", "tag-btn" + (tag.id === newTag ? " is-active" : ""));
      btn.type = "button";
      btn.dataset.tag = tag.id;
      btn.style.setProperty("--tag-color", tag.color);
      btn.appendChild(el("i"));
      btn.appendChild(document.createTextNode(tag.label));
      btn.addEventListener("click", () => {
        newTag = tag.id;
        box.querySelectorAll(".tag-btn").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.tag === newTag);
        });
      });
      box.appendChild(btn);
    });
  }

  /* ---------- تم (محلی، ربطی به سرور ندارد) ---------- */
  function applyTheme(theme) {
    const isLight = theme === "light";
    document.documentElement.dataset.theme = isLight ? "light" : "dark";
    $("theme-icon").textContent = isLight ? "☀️" : "🌙";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* نادیده */
    }
  }

  function initTheme() {
    let theme = null;
    try {
      theme = localStorage.getItem(THEME_KEY);
    } catch {
      /* نادیده */
    }
    if (!theme) {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    applyTheme(theme);
  }

  /* ---------- رویدادها ---------- */
  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = inputEl.value;
    inputEl.value = "";
    guard(() => add(value), "افزودن انجام نشد");
  });

  document.querySelectorAll(".prio-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      prio = btn.dataset.prio;
      document.querySelectorAll(".prio-btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
    });
  });

  document.querySelectorAll(".filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      document.querySelectorAll(".filter").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
      render();
    });
  });

  searchEl.addEventListener("input", () => {
    query = searchEl.value;
    render();
  });

  $("tagbar-clear").addEventListener("click", () => {
    tagFilter = null;
    render();
  });

  $("theme").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(next);
  });

  clearEl.addEventListener("click", () => guard(clearDone, "پاک کردن انجام نشد"));

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const typing = active && /^(INPUT|TEXTAREA)$/.test(active.tagName);
    if (e.key === "/" && !typing) {
      e.preventDefault();
      searchEl.focus();
    } else if (e.key === "Escape" && active === searchEl) {
      searchEl.value = "";
      query = "";
      render();
      searchEl.blur();
    }
  });

  /* ---------- شروع ---------- */
  initTheme();
  buildTagPicker();
  guard(refresh, "اتصال به سرور برقرار نشد");
})();
