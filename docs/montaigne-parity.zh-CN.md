<p align="center">
  <strong>简体中文</strong> · <a href="./montaigne-parity.md">English</a>
</p>

# Montaigne 功能对照

> 历史设计说明。自 2026-07-27 起，当前实现采用 macOS Notes.app 导出器和 LaunchAgent，详见 [README](../README.md) 与 [Apple Notes → GitHub 同步](./apple-notes-github-sync.zh-CN.md)。下文的 iPhone 快捷指令约定仅作为早期研究保留，并非当前发布链路。

本文记录 2026-07-25 对 Montaigne 公开文档的审查结果，并将文档证据与 Moire 的实现声明分开。审查覆盖 Sitemap 中全部 52 篇文章：22 篇 Features、16 篇 Guides、10 篇 Demo，以及 FAQ、Limits、Changelog 和 Roadmap。另行检查了四个栏目入口页、Archive、Search、Feeds、Sitemap、robots、PDF 和 QR 端点。

## 文件夹与 index 模型

Montaigne 的服务账号读取用户共享的 Apple Notes 文件夹树。每个直接子文件夹会成为一个 Collection，并发布其中的直属笔记。根 `index` 控制全局 metadata 和自定义导航；Collection 级 `index` 是可选的，只负责自定义当前 Collection。Montaigne 文档只描述一层子文件夹，不支持任意深度的 Notes 嵌套。

Moire 无法使用 Montaigne 的私有服务账号。早期为 iPhone 设计的替代方案是：

```text
一个固定的公开根 FolderEntity
  -> 根目录中恰好有一篇标题为 index 的笔记
  -> 现有 menu | link | type 行组成允许列表
  -> 规范化后的菜单文字与直接子 Folder 的显示名称匹配
  -> 本地链接决定 content/ 下的目标位置
  -> 匹配到的笔记数必须等于所选 FolderEntity 的笔记数
```

在已授权文件夹中新增普通笔记不需要修改配置。新增公开 Collection 时，只需在根 `index` 菜单中增加一行。历史设计阶段接受过一个环境约束：私人文件夹或跨账号文件夹不得复用允许列表中的公开文件夹名称；一旦发现重名，该设计会停止整批同步。

## blog 分支已实现

- 静态文件夹页面、可选的文件夹 `index.md`，以及稳定的笔记页面。
- 根 `index` 菜单，以及 Sidebar、Header 和 Footer 三种导航位置。
- 根、文件夹和笔记级 `name/value` metadata，并支持继承。
- `showChildren`、`showNestedNotes`、`showInMenu`、`showInFooter`、`pinned`、`sortBy`、`layout`、`previewProps`、面包屑、metadata、页脚和上一篇/下一篇开关。
- List、Timeline、Feed、Grid 和 Table 五种 Collection 布局。
- 轻量 `_` 草稿：不出现在发现入口中，但其直接 URL 仍会预渲染。
- Tags、Archive、QR、RSS、Sitemap、robots 和 404 页面。
- 根 RSS 别名，以及每个公开 Collection 各自的静态 `feed.xml` 与 `rss.xml` 端点。Collection Feed 遵循 `showNestedNotes`，永久链接保留配置的 Pages 基础路径，并排除草稿、未列出、仅 Footer 展示的 Collection 和笔记。
- 静态 HTML 文章正文、安全链接、围栏/行内代码样式和多张 Markdown 图片。
- 笔记级 `slug` 覆盖；重复路由或不安全路径片段会使构建失败。
- 笔记级 `aliases` 会生成静态永久重定向页；不安全、保留或冲突的别名会停止构建。
- 稳定且避免重复的标题锚点、无障碍 H2–H6 目录，以及带返回链接的 Markdown 脚注。
- `showTableOfContents` 从根或 Collection `index` 继承；笔记默认值为 `yes`，单篇笔记上的同名属性会覆盖继承值。`no`、`false`、`0` 和 `off` 都会关闭目录。
- 根菜单表支持空 `type`、`sidebar`、`header` 和 `footer`。
- 根菜单采用失败关闭策略：允许列表存在但无效时停止构建，不会自动暴露扫描到的目录。

## iPhone 导出器约定

iOS Notes API 会公开笔记直属的 FolderEntity，但不会公开父文件夹、子文件夹或完整路径。因此，该导出器需要在本地枚举 Notes，只读取直属文件夹显示名称，并仅导出根 `index` 菜单明确授权的名称。在此之前，全局候选笔记不会被上传。对于已接受“文件夹名称唯一”约束的环境，这一做法是确定的，但不能普遍证明文件夹的真实父子关系。

第一个安全版本的目标包括：

- 一次性固定根 FolderEntity，并精确查找根 `index`；
- 严格解析三列表格、安全生成本地路径，并排除虚拟路由；
- 对规范化文件夹名称进行匹配，再动态核对 FolderEntity 的精确笔记数；
- 在发出第一个 GitHub 请求前完成整批验证；
- 上传全部图片附件，但接受无法重建它们在原始富文本中的穿插顺序；
- 将 Monospaced 样式边界导出为行内或围栏 Markdown 代码；
- 将 `_` 笔记上传为以下划线开头的文件名，让网站应用轻量草稿策略；
- GitHub 仅执行新增或更新；过期远程文件仍不会自动删除。当前 manifest 协议会记录生成文件，并报告删除、改名或移动输出路径所产生的移除/迁移候选项。

## 无需托管 Notes 服务即可后续实现

这些都是静态站点能力，可在确有需要时直接加入 SvelteKit：

- 客户端全文搜索；
- 作者、更多 metadata 字段和更丰富的预览卡片；
- 打印/PDF 输出；
- 当导出器提供稳定的笔记 ID manifest 后，支持稳定的内部笔记链接；
- 当导出器保留附件位置后，支持图片说明和同行图片画廊。

## 需要额外服务或明确取舍的功能

- 保护隐私的服务端分析；
- 动态社交分享图片；
- Apple Maps 快照和广泛的富媒体嵌入；
- Newsletter 表单；
- 在普通 Git 存储之外托管大型音频、视频和 PDF；
- Montaigne 式 30–60 秒后台轮询；
- 自动对账并删除远端文件。

这些功能不会被描述为“仅靠 GitHub 即可实现”。只有当额外依赖确实解决实际需求时才应加入。

## 已知的 Montaigne 文档不一致

- 草稿的当前说明是标题以 `_` 开头；较早的 Changelog 还提到过 `[draft]`。
- 文档中同时出现 `showPostNavigation` 和 `showNoteNavigation`；Moire 两者都接受。
- 默认布局既被描述为 Timeline，也被描述为 List；Moire 使用 List。
- 较早 FAQ 称不支持 Analytics，后来的 Feature 页面则称已支持。
- 图片限制被更具体地写为 50 MB，而音频和视频为 100 MB。
- 当前在线 Apple Notes 内部链接 Demo 会暴露原始 `applenotes:` 文本，而不是可用的网站链接。

文档相互冲突时，实现以当前可测试的行为为准。
