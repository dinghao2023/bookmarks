import { ref, computed, watch } from "vue";

const STORAGE_KEY = "bookmark-hub-v1";

function defaultState() {
  return {
    categories: [{ id: "cat-default", name: "未分类", order: 0 }],
    links: [],
    activeCategoryId: "all",
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    if (!Array.isArray(data.categories) || !Array.isArray(data.links)) return defaultState();
    return {
      ...defaultState(),
      ...data,
      categories: data.categories.length ? data.categories : defaultState().categories,
    };
  } catch {
    return defaultState();
  }
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeUrl(input) {
  const t = input.trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function safeUrlKey(input) {
  try {
    const u = new URL(normalizeUrl(input));
    return `${u.protocol}//${u.host}${u.pathname}${u.search}${u.hash}`.toLowerCase();
  } catch {
    return "";
  }
}

function sanitizeImportedData(data) {
  const base = defaultState();
  const rawCategories = Array.isArray(data?.categories) ? data.categories : [];
  const rawLinks = Array.isArray(data?.links) ? data.links : [];

  const categories = [];
  const categoryIdSet = new Set();
  for (const item of rawCategories) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    const id = String(item.id ?? uid("cat"));
    if (categoryIdSet.has(id)) continue;
    categoryIdSet.add(id);
    categories.push({
      id,
      name,
      order: Number.isFinite(item.order) ? item.order : categories.length,
    });
  }

  if (!categories.some((x) => x.id === "cat-default")) {
    categories.unshift({ id: "cat-default", name: "未分类", order: -1 });
  }

  const links = [];
  const linkIdSet = new Set();
  const linkUrlSet = new Set();
  let droppedInvalidUrlCount = 0;

  for (const item of rawLinks) {
    if (!item || typeof item !== "object") continue;
    const title = String(item.title ?? "").trim();
    const normalized = normalizeUrl(String(item.url ?? ""));
    const urlKey = safeUrlKey(normalized);
    if (!title || !urlKey) {
      droppedInvalidUrlCount += 1;
      continue;
    }
    if (linkUrlSet.has(urlKey)) continue;

    const id = String(item.id ?? uid("link"));
    if (linkIdSet.has(id)) continue;
    linkIdSet.add(id);
    linkUrlSet.add(urlKey);

    const categoryId = categoryIdSet.has(String(item.categoryId))
      ? String(item.categoryId)
      : "cat-default";

    links.push({
      id,
      title,
      url: normalized,
      categoryId,
      newTab: item.newTab !== false,
      updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
    });
  }

  return {
    ...base,
    categories,
    links,
    activeCategoryId:
      typeof data?.activeCategoryId === "string" &&
      (data.activeCategoryId === "all" || categoryIdSet.has(data.activeCategoryId))
        ? data.activeCategoryId
        : "all",
    _droppedInvalidUrlCount: droppedInvalidUrlCount,
  };
}

export function useBookmarks() {
  const state = ref(loadState());
  const searchQuery = ref("");
  const sortMode = ref("updated-desc");
  let saveTimer = null;

  watch(
    state,
    (v) => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveState(v);
      }, 120);
    },
    { deep: true }
  );

  const sortedCategories = computed(() =>
    [...state.value.categories].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
    )
  );

  function categoryById(id) {
    return state.value.categories.find((c) => c.id === id);
  }

  const categoryCounts = computed(() => {
    const m = new Map();
    for (const link of state.value.links) {
      m.set(link.categoryId, (m.get(link.categoryId) || 0) + 1);
    }
    return m;
  });

  function countLinksInCategory(catId) {
    return categoryCounts.value.get(catId) || 0;
  }

  const filteredLinks = computed(() => {
    const q = (searchQuery.value || "").trim().toLowerCase();
    let list = state.value.links;

    if (state.value.activeCategoryId !== "all") {
      list = list.filter((l) => l.categoryId === state.value.activeCategoryId);
    }

    if (q) {
      list = list.filter((l) => {
        const title = (l.title || "").toLowerCase();
        const url = (l.url || "").toLowerCase();
        return title.includes(q) || url.includes(q);
      });
    }

    const sorted = [...list];
    if (sortMode.value === "title-asc") {
      sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortMode.value === "url-asc") {
      sorted.sort((a, b) => (a.url || "").localeCompare(b.url || ""));
    } else {
      sorted.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return sorted;
  });

  const currentCategoryTitle = computed(() => {
    if (state.value.activeCategoryId === "all") return "全部";
    return categoryById(state.value.activeCategoryId)?.name || "全部";
  });

  function setActiveCategory(id) {
    state.value.activeCategoryId = id;
  }

  function deleteCategory(id) {
    const c = categoryById(id);
    if (!c || c.id === "cat-default") {
      alert("无法删除该分类。");
      return;
    }
    const n = countLinksInCategory(id);
    if (!confirm(`确定删除分类「${c.name}」？${n ? `其中 ${n} 条链接将移到「未分类」。` : ""}`))
      return;

    const fallback =
      state.value.categories.find((x) => x.id === "cat-default")?.id || state.value.categories[0].id;
    state.value.links = state.value.links.map((l) =>
      l.categoryId === id ? { ...l, categoryId: fallback, updatedAt: Date.now() } : l
    );
    state.value.categories = state.value.categories.filter((x) => x.id !== id);
    if (state.value.activeCategoryId === id) state.value.activeCategoryId = "all";
  }

  function deleteLink(id) {
    if (!confirm("确定删除该链接？")) return;
    state.value.links = state.value.links.filter((l) => l.id !== id);
  }

  function upsertCategory(name, editingId) {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (editingId) {
      const c = categoryById(editingId);
      if (c) c.name = trimmed;
    } else {
      const maxOrder = Math.max(0, ...state.value.categories.map((c) => c.order ?? 0));
      state.value.categories.push({ id: uid("cat"), name: trimmed, order: maxOrder + 1 });
    }
  }

  function upsertLink({ title, url, categoryId, newTab, editingId }) {
    const t = title.trim();
    const u = normalizeUrl(url);
    const uKey = safeUrlKey(u);
    if (!t || !u) return false;

    try {
      void new URL(u);
    } catch {
      alert("请输入有效的网址。");
      return false;
    }

    const duplicated = state.value.links.find(
      (x) => x.id !== editingId && safeUrlKey(x.url) === uKey
    );
    if (duplicated) {
      const okMerge = confirm(`链接已存在（${duplicated.title}），是否覆盖为当前输入内容？`);
      if (!okMerge) return false;

      Object.assign(duplicated, {
        title: t,
        url: u,
        categoryId,
        newTab,
        updatedAt: Date.now(),
      });

      if (editingId) {
        state.value.links = state.value.links.filter((x) => x.id !== editingId);
      }
      return true;
    }

    if (editingId) {
      const l = state.value.links.find((x) => x.id === editingId);
      if (l) {
        Object.assign(l, { title: t, url: u, categoryId, newTab, updatedAt: Date.now() });
      }
    } else {
      state.value.links.push({
        id: uid("link"),
        title: t,
        url: u,
        categoryId,
        newTab,
        updatedAt: Date.now(),
      });
    }
    return true;
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state.value, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bookmarks-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importFromJsonText(text) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") {
        alert("文件格式不正确。");
        return;
      }
      if (!confirm("导入将覆盖当前所有数据，是否继续？")) return;
      const sanitized = sanitizeImportedData(data);
      state.value = {
        categories: sanitized.categories,
        links: sanitized.links,
        activeCategoryId: sanitized.activeCategoryId,
      };
      if (sanitized._droppedInvalidUrlCount > 0) {
        alert(`导入完成，已跳过 ${sanitized._droppedInvalidUrlCount} 条无效链接。`);
      }
    } catch {
      alert("无法解析该文件。");
    }
  }

  function defaultLinkCategoryId() {
    const ac = state.value.activeCategoryId;
    if (ac !== "all") return ac;
    return state.value.categories[0]?.id || "";
  }

  return {
    state,
    searchQuery,
    sortMode,
    sortedCategories,
    filteredLinks,
    currentCategoryTitle,
    categoryById,
    countLinksInCategory,
    setActiveCategory,
    deleteCategory,
    deleteLink,
    upsertCategory,
    upsertLink,
    exportJson,
    importFromJsonText,
    defaultLinkCategoryId,
  };
}
