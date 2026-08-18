# Moire development

这是 `guoyingwei6/moire` 的个人 `development` 分支，基于上游
[`moirelog/moire`](https://github.com/moirelog/moire) 的 `main`。`main` 保持上游路线，
本分支集中放置个人 Apple Notes 笔记、轻量首页和实验性主题改动。

## 站点与部署

- Cloudflare Pages 项目：`moire-development`，生产别名：<https://moire-development.pages.dev/>
- GitHub Pages：<https://guoyingwei6.github.io/moire/>
- 预期自定义域名：<https://moire.guoyingwei.top/>
- 推送 `development` 会触发 GitHub Pages 的 `check → build → deploy`，Cloudflare Pages
  也会构建同一个分支。

## 这个分支增加了什么

### 笔记访问体验

- 每条笔记都有稳定地址：`/memo/<slug>/`，可以直接分享和收录。
- RSS 为每条笔记提供永久链接、完整标题和正文。
- Sitemap 收录所有公开笔记的永久地址。
- Classic 首页采用轻量的标题列表；点击标题进入完整笔记页。
- 当前首页没有接入站内搜索组件，README 不把未接入的功能当成已上线功能。

### 首页性能与 Markdown 逻辑

- Classic 首页只发送标题、日期、标签等列表元数据，不发送渲染后的正文 HTML；完整正文只在详情页使用。
- 标签在 Markdown token 渲染阶段生成，代码块、行内代码、链接和原始 HTML 中的 `#TODO`
  不会被误转换成标签按钮。
- 列表分页大小通过响应式配置读取，切换配置后不会继续使用旧的 `pageSize`。
- 保留六种主题：`classic`、`receipt`、`cyberpunk`、`academic`、`bento`、`pixel`。
- 默认关闭热力图，并更新站点作者、仓库链接和站点元信息。

### Apple Notes 内容

`src/memos/` 保存从 iPhone / Mac 同步来的笔记。同步动作只负责把内容提交到
`development`；网站构建再负责 Markdown 解析、主题渲染和静态页面生成。

## 本地开发与检查

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm run check
pnpm run build
```

`check` 使用 Svelte/TypeScript 检查，`build` 生成可部署的静态站点。

## 工作流边界

- `cleanup-images` 和 `memo-archive` 只手动触发，并固定操作 `development`。
- 图片清理脚本使用参数化的 `git rm`，不会把文件名拼进 Shell 命令。
- `development` 的部署工作流使用锁文件安装依赖，并在构建前执行 `check`。
- `main` 不会被本分支的笔记同步、清理或归档工作流自动修改。

## 与 blog 分支的区别

| 分支 | 重点 | 发布方式 |
| --- | --- | --- |
| `development` | 轻量标题列表、永久 Memo 页面、多主题实验 | GitHub Pages + Cloudflare Pages |
| `blog` | 完整 Apple Notes 文件夹博客、附件和自动发布 | Cloudflare Pages |

如果需要配置 Apple Notes 自动导出、LaunchAgent、媒体转换或发布快照，请查看
`blog` 分支的 README 和 `docs/` 文档。

## License

GPL-3.0.
