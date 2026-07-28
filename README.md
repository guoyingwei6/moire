<p align="center">
  <strong>简体中文</strong> · <a href="./README.en.md">English</a>
</p>

# Moire Blog

把 Apple Notes 中的文件夹树发布成一个 Montaigne 风格的个人网站。

当前线上站点：

- Blog 分支站点：<https://moireblog.guoyingwei.top>
- 生产分支：`blog`
- 部署平台：Cloudflare Pages

## 在线预览

<p align="center">
  <img src="./docs/images/homepage.jpg" alt="Moire Blog 首页" width="900">
</p>
<p align="center"><sub>首页</sub></p>

<p align="center">
  <img src="./docs/images/photo-section.jpg" alt="Moire Blog Photo 栏目" width="900">
</p>
<p align="center"><sub>由 Apple Notes 文件夹生成的栏目与标题列表</sub></p>

当前页脚文案为：

```text
Published from Apple Notes, versioned on GitHub, and deployed with Cloudflare Pages.
```

## 这个分支做什么

`blog` 分支是一套自托管的 Apple Notes 发布流程，并且刻意让 Mac
本地端保持轻量：

```text
iPhone Apple Notes
  -> iCloud 同步
  -> Mac Notes.app 导出器
  -> origin/blog 上的 notes-export/public-notes.json
  -> Cloudflare Pages 运行 pnpm build
  -> SvelteKit 生成静态网站
  -> https://moireblog.guoyingwei.top
```

Mac 只负责导出公开快照并推送到 GitHub。内容解析、Markdown
生成、响应式图片、网站渲染、RSS、Sitemap 和部署都在远程构建阶段完成。

## 为什么页面切换很快

访客打开页面时，网站不会查询 Apple Notes 或数据库。当前的快速访问路径是：

- Cloudflare 构建时由 SvelteKit 把每个公开路由预渲染成静态 HTML；
- Cloudflare Pages 从边缘网络直接提供这些文件；
- 站内链接使用 SvelteKit 客户端导航，并在鼠标悬停时预加载路由数据；
- 每个页面只携带自身需要的内容，不会加载整个 Notes 笔记库；
- 响应式图片在远程生成，并使用延迟加载和异步解码；
- `/_app/immutable/` 下带内容哈希的 CSS、JavaScript 和生成媒体使用一年的
  `immutable` 浏览器缓存；新构建会产生新的哈希 URL，因此长缓存不会让新部署失效。

Mac 不在访客的请求链路中。只要快照已经到达 GitHub，即使 Mac
之后休眠，已部署的网站仍然可以正常、快速地访问。

## 三个分支的职责

- `main`：原版/上游 Moire 路线，尽量保持与上游接近，独立部署在
  <https://moire.guoyingwei.top>。
- `development`：极简标题列表实验路线，独立部署在
  <https://moires.guoyingwei.top>；它不使用本分支的 macOS Apple Notes 导出器。
- `blog`：Montaigne 风格的 Apple Notes 文件夹网站，从 macOS 导出并由
  Cloudflare Pages 部署。

本地发布脚本会检查当前 Git 分支；不在 `blog` 分支时会拒绝发布。

## Apple Notes 目录结构

在 Apple Notes 中建立一个公开父文件夹：

```text
guoyingwei.montaigne.io
├── index
├── Blog
├── Photo
├── Music
├── Video
└── About
```

根目录的 `index` 笔记承担两个任务：

1. 提供首页内容。
2. 通过菜单表格控制允许公开的栏目和网站导航。

根 `index` 菜单表示例：

```markdown
| menu | url | type |
| --- | --- | --- |
| 🏠Home | / | sidebar |
| 📒Blog | /blog | sidebar |
| 🎞️Photo | /photo | sidebar |
| 🎧Music | /music | sidebar |
| 📺Video | /video | sidebar |
| 🏷️Tags | /tags | sidebar |
| 🧰Archive | /archive | sidebar |
| 🧑‍💻About | /about/about-me | sidebar |
```

只有表格中使用安全本地 URL 列出的直接子文件夹会被导出。已列出的文件夹中新建
笔记，会在 Mac 下次同步时自动发布；新建公开栏目时，只需在根 `index`
菜单表中增加一行。

