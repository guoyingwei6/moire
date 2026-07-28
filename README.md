<p align="center">
  <strong>简体中文</strong> · <a href="./README.en.md">English</a>
</p>

# Moire Blog

把 Apple Notes 变成一个完全由自己掌控的静态网站。

Mac 只负责导出公开笔记，GitHub 保存版本，Cloudflare 负责解析、构建和部署。网站借鉴
[Montaigne](https://docs.montaigne.io/) 的“文件夹即栏目”和简洁阅读体验，但不依赖
Montaigne 的账户或服务器。

<p align="center">
  <a href="https://moireblog.guoyingwei.top"><strong>在线站点</strong></a>
  ·
  <a href="#快速开始"><strong>快速开始</strong></a>
  ·
  <a href="#文档导航"><strong>文档</strong></a>
</p>

## 预览

<p align="center">
  <img src="./docs/images/homepage.jpg" alt="Moire Blog 首页" width="900">
</p>
<p align="center"><sub>首页与侧栏导航</sub></p>

<p align="center">
  <img src="./docs/images/photo-section.jpg" alt="Moire Blog Photo 栏目" width="900">
</p>
<p align="center"><sub>Apple Notes 文件夹生成的栏目与标题列表</sub></p>

## 为什么做这个项目

- **Apple Notes 就是编辑器**：在 iPhone 或 Mac 上写笔记、放图片、录音和 PDF。
- **完全自托管**：公开内容只经过自己的 Mac、GitHub 仓库和 Cloudflare 项目。
- **本地保持轻量**：Mac 不负责生成网站，只导出一份原始快照并推送。
- **保留 Notes 的结构**：文件夹、标题、表格、列表、Mono、标签和附件都能进入网站。
- **静态站点很快**：访客读取 Cloudflare 边缘节点上的静态 HTML，不会实时查询 Notes。
- **配置可审计**：内容、站点设置和每次发布都有 Git 历史，可以回看和恢复。

## 工作方式

```text
iPhone / Mac 上的 Apple Notes
              ↓ iCloud
       macOS 只读导出器
              ↓
 notes-export/public-notes.json
              ↓ git push
       GitHub 的 blog 分支
              ↓ 自动构建
         Cloudflare Pages
              ↓
   HTML / RSS / Sitemap / 媒体
```

| 阶段 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| macOS | 读取指定 Notes 父文件夹；生成原始快照；有变化时提交并推送 | Markdown 转换、图片压缩、网站构建 |
| GitHub | 保存快照、代码、配置和发布历史 | 直接读取 Apple Notes |
| Cloudflare | 远程解析、生成响应式媒体、SvelteKit 静态构建和边缘分发 | 修改 Apple Notes |

只要新快照已经推到 GitHub，Mac 后续关机或休眠不会影响已部署网站的访问。

## 快速开始

### 1. 克隆并进入 `blog` 分支

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
```

需要 macOS、Notes.app、Git、Node.js 和 pnpm。Fork 使用者应把仓库地址替换为自己的仓库。

### 2. 准备 Apple Notes

建立一个只放公开内容的父文件夹：

```text
your.public.notes.folder
├── index
├── Blog
├── Photo
├── Music
├── Video
└── About
```

根目录必须有一篇名为 `index` 的笔记。它的正文是首页内容，其中的菜单表格同时决定
网站导航和允许导出的直接子文件夹：

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

在已授权栏目中新增普通笔记不需要再改配置。标题以 `_` 开头的笔记会作为轻量草稿，
不进入栏目、Tags、Archive、RSS 和 Sitemap。

### 3. 一次性配置 Mac 同步

```sh
node scripts/notes/setup-macos-sync.mjs --root "your.public.notes.folder"
```

脚本会安装依赖、触发 Notes 自动化权限、安装用户级 LaunchAgent，并立即显示状态。
默认在用户登录后和每 10 分钟运行一次；没有变化时不会创建空提交。

手动验证：

```sh
pnpm notes:publish
pnpm notes:agent:status
```

确认快照正确后，手动推送一次：

```sh
pnpm notes:publish:push
```

### 4. 连接 Cloudflare Pages

创建 Pages 项目并使用：

```text
Production branch: blog
Build command: pnpm build
Build output directory: build
Root directory: repository root
```

若要使用在线设置页，再配置两个只在服务端可见的 Secret：

```text
GITHUB_TOKEN
SETTINGS_PASSWORD
```

`GITHUB_TOKEN` 建议使用只允许当前仓库 Contents 读写的 fine-grained token。不要把
Token 或密码写进仓库、前端代码或 URL。完整部署说明见
[Cloudflare Pages 部署](./docs/cloudflare-pages.zh-CN.md)。

## 主要功能

| 能力 | 当前实现 |
| --- | --- |
| 内容结构 | 一个公开父文件夹；根 `index` 控制首页、导航和发布范围；直接子文件夹成为栏目 |
| 页面 | 栏目列表、稳定笔记 URL、Tags、Archive、Search、RSS、Sitemap、404 |
| 富文本 | 标题、表格、多层列表、行内 Mono、代码块和基础 Shell 高亮 |
| 图片 | 多图、原始排列、并排图片、响应式 WebP、原图保留、灯箱、键盘/滑动翻图 |
| 附件 | PDF 内嵌预览、音频播放器、视频播放器、普通文件卡片 |
| 原生标签 | 从 Notes 数据库读取真正的 Apple Notes tags，并生成 Tags 页面 |
| 链接预览 | YouTube、Apple Music、Spotify、Apple Podcasts/TV、地图、Bilibili、小红书、GitHub、DOI 等白名单类型 |
| 页面设置 | 根/文件夹/单篇笔记的 `name/value` 表格；继承与覆盖规则 |
| 全站设置 | 密码保护的 `/settings/`；修改标题、作者、颜色、社交链接和显示开关 |
| 发布安全 | 只允许安全本地路径；非 `blog` 分支拒绝发布；设置 API 只能写 `site.config.json` |

本项目不为任意网址生成通用预览。新增预览类型需要一条明确的白名单规则，避免在
本地导出或远程构建时抓取未知页面。

## 配置从哪里来

| 配置来源 | 适合管理的内容 |
| --- | --- |
| `/settings/` / `site.config.json` | 网站标题、作者、域名、颜色、社交链接和默认显示开关 |
| 根 `index` | 首页正文、Sidebar/Header/Footer 导航和公开栏目白名单 |
| 文件夹 `index` 的 `name/value` 表 | 栏目布局、排序、子级显示和栏目默认项 |
| 普通笔记的 `name/value` 表 | 当前笔记的日期、slug、aliases、导航、元数据和显示覆盖 |
| 笔记正文 | 实际文章、图片、标签、链接和附件 |

页面级选项按下面的顺序覆盖：

```text
单篇笔记 > 文件夹 index > 根 index > site.config.json 默认值
```

全站身份、颜色和社交信息只由 `/settings/` / `site.config.json` 管理，不会被下一次
Notes 同步覆盖。详细字段见
[Apple Notes 配置参考](./docs/configuration.zh-CN.md)。

## 日常发布

日常使用只需要在 Apple Notes 中编辑：

1. iCloud 把更改同步到 Mac。
2. `launchd` 在下一次调度时运行导出器。
3. 快照有变化时，脚本提交并推送 `origin/blog`。
4. Cloudflare 自动构建并上线。

常用命令：

```sh
pnpm notes:publish          # 只在本地提交变化
pnpm notes:publish:push     # 有变化时提交并推送
pnpm notes:agent:status     # 查看自动同步状态
pnpm notes:agent:restart    # 重新载入 LaunchAgent
pnpm notes:agent:uninstall  # 停止自动同步
pnpm test                   # 内容与安全测试
pnpm check                  # Svelte / TypeScript 检查
pnpm build                  # 完整静态构建
pnpm test:build             # 检查构建产物
```

LaunchAgent 不是一直占用资源的常驻 Node 进程。每次运行完成后退出，由 macOS
`launchd` 在下个时间间隔重新启动；失败后也会在下一轮重试。

## 性能设计

网站快的原因不只是使用 SvelteKit，而是整条交付路径都以静态内容为中心：

- 每个公开路由在构建时预渲染为静态 HTML；
- Cloudflare Pages 从边缘节点分发页面和媒体；
- 站内使用客户端无刷新导航，并在悬停时预加载目标路由；
- 每个页面只携带自身数据，不把整个笔记库塞进浏览器；
- 图片远程生成响应式 WebP，并使用延迟加载和异步解码；
- 带内容哈希的 CSS、JavaScript 和派生媒体使用一年 `immutable` 缓存；
- 上一篇/下一篇、Tags 和 Archive 在构建期预计算并复用；
- 响应式图片按原图哈希增量生成，Cloudflare Build Cache 可跨部署复用。

因此，即使内容增加，访客打开一篇已经部署的文章仍然只是读取静态文件。真正需要
观察的是远程构建时间；等真实规模需要时，再引入栏目分页或 Pagefind 分块搜索，
而不是提前增加复杂度。

## 文档导航

README 只负责介绍、首次部署和日常入口；细节按任务拆开：

| 文档 | 什么时候看 |
| --- | --- |
| [Apple Notes → GitHub 同步](./docs/apple-notes-github-sync.zh-CN.md) | 了解导出器、快照、LaunchAgent、日志和迁移 |
| [内容与配置参考](./docs/configuration.zh-CN.md) | 配置根 `index`、栏目、笔记 metadata、slug、aliases 和草稿 |
| [Cloudflare Pages 部署](./docs/cloudflare-pages.zh-CN.md) | 配置构建、Secret、缓存、自定义域和在线设置 |
| [发布清单与对账](./docs/publish-manifest.zh-CN.md) | 调试删除、改名、移动和生成文件归属 |
| [Montaigne 功能对照](./docs/montaigne-parity.zh-CN.md) | 查看设计来源、兼容范围和历史实现取舍 |

`docs/montaigne-parity.zh-CN.md` 是设计对照与历史记录，不是当前安装入口。

## 三个分支

| 分支 | 作用 | 部署 |
| --- | --- | --- |
| `main` | 尽量保持原版/上游 Moire 路线 | <https://moire.guoyingwei.top> |
| `development` | 极简标题列表路线；内容由 `main` 同步 | <https://moires.guoyingwei.top> |
| `blog` | 本 README 描述的 macOS Apple Notes 文件夹博客 | <https://moireblog.guoyingwei.top> |

三条路线独立部署、互不覆盖。本地 Notes 发布器只允许向 `blog` 分支写入。

## 当前边界

- 目前只把公开父文件夹的直接子文件夹作为栏目；
- 新公开栏目需要在根 `index` 菜单表增加一行；
- 自动触发是定时 LaunchAgent，不是真正的 Notes 数据库事件 Hook；
- 删除、改名和移动会生成对账报告；仓库级自动清理仍保持保守；
- 大量文章时，静态页面访问仍快，但应根据真实构建时间再决定是否分页或拆分搜索索引。

## 许可证

GPL-3.0。
