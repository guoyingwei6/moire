<p align="center">
  <strong>简体中文</strong> · <a href="./configuration.md">English</a>
</p>

# 通过 Apple Notes 配置网站

> 当前实现说明：站点级设置保存在 `site.config.json` 中，可以通过 `/settings/` 编辑。由 macOS 导出的根 `index` 笔记负责导航和内容结构。下文中较早的 iPhone 快捷指令相关说明描述的是已经放弃的快捷指令路线，当前 `blog` 部署不依赖它。

名为 `index` 的公开根笔记是内容控制入口。它可以包含首页正文和可见导航。`site.config.json` 保存站点身份、颜色、社交链接和默认显示开关。如果菜单存在但内容无效，构建会直接停止，而不是悄悄扩大公开发布的内容范围。

Cloudflare 构建设置不会被当作配置数据库。Cloudflare 只负责解析、构建并部署 macOS 导出器已经推送到 `blog` 分支的快照。

## 唯一的根 index

在根 `index` 笔记中加入下列表格：

```markdown
| menu | link | type |
| --- | --- | --- |
| 🏠 Home | / | |
| 📒 Blog | /blog/ | |
| 🎞️ Photo | /photo/ | |
| 🏷️ Tags | /tags/ | |
| 🧰 Archive | /archive/ | |
| About | /about/about-me/ | |
```

- `menu` 是页面上显示的名称。开头的 emoji 会成为图标；如果没有 emoji，则使用圆点。
- `link` 接受安全的站内路径，或不含凭据的 HTTPS URL。
- `type` 留空表示 Sidebar。`header` 会把项目放入顶部导航。`footer` 为兼容较早的 Montaigne index 表而保留。本站公开的 About 目标显示在 Sidebar 中，同时也会以 `About me` 镜像到页脚；新页面可以通过 `showInFooter` 元数据进入页脚。

这三列同时构成 macOS 导出的允许列表。对于每个安全的本地内容链接，导出器会移除开头的 emoji，并将剩余的菜单名称规范化为 Apple Notes 文件夹名称。本地链接决定仓库中的路由。规范化后的名称必须精确匹配一个路径段，因此 `About` 加 `/about/about-me/` 会把 Notes 文件夹 `About` 映射到 `content/about/`；`Field Notes` 加 `/projects/field-notes/` 则会映射到 `content/projects/field-notes/`。

Home、Tags、Archive、Search、QR 以及 XML/文本端点都是自动生成的路由，不会被视为 Notes 文件夹。HTTPS 链接只用于导航。不需要 `source` 或 `path` 列、锚点笔记、文件夹级 `index` 笔记，也不需要修改快捷指令。

当前 macOS 导出器只读取已配置公开父文件夹的直接子文件夹。根菜单项目经规范化后，必须与这些子文件夹中的一个同名。导出器绝不会通过搜索其他位置的同名 Notes 文件夹来扩大公开范围。

存在有效根菜单表时，它是权威来源：只有其中安全的本地栏目行会被导出，并显示在 Sidebar/Header 导航中。不存在菜单表时，为向后兼容，会使用 `site.config.json` 加自动文件夹发现。如果菜单表存在但无效，构建会停止，而不是悄悄回退到更宽泛的发布范围。

配置表本身会在首页 Markdown 渲染前被移除。

## 站点设置

使用 `/settings/` 修改站点级设置。该表单会把 `site.config.json` 写入 `blog` 分支，随后 Cloudflare Pages 会重新部署网站。

可编辑的站点设置包括：

- 标题、作者、描述、域名、logo emoji 和从右到左文字；
- Twitter、Instagram、GitHub、YouTube、Mastodon 和公开邮箱；
- 背景色、文字颜色、次要文字颜色和链接颜色；
- QR、Tags、Archive、文件夹名称、上一篇/下一篇、页脚和元数据显示开关。

这些设置特意不从 Apple Notes 根 `index` 笔记中读取。这样可以避免以后 Notes 同步覆盖通过网页保存的设置。