草稿规则：标题以下划线 `_` 开头的笔记，会在写入原始快照前被跳过。

## 网站设置

全站设置保存在 `site.config.json`。

也可以在线修改：

```text
https://moireblog.guoyingwei.top/settings/
```

网站页脚中的作者名会链接到设置页，因此不需要手动输入地址。

设置页可以修改：

- 网站标题、作者、描述、域名、Logo Emoji 和从右向左文本；
- Twitter、Instagram、GitHub、YouTube、Mastodon 和公开邮箱；
- 背景色、正文色、次要文字色和链接色；
- 二维码、Tags、Archive、文件夹名、上一篇/下一篇、页脚和元数据开关。

保存设置时：

- 首次访问只显示管理员密码表单；
- 密码正确后创建一个有效期八小时的签名会话，同一浏览器后续保存不再重复输入密码；
- 密码错误时停留在登录页；
- 网页设置只会修改 `site.config.json`；
- 不会修改 Apple Notes 内容；
- 不会修改根 `index` 导航表；
- 保存会在 `blog` 分支创建一次 GitHub 提交；
- 随后 Cloudflare Pages 自动重新部署；
- 设置页保持打开，并在部署生效前显示圆角半透明提示。

Cloudflare Pages 需要两个仅服务端可见的环境变量：

```text
GITHUB_TOKEN
SETTINGS_PASSWORD
```

`GITHUB_TOKEN` 应使用仅限本仓库、只授予 Contents 读写权限的 fine-grained
GitHub Token。`SETTINGS_PASSWORD` 只由 Cloudflare Worker 校验；浏览器收到的是
`HttpOnly`、`Secure`、`SameSite=Strict` 的签名会话 Cookie，不会收到配置中的密码。

不要把这两个值写入仓库、前端代码或 URL。

## 渲染能力

网站会尽量保留 Apple Notes 中适合博客展示的结构：

- Montaigne 风格的左侧导航和奶油色背景；
- `/blog/`、`/photo/`、`/music/`、`/video/`、`/about/` 等栏目页；
- `/blog/mac-os-setting-preferences/` 这样的笔记详情页；
- 构建时把 Notes HTML 转换为 Markdown；
- 普通表格和两列信息表；
- 多层嵌套列表；
- 行内等宽文本和 Mono/代码块；
- Mono 代码块的基础 Shell 高亮；
- 单篇笔记包含多张图片；
- 相邻图片可并排显示；
- 导出 Apple Notes 原生标签，并用于 Tags 页面；
- PDF、音频、视频和普通文件附件；
- 标题以 `_` 开头的草稿不会发布；
- RSS Feed 和 Sitemap；
- 可由设置控制的 Tags 与 Archive 页面。

## 图片

仓库会保留从 Apple Notes 导出的原始图片。

构建时，`sharp` 会在 `content/responsive-media` 中生成用于网页显示的响应式
WebP 图片。这些派生文件被 Git 忽略，并由 Cloudflare 在每次构建时重新生成。

网页中的行为：

- 有派生图时，页面先加载体积较小的响应式 WebP；
- 点击图片会在当前页面打开大图浮层；
- 大图浮层支持左右按钮、键盘方向键和手机左右滑动浏览同一篇笔记中的图片；
- 无法转换的源图片会回退到原始文件。

这样既保留了原始图片，也避免每次打开页面都直接下载完整的 iPhone 原图。

## 附件

原始 Notes 快照可以携带 PDF、音频、视频和其他文件附件。远程构建会把它们解码
到 `content/media/attachments`，并按类型渲染：

- PDF：延迟加载的内嵌预览，并提供 Open 按钮；
- 录音和其他音频：浏览器原生音频播放器；
- 支持的视频：浏览器原生视频播放器；
- 其他文件：显示文件信息和 Open 按钮的附件卡片。

Mac 端只读取附件并将其加入原始快照；附件分类和 HTML 渲染都在远程构建阶段完成。

## 链接预览与嵌入

