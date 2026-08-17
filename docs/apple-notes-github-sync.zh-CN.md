<p align="center">
  <strong>简体中文</strong> · <a href="./apple-notes-github-sync.md">English</a>
</p>

# Apple Notes 到 GitHub 的同步

本文档说明当前已验证的 `blog` 分支同步链路。

## 当前架构

```text
macOS 上的 Notes.app
  -> scripts/notes/export-macos-notes.mjs
  -> notes-export/public-notes.json
  -> git commit/push origin/blog
  -> Cloudflare Pages 运行 pnpm verify
  -> scripts/notes/build-content-from-export.mjs 重新生成 content/**
```

GitHub 和 Cloudflare 无法直接读取 Apple Notes。Mac 是唯一读取 Apple Notes 的设备，但它不负责渲染最终网站；它只导出公开的原始快照，并在快照发生变化时将其推送。

## 发布范围

导出器读取 Apple Notes 中的一个父文件夹：

```text
guoyingwei.montaigne.io
```

根目录中名为 `index` 的笔记提供首页内容和菜单表格。这个菜单表格同时也是公开栏目的允许列表。只有当一个直接子文件夹的规范化名称出现在安全的本地菜单 URL 中时，该文件夹才会被导出。

示例：

```markdown
| menu | url | type |
| --- | --- | --- |
| 📒Blog | /blog | sidebar |
| 🎞️Photo | /photo | sidebar |
| 🧑‍💻About | /about/about-me | sidebar |
```

这会发布直接子文件夹 `Blog`、`Photo` 和 `About`。在已经列出的文件夹内新增笔记后，它会在 Mac 下次同步时自动发布。新增一个公开文件夹时，需要在根 `index` 的菜单表格中增加一行。

草稿规则：标题以 `_` 开头的笔记会在写入 `notes-export/public-notes.json` 前被跳过。

## 快照与转换

`notes-export/public-notes.json` 包含：

- 根文件夹元数据；
- 直接子栏目名称；
- 笔记标题、Apple Notes ID、创建时间和修改时间；
- 从 Notes.app 导出的 HTML 正文；
- Apple Notes 原生标签；
- 内嵌图片载荷及布局元数据；
- PDF、音频、视频及通用附件载荷和 MIME 元数据。

构建期间，转换器会：

- 创建 `content/index.md`；
- 创建 `content/blog/` 之类的栏目目录；
- 创建 `content/blog/mac-os-setting-preferences.md` 之类的笔记页面；
- 将内嵌 Base64 图片提取到 `content/media/<sha1>.<ext>`；
- 将非图片附件解码到 `content/media/attachments/`；
- 保留导出 HTML 中的图片顺序；
- 将表格、嵌套列表、行内等宽文本和等宽文本块转换为 Markdown；
- 渲染 PDF、音频、视频和通用附件区块；
- 将 Notes 原生标签写入生成的 frontmatter。

稳定身份由以下内容保证：

- 原始快照中的 Apple Notes `id`；
- 根据笔记标题确定性生成的 slug；
- 图片的内容哈希文件名。

`pnpm notes:build-content` 还会写入两个机器文件：

- `content/.moire-manifest.json`：记录所生成 Markdown 和媒体文件归属关系的 SHA-256 清单。
- `content/.moire-reconcile.json`：仅用于报告的新增或更新、删除及迁移计划。

这份报告有意保持非破坏性。它可以识别已删除、重命名或移动的输出路径，但当前部署不会自动删除仓库内容。

## 发布命令

本地手动发布但不推送：

```sh
pnpm notes:publish
```

自动发布并推送：

```sh
pnpm notes:publish:push
```

除非当前 Git 分支为 `blog`，否则发布脚本会拒绝运行。若启动前暂存区已有文件，它也会拒绝运行；随后执行 `git pull --ff-only origin blog`，以整合网页设置产生的提交。导出器会写入诊断结果，并将笔记、标签和附件数量与上一次快照比较；只有健康检查通过且快照发生变化时，才会只提交 `notes-export/public-notes.json`。

默认阈值允许每项数量最多下降 50%。只有在明确预期一次性大量删除时，才设置 `MOIRE_NOTES_MAX_DROP_RATIO`（例如 `0.8`）放宽阈值。

## LaunchAgent

在新 Mac 上用一条命令完成设置：

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
node scripts/notes/setup-macos-sync.mjs
```

设置脚本会安装依赖、执行一次 Apple Notes 导出以触发 macOS 自动化权限请求、根据当前 Node 路径和工作树路径渲染 LaunchAgent plist、安装并 kickstart 该任务，最后输出其状态。

安装后的 LaunchAgent 每 10 分钟运行一次：

```text
com.guoyingwei.moire-blog-notes
```

它会执行：

```text
/opt/homebrew/bin/node scripts/notes/publish-macos-notes.mjs --push true
```

这是一个由 `launchd` 调度的任务，不是持续运行的守护进程。两次运行之间，`launchctl print` 通常会显示 `state = not running`，这是正常现象。`launchd` 会在用户登录时以及每经过一次 `StartInterval` 秒数后启动一次新任务。

使用以下命令检查：

```sh
pnpm notes:agent:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
```

已经验证过的无变化行为是 `changed=false` 和 `pushed=false`。

使用以下命令安装或重新加载：

```sh
pnpm notes:agent:install
```

安装命令会使用当前 Node 路径和当前工作树路径渲染 `scripts/notes/launchd/com.guoyingwei.moire-blog-notes.plist`，随后将其加载到 `~/Library/LaunchAgents/`。这是迁移到新 Mac 或供其他用户使用时的首选方式。

如需更改运行间隔：

```sh
MOIRE_NOTES_INTERVAL=1800 pnpm notes:agent:install
MOIRE_NOTES_INTERVAL=1800 node scripts/notes/setup-macos-sync.mjs
```

稳定性规则：

- 除非当前分支为 `blog`，否则发布器会拒绝运行。
- 导出前使用 `--ff-only` 拉取 `origin/blog`，从而避免静默产生合并提交，并减少与网页设置提交发生冲突的可能性。
- 它只提交 `notes-export/public-notes.json`；Markdown、响应式图片和最终网站均由 Cloudflare 在构建期间重新生成。
- 如果某次运行失败，下一个时间间隔会再次尝试。可在 `logs/launchd.err.log` 中查看失败的命令。