根节点上的 `showChildren=no` 只会隐藏首页的子项列表；它不会阻止子文件夹发布，也不会隐藏明确写入 Sidebar 的行。

## 文件夹与笔记元数据

同样的 `name/value` 表可以放在文件夹可选的 `index` 笔记中，也可以放在普通笔记中。配置行会从最终文章中移除。显示属性按以下顺序继承：

```text
普通笔记 > 文件夹 index > 根 index > site.config.json 默认值
```

同一个属性名在一篇笔记中只能出现一次。重复行会使构建停止，避免含义不明确的设置悄悄回退到更宽泛的默认值。

本分支已经接入的核心属性：

- `pinned`：将笔记置于其文件夹列表的最前面。
- `showInMenu`：从文件夹列表中隐藏普通笔记或子文件夹，但不移除其直接 URL。
- `showInFooter`：把公开页面加入页脚，并从自动生成的集合列表中移除。根菜单中的明确项目仍然保持显示。
- `showChildren`：显示或隐藏集合的子项列表。
- `showNestedNotes`：纳入所有后代，而不只纳入直接子项。
- `sortBy`：`create`、`update` 或 `title`。
- `layout`：`list`、`timeline`、`feed`、`grid` 或 `table`。
- `previewProps`：以逗号分隔的元数据键，用于文件夹预览或表格列。
- `showBreadcrumbs`、`showNoteNavigation`、`showNoteFooter`、`showNoteMetadata`。
- `date`：覆盖显示和排序所用的创建日期；`tags`：以逗号分隔、并与 hashtag 行合并的标签。
- `slug`：用同一文件夹中的一个安全路径段替换由普通笔记文件名生成的 URL，例如 `stable-note`。值可以使用 Unicode 字母和数字，以及点、下划线、波浪号和连字符。空值、集合 `index` 笔记或其他 URL 标点会使构建停止。
- `aliases`：为笔记增加以逗号分隔的替代 URL。`old-title` 这样的裸值会生成同级 URL；`/old/blog/title/` 这样的绝对值会生成对应站内 URL。每个别名都会成为指向规范笔记 URL 的静态永久重定向。外部 URL、自动生成端点、不安全路径段和冲突都会使构建停止。Montaigne 记录了这个属性，但没有规定精确的列表语法；这里使用明确语法，以确保纯 GitHub 实现的结果确定一致。

`pinned`、`showInMenu`、`showInFooter`、`showChildren`、`sortBy`、`layout` 和 `previewProps` 等身份与集合控制项只作用于所在笔记/index。站点身份、颜色、社交链接和默认显示开关属于 `/settings/` / `site.config.json`。

文件夹 `index` 是可选的。没有它，文件夹仍会发布，并按默认设置列出其中的笔记。在已经获得授权的文件夹中创建新的普通笔记，不需要修改 index，也不需要修改导出器。

## 草稿

在 Apple Note 标题前添加 `_`，即可阻止它进入公开快照。macOS 导出器会在写入 `notes-export/public-notes.json` 之前跳过草稿，因此远程构建不会为其创建页面、媒体、Tags/Archive 条目、订阅条目或 Sitemap 条目。

这是一条发布规则，并不是对曾经发布过的内容实施访问控制。如果某篇笔记或附件已经存在于 Git 历史中，后续快照将其移除并不会抹除这段历史。

## 仓库回退设置与 Pages 基础路径

`site.config.json` 保存站点身份、颜色、社交链接、默认显示开关和回退菜单。日常的内容结构变化大多应在 Apple Notes 根笔记中完成；网站外观变化大多应在 `/settings/` 中完成。

公开域名与 SvelteKit 基础路径彼此独立：

- 自定义域名或用户 Pages 站点：使用空的 `BASE_PATH` 构建。
- 位于 `/moire` 的项目 Pages 站点：使用 `BASE_PATH=/moire` 构建。

修改 `/settings/` 中的站点域名会更新规范 URL、订阅、Sitemap 和 QR 输出。它不会自行配置 DNS、GitHub Pages 或 Cloudflare 自定义域名绑定。
