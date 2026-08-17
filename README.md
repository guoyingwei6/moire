
<div align="center">
  <img src="images/icon.svg" width="120" height="auto" alt="Moire Logo">
  <br/>
  <br/>
  <h1>Moire</h1>
  <p>
    Sync your thoughts from Apple Notes to GitHub Pages by Shortcuts.
  </p>
  <p>
    <a href="https://moire.blog">Moire</a> &nbsp;&nbsp;|&nbsp;&nbsp; <a href="https://docs.moire.blog">Docs</a> &nbsp;&nbsp;|&nbsp;&nbsp; <a href="https://themes.moire.blog">Themes</a>
  </p>
  <br/>
  <img src="images/moire.png" width="100%" alt="Moire Preview">
</div>

<br/>

> ## development 分支（本 fork 定制版）
>
> 本分支是 `guoyingwei6/moire` 的个人开发分支，基于上游 `moirelog/moire` 的 `main`。
> 以下特性只存在于 `development`，`main` 始终保持与上游一致（手动同步）。

### 站点与品牌

- 站点域名由 `moire.blog` 改为 `moire.guoyingwei.top`，站点作者更新为 Yingwei Guo
- `static/robots.txt` 的 Sitemap 指向新站点
- 默认关闭热力图（`moire.config.ts` 中 `heatmap: false`）

### 笔记体验

- **永久笔记页**：每条笔记有独立地址 `/memo/<slug>/`，可直接分享、可被搜索引擎收录
- **RSS / Sitemap 升级**：RSS 每条笔记带 permalink、完整标题与内容；Sitemap 生成所有笔记的永久链接
- **搜索与筛选**：新增 `MemoSearch` 组件，支持关键词搜索、按月筛选、按标签筛选、一键清空筛选
- 首页改为标题列表式备忘录索引，并恢复 classic 主题样式；更新站点署名与仓库链接

### 主题与构建

- 主题改为构建期动态解析（`virtual:moire-theme` 虚拟模块），支持 receipt / cyberpunk / academic / bento / pixel / classic 六种主题
- 重构 `Heatmap` 组件；`src/lib/server/memos.ts` 服务端逻辑增强（标题块/标签块清理、标签与月份聚合等）

### 部署与 CI（本分支专属）

- 推送到 `development` 自动部署：Cloudflare（`moire-development` 项目，主域名 `moire.guoyingwei.top`）+ GitHub Pages（`guoyingwei6.github.io/moire`）
- `cleanup-images` 与 `memo-archive` 工作流为**仅手动触发**；手动归档固定打包 `development` 分支的 `src/memos` 笔记

### 笔记内容

- `src/memos/` 下为个人 Apple Notes 同步的笔记（iPhone / Mac mini 自动同步推送至此分支）
