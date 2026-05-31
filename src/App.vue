<script setup>
import { ref, nextTick } from "vue";
import { useBookmarks, normalizeUrl } from "./composables/useBookmarks.js";

const {
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
} = useBookmarks();

const categoryDialogRef = ref(null);
const linkDialogRef = ref(null);

const editingCategoryId = ref(null);
const categoryNameInput = ref("");

const editingLinkId = ref(null);
const linkForm = ref({
  title: "",
  url: "",
  categoryId: "",
  newTab: true,
});

function openCategoryModal(id = null) {
  editingCategoryId.value = id;
  if (id) {
    const c = categoryById(id);
    categoryNameInput.value = c?.name || "";
  } else {
    categoryNameInput.value = "";
  }
  categoryDialogRef.value?.showModal();
  nextTick(() => {
    const el = categoryDialogRef.value?.querySelector("#category-name");
    el?.focus();
  });
}

function closeCategoryModal() {
  categoryDialogRef.value?.close();
}

function submitCategory(e) {
  e.preventDefault();
  upsertCategory(categoryNameInput.value, editingCategoryId.value);
  closeCategoryModal();
}

function openLinkModal(id = null) {
  editingLinkId.value = id;
  if (id) {
    const l = state.value.links.find((x) => x.id === id);
    linkForm.value = {
      title: l?.title || "",
      url: l?.url || "",
      categoryId: l?.categoryId || sortedCategories.value[0]?.id || "",
      newTab: l?.newTab !== false,
    };
  } else {
    linkForm.value = {
      title: "",
      url: "",
      categoryId: defaultLinkCategoryId(),
      newTab: true,
    };
  }
  linkDialogRef.value?.showModal();
  nextTick(() => {
    const el = linkDialogRef.value?.querySelector("#link-title");
    el?.focus();
  });
}

function closeLinkModal() {
  linkDialogRef.value?.close();
}

function submitLink(e) {
  e.preventDefault();
  const ok = upsertLink({
    title: linkForm.value.title,
    url: linkForm.value.url,
    categoryId: linkForm.value.categoryId,
    newTab: linkForm.value.newTab,
    editingId: editingLinkId.value,
  });
  if (ok) closeLinkModal();
}

function onImportFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    importFromJsonText(typeof reader.result === "string" ? reader.result : "");
  };
  reader.readAsText(file);
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header__brand">
        <span class="logo" aria-hidden="true">◈</span>
        <div>
          <h1>网址收藏</h1>
          <p class="tagline">分类整理 · 一键直达</p>
        </div>
      </div>
      <div class="header__actions">
        <label class="search-wrap">
          <span class="sr-only">搜索</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="搜索标题或链接…"
            autocomplete="off"
          />
        </label>
        <button type="button" class="btn btn--ghost" title="导出备份" @click="exportJson">导出</button>
        <label class="btn btn--ghost btn--file">
          导入
          <input type="file" accept="application/json" hidden @change="onImportFile" />
        </label>
      </div>
    </header>

    <aside class="sidebar">
      <div class="sidebar__head">
        <h2>分类</h2>
        <button type="button" class="btn btn--small btn--primary" @click="openCategoryModal()">
          + 新建
        </button>
      </div>
      <ul class="category-list" role="tablist">
        <li class="category-item">
          <button
            type="button"
            class="cat-btn"
            role="tab"
            :aria-selected="state.activeCategoryId === 'all'"
            @click="setActiveCategory('all')"
          >
            <span>全部</span>
            <span class="cat-meta">{{ state.links.length }}</span>
          </button>
        </li>
        <li v-for="c in sortedCategories" :key="c.id" class="category-item">
          <button
            type="button"
            class="cat-btn"
            role="tab"
            :aria-selected="state.activeCategoryId === c.id"
            @click="setActiveCategory(c.id)"
          >
            <span>{{ c.name }}</span>
            <span class="cat-meta">{{ countLinksInCategory(c.id) }}</span>
          </button>
          <div class="cat-actions">
            <button type="button" class="icon-btn" title="重命名" @click.stop="openCategoryModal(c.id)">
              ✎
            </button>
            <button
              type="button"
              class="icon-btn icon-btn--danger"
              title="删除"
              @click.stop="deleteCategory(c.id)"
            >
              ×
            </button>
          </div>
        </li>
      </ul>
    </aside>

    <main class="main">
      <div class="toolbar">
        <div class="toolbar__left">
          <h2>{{ currentCategoryTitle }}</h2>
          <span class="count">{{ filteredLinks.length }} 条</span>
        </div>
        <div class="toolbar__right">
          <label class="sort-wrap">
            <span class="sr-only">排序方式</span>
            <select v-model="sortMode" class="sort-select">
              <option value="updated-desc">最近更新</option>
              <option value="title-asc">标题 A-Z</option>
              <option value="url-asc">网址 A-Z</option>
            </select>
          </label>
          <button type="button" class="btn btn--primary" @click="openLinkModal()">+ 添加链接</button>
        </div>
      </div>
      <div class="link-grid">
        <article v-for="link in filteredLinks" :key="link.id" class="link-card">
          <h3 class="link-card__title">
            <a
              :href="normalizeUrl(link.url)"
              :target="link.newTab !== false ? '_blank' : undefined"
              :rel="link.newTab !== false ? 'noopener noreferrer' : undefined"
              >{{ link.title }}</a
            >
          </h3>
          <p class="link-card__url">{{ link.url }}</p>
          <div class="link-card__footer">
            <span class="link-card__cat">{{ categoryById(link.categoryId)?.name || "未分类" }}</span>
            <div class="link-card__actions">
              <button type="button" class="icon-btn" title="编辑" @click="openLinkModal(link.id)">
                ✎
              </button>
              <button type="button" class="icon-btn icon-btn--danger" title="删除" @click="deleteLink(link.id)">
                ×
              </button>
            </div>
          </div>
        </article>
      </div>
      <p class="empty-hint" :class="{ 'is-visible': filteredLinks.length === 0 }">
        暂无链接，点击「添加链接」开始收藏。
      </p>
    </main>
  </div>

  <dialog ref="categoryDialogRef" class="modal">
    <form class="modal__form" @submit="submitCategory">
      <h3>{{ editingCategoryId ? "编辑分类" : "新建分类" }}</h3>
      <label>
        名称
        <input
          id="category-name"
          v-model="categoryNameInput"
          type="text"
          required
          maxlength="32"
          placeholder="例如：开发工具"
        />
      </label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="closeCategoryModal">取消</button>
        <button type="submit" class="btn btn--primary">保存</button>
      </div>
    </form>
  </dialog>

  <dialog ref="linkDialogRef" class="modal">
    <form class="modal__form" @submit="submitLink">
      <h3>{{ editingLinkId ? "编辑链接" : "添加链接" }}</h3>
      <label>
        标题
        <input
          id="link-title"
          v-model="linkForm.title"
          type="text"
          required
          maxlength="120"
          placeholder="显示名称"
        />
      </label>
      <label>
        网址
        <input id="link-url" v-model="linkForm.url" type="url" required placeholder="https://example.com" />
      </label>
      <label>
        分类
        <select id="link-category" v-model="linkForm.categoryId">
          <option v-for="c in sortedCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label class="checkbox-row">
        <input v-model="linkForm.newTab" type="checkbox" />
        <span>在新标签页打开</span>
      </label>
      <div class="modal__actions">
        <button type="button" class="btn btn--ghost" @click="closeLinkModal">取消</button>
        <button type="submit" class="btn btn--primary">保存</button>
      </div>
    </form>
  </dialog>
</template>
