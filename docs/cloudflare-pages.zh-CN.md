<p align="center">
  <strong>简体中文</strong> · <a href="./cloudflare-pages.md">English</a>
</p>

# Cloudflare Pages 部署

两个公开站点有意保持彼此独立：

```text
main -> GitHub Pages      -> https://moire.guoyingwei.top
blog -> Cloudflare Pages -> https://moireblog.guoyingwei.top
```

`main` 继续用于上游或原版 Moire 的相关工作。macOS Apple Notes 导出器只推送到 `blog`。

## Cloudflare Pages 设置

`blog` 站点使用以下设置：

- Production branch：`blog`
- Build command：`pnpm build`
- Build output directory：`build`
- Root directory：仓库根目录
- `VITE_SITE_URL`：不需要；站点域名由 `/settings/` 和 `site.config.json` 控制
- `BASE_PATH`：不设置
- `GITHUB_TOKEN`：可写入仓库内容的 fine-grained GitHub token
- `SETTINGS_PASSWORD`：登录 `/settings/` 时所需的管理员密码
- `GITHUB_REPOSITORY`：`guoyingwei6/moire`
- `GITHUB_BRANCH`：`blog`

`GITHUB_TOKEN` 和 `SETTINGS_PASSWORD` 是 Cloudflare 环境变量。不要将它们提交到仓库、前端代码或 URL 中。设置 API 仍然只能修改 `blog` 分支上的 `site.config.json`。

`pnpm build` 会先运行 `prebuild` 脚本：

```sh
node scripts/notes/build-content-from-export.mjs \
  --in notes-export/public-notes.json \
  --content content \
  --clean true \
  --if-exists true
```

这意味着 Cloudflare 会先根据已提交的原始快照重新生成 `content/**`，然后 SvelteKit 才会构建静态站点。

## 部署边界

GitHub Actions 不会部署这个分支；Cloudflare Pages 直接监听 `blog`。成功推送后会开始一次新的 Cloudflare 构建，而 `main` 和 `development` 会继续使用各自独立的部署。

## 浏览器缓存策略

Advanced Mode Worker 只会为成功的 `/_app/immutable/*` 请求添加以下响应头：

```text
Cache-Control: public, max-age=31536000, immutable
```

SvelteKit 会为这些构建产物使用包含内容哈希的文件名，其中包括 CSS、JavaScript 和生成的媒体文件，因此新部署会产生新的 URL。HTML、设置 API 响应和不带指纹的静态资源继续使用 Cloudflare 的常规策略，不会缓存一年。

## 网页设置

`/settings/` 是可编辑的站点设置页面。它通过 `/api/settings` 的 Cloudflare Pages Function，只将设置保存到 `blog` 分支上的 `site.config.json`。

保存时必须使用以 `SETTINGS_PASSWORD` 存储在 Cloudflare 中的管理员密码。成功登录后，Worker 会创建一个有效期为八小时、经 HMAC 签名并带有 `HttpOnly`、`Secure`、`SameSite=Strict` 属性的 Cookie。配置的密码不会存储在浏览器、`site.config.json` 或静态站点构建产物中。在会话过期前，保存操作会使用已签名会话，不会再次要求输入密码。

网页表单可控制站点级设置：

- 标题、作者、描述、域名、Logo emoji 和从右到左文本；
- Twitter、Instagram、GitHub、YouTube、Mastodon 和公开邮箱；
- 背景、正文、次要文字和链接颜色；
- 二维码、Tags、Archive、文件夹名称、上一篇/下一篇、页脚和元数据显示。

Apple Notes 的 `index` 仍然负责导航和内容结构。Mac 发布脚本会在导出 Notes 前运行 `git pull --ff-only origin blog`，因此从网站修改设置所产生的提交不会与后续快照推送发生冲突。