只有独占一行的裸链接会自动转换成嵌入模块或卡片；带说明文字的 Markdown
链接仍按普通链接显示。

自动预览示例：

```markdown
https://photos.guoyingwei.top
https://maps.apple.com/?ll=40.025272,116.286638&q=...
https://www.google.com/maps/place/Beijing/@39.904211,116.407395,10z
https://www.bilibili.com/video/BV...
https://www.xiaohongshu.com/explore/...
https://github.com/guoyingwei6/moire
https://doi.org/10.1038/s41586-020-2649-2
https://music.apple.com/...
https://youtu.be/...
https://open.spotify.com/...
https://podcasts.apple.com/...
https://tv.apple.com/...
```

当前支持：

- YouTube iframe；
- Apple Music iframe；
- Spotify iframe；
- Apple Podcasts iframe；
- Apple TV iframe；
- `photos.guoyingwei.top` 个人照片站卡片；
- Apple Maps 卡片；
- Google Maps 卡片；
- Bilibili 卡片；
- 小红书卡片；
- GitHub 仓库卡片；
- DOI 卡片。

本项目不会在本地导出时抓取任意网址的元数据。需要增加新的预览类型时，应添加
明确的白名单规则。

## 本地命令

在 `blog` worktree 中运行：

```sh
pnpm install
pnpm notes:export
pnpm notes:publish
pnpm notes:publish:push
pnpm notes:agent:install
pnpm notes:agent:status
pnpm setup:macos-sync
pnpm notes:build-content
pnpm build
pnpm test
pnpm check
pnpm test:build
```

命令说明：

- `pnpm notes:export`：读取公开 Apple Notes 目录树并写入
  `notes-export/public-notes.json`。
- `pnpm notes:publish`：导出；仅在快照变化时创建本地提交，不推送。
- `pnpm notes:publish:push`：导出；有变化时提交并推送到 `origin/blog`。
- `pnpm notes:agent:install`：安装或替换 macOS 自动同步 LaunchAgent。
- `pnpm notes:agent:status`：显示当前 LaunchAgent 状态。
- `pnpm setup:macos-sync`：为当前分支运行完整的 macOS 同步配置流程。
- `pnpm notes:build-content`：从原始快照重新生成 `content/**`。
- `pnpm build`：运行 `prebuild`、生成响应式媒体并构建 SvelteKit 静态站点。
- `pnpm test`：运行单元级安全和内容测试。
- `pnpm check`：运行 Svelte/TypeScript 检查。
- `pnpm test:build`：检查生成后的构建产物。

发布脚本会先执行 `git pull --ff-only origin blog`，以便在 Mac 推送新快照前，
先合并设置页产生的线上配置提交。

## Mac 自动同步

