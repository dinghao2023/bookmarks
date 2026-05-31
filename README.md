# 网址收藏

一个轻量的本地书签管理工具：按分类整理常用链接，支持搜索、排序与 JSON 备份。

数据保存在浏览器 `localStorage`，无需后端，打开即用。

## 功能

- 分类管理（新建、重命名、删除；删除时链接归入「未分类」）
- 链接增删改，可选新标签页打开
- 按标题或 URL 搜索
- 排序：最近更新 / 标题 A-Z / 网址 A-Z
- JSON 导入 / 导出备份

## 技术栈

- Vue 3（Composition API）
- Vite 6

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
npm run preview
```

## 数据说明

- 存储键：`bookmark-hub-v1`（浏览器 `localStorage`）
- 数据不会上传到任何服务器
- 导出文件为 `bookmarks-backup-YYYY-MM-DD.json`，请勿将含个人书签的备份提交到公开仓库

## 许可

MIT