在已经安装 Git、Node.js 和 pnpm 的新 Mac 上：

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
node scripts/notes/setup-macos-sync.mjs
```

如果依赖已经安装，也可以使用较短的项目命令：

```sh
pnpm setup:macos-sync
```

配置脚本会检查分支、安装依赖、执行一次 Apple Notes 导出以触发 macOS
自动化权限提示、渲染当前机器专用的 LaunchAgent plist、安装到
`~/Library/LaunchAgents/`、启动任务并显示状态。

Mac 使用的是用户级 LaunchAgent 伪 Hook，而不是一个长期常驻的监视进程。
`launchd` 在用户登录后启动它，此后每 10 分钟再执行一次。每次运行只导出一次
Apple Notes，检查原始快照是否变化，仅在发生变化时提交并推送 `origin/blog`。

```text
/Users/guoyingwei/Library/LaunchAgents/com.guoyingwei.moire-blog-notes.plist
```

每 10 分钟执行：

```text
/opt/homebrew/bin/node scripts/notes/publish-macos-notes.mjs --push true
```

当前 Mac 上的安装行为：

- LaunchAgent label：`com.guoyingwei.moire-blog-notes`
- 触发方式：`RunAtLoad=true` 和 `StartInterval=600`
- 运行范围：仅用户会话；macOS 用户登录后启动，不会在登录前运行
- 两次任务之间的正常状态：`state = not running`
- 失败行为：本次运行退出，在下一个时间间隔再次尝试
- 无变化行为：`changed=false`、`pushed=false`，不会创建空提交

稳定性设计：

- `launchd` 负责监督。一次执行失败时，不会保留损坏的 Node 进程；下一个调度周期会重试。
- 脚本拒绝在 `blog` 以外的分支运行，因此不会意外发布到 `main` 或 `development`。
- 导出前执行 `git pull --ff-only origin blog`，先接收 `/settings/` 产生的配置修改，
  再推送新的 Notes 快照。
- 自动发布器只提交 `notes-export/public-notes.json`。Markdown、响应式图片和最终
  网站都由 Cloudflare 重新生成。
- 无变化的运行不会创建提交。

已知边界：这是登录会话中的 LaunchAgent，不是系统级守护进程。如果 Mac
关机、休眠、用户退出登录，或者 Notes 尚未从 iCloud 同步，就不会推送；Mac
唤醒并登录后，会在下一次成功运行时继续。

常用检查：

```sh
pnpm notes:agent:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
git status --short --branch
```

停止自动同步：

```sh
pnpm notes:agent:uninstall
```

启动或重新载入：

```sh
pnpm notes:agent:install
```

修改时间间隔时，可以编辑
`scripts/notes/launchd/com.guoyingwei.moire-blog-notes.plist` 中的
`StartInterval`，或者安装时传入环境变量：

```sh
MOIRE_NOTES_INTERVAL=1800 pnpm notes:agent:install
MOIRE_NOTES_INTERVAL=1800 node scripts/notes/setup-macos-sync.mjs
```

`600` 表示 10 分钟，`1800` 表示 30 分钟。安装脚本会把当前 Node 路径和
worktree 路径写入模板，因此仓库中的模板可以在不同机器和用户之间迁移。

正常的无变化输出是：

```text
changed=false
pushed=false
```

## Cloudflare Pages 配置

Cloudflare Pages 应使用：

- 仓库：`guoyingwei6/moire`
- 生产分支：`blog`
- 构建命令：`pnpm build`
- 输出目录：`build`
- 自定义域名：`moireblog.guoyingwei.top`
- 设置访问与写入所需环境变量：`SETTINGS_PASSWORD` 和 `GITHUB_TOKEN`

本分支不需要 GitHub Actions workflow。Cloudflare 直接从 `blog` 分支部署。

## 在另一台 Mac 上恢复

最短流程：

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
node scripts/notes/setup-macos-sync.mjs
```

前提条件：

- macOS 的 Notes.app 已登录拥有公开 Notes 文件夹的 iCloud 账户；
- Git 凭据能够推送目标仓库；
- 已安装 Node.js 和 pnpm；
- 已切换到 `blog` 分支。

首次运行时，macOS 可能询问 Terminal、iTerm 或 Codex 是否可以控制 Notes.app。
需要允许，否则导出器无法读取 Apple Notes。

配置后检查日志和 Git 状态：

```sh
pnpm notes:agent:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
git status --short --branch
```

其他用户或仓库 Fork 使用时，先修改以下内容：

- Apple Notes 根文件夹名：

```sh
node scripts/notes/setup-macos-sync.mjs --root "your.public.notes.folder"
```

- 如果不是 `origin` 和 `blog`，修改 Git remote 与分支；
- 修改 Cloudflare Pages 项目中的生产分支、构建命令，以及 `/settings/`
  写入需要的 `GITHUB_TOKEN`；
- 在 `site.config.json` 或 `/settings/` 中修改网站信息。

## 当前限制

- 只支持公开 Apple Notes 父文件夹的直接子文件夹；
- 新的公开文件夹需要在根 `index` 菜单表中增加一行；
- 触发器是每 10 分钟运行的 LaunchAgent 伪 Hook，不是真正的 Apple Notes
  数据库事件；
- 删除、改名和移动目前只生成对账报告。`content/.moire-manifest.json`
  记录生成文件的归属，`content/.moire-reconcile.json` 报告候选项，但不会自动删除；
- 不提供任意网址的通用预览；新的预览类型应通过明确的白名单规则增加。

## 许可证

本项目继续使用 GPL-3.0 许可证。
