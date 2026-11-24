# 发布步骤（第一次也照着走）

目标：这个插件在 GitHub 上有仓库，别人能 `dsh plugin add` 装上，并且能上 DSH 插件市场。

## 0. 先确认几件事

- GitHub 账号：没有就去 https://github.com/signup 注册。用户名会出现在仓库地址里（`github.com/playfox2025/dsh-perf-control`），选个想要的，以后不好改。
- npm 账号（可选，但市场一键装优先用 npm 包）：https://www.npmjs.com/signup 。
- 包名 `dsh-perf-control` 已在 npm 查过，**空着**，可以直接用。
- 本机没有 Git（`git --version` 报错，winget 安装会崩，别用 winget）。

## 1. 装 Git

浏览器打开 https://git-scm.com/download/win → 下载 **64-bit Git for Windows Setup** → 一路 Next（默认选项就够）→ 装完**重新打开**终端，`git --version` 有输出就成。

不想记命令的话，另一个选择是 GitHub Desktop（https://desktop.github.com/）：装好登录，Add local repository 选
`C:\Users\Administrator\.dsh\plugins-src\dsh-perf-control`，然后 Publish repository，一步到位。

## 2. 网页建仓库

https://github.com/new

- Repository name：`dsh-perf-control`
- Public
- **不要**勾 Add a README / .gitignore / license（本地已经有了，勾了会冲突）

点 Create repository，页面会给一串命令，不用管，用下面第 3 步的。

## 3. 本地初始化并推送

在 PowerShell 里：

```powershell
cd C:\Users\Administrator\.dsh\plugins-src\dsh-perf-control
git init -b main
git config user.name "你的名字"
git config user.email "你的邮箱"
git add .
git commit -m "feat: Settings 里的性能控制页 + Windows Job Object 硬限速"
git remote add origin https://github.com/playfox2025/dsh-perf-control.git
git push -u origin main
```

第一次 push 会弹浏览器让你登录 GitHub 授权（Git 自带的 Credential Manager 干的），点一次以后就记住了。

推之前可以先 `git status` 看一眼：`node_modules/` 应该被 `.gitignore` 挡掉，列出来的应该是
`LICENSE`、`README.md`、`README.en.md`、`client.js`、`cordis.patch.yml`、`index.js`、`assets/`、`lib/`、`locale/`、`scripts/`、`.gitignore`、`package.json`。

## 4. 打版本 tag

```powershell
git tag v0.1.1
git push --tags
```

以后改版本：改 `package.json` 的 `version` → commit → `git tag v0.1.2` → `git push --tags`。

## 5. 发 npm（可选，只是更省事）

不发也能上架：市场装不到 npm 包时，会退到作者 Release 的 tarball，最后才回退整仓源码。
差别有两点：没 npm 包时别人更新靠 commit 对比；整仓源码装下来的 `node_modules` 可能没有 koffi，滑块就只存设置不真限速。

真要发：

```powershell
npm login        # 浏览器/终端里填 npm 账号，会要 2FA 一次性码
npm publish --access public
```

发布前检查：`package.json` 里 `private` 已经去掉了；`files` 只放需要发的（`node_modules` 不在里面）。
发完 `npm view dsh-perf-control version` 能看到版本号就成了。

## 6. 上架插件市场

**发 GitHub 本身不会出现在市场。** DSH 插件市场（dshmarket）的列表来自精选列表
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，市场也只允许安装那个列表里的插件。

投稿不是改 README，是加一个数据文件（两个 README 由脚本生成，手改的会被覆盖）：

1. Fork 上面那个仓库，新建 `data/plugins/playfox2025__dsh-perf-control.yml`，形如：

   ```yaml
   url: https://github.com/playfox2025/dsh-perf-control
   name: dsh-perf-control
   category: tools
   description:
     en: CPU throttle for DSH on Windows: a 5–100 slider in Settings hard-caps the whole DSH process tree (ffmpeg, whisper, python, renderers) through a Windows Job Object.
     zh: 给 DSH 加一根 CPU 限速滑块：设置页 5–100，用 Windows Job Object 硬限整棵进程树。
   ```

   `category` 只能取列表里的值（`tools` 就对），`description.en` 必填，`icon` 可选但要 GitHub 托管的位图。

2. 提交 PR，标题 `Add dsh-perf-control`，正文一句说清楚是什么、Windows 限定、没 koffi 只存设置。

硬门槛（CI 会卡）：`package.json` 有 `dsh.bundle`、仓库根有 `cordis.patch.yml`、仓库带 `dsh-plugin` topic、仓库建满 1 天、一个 PR 最多 3 条。我们这条仓库 2026-11-24 13:50 建的，**11-25 之后**再提。

审核只看三件事：装得上、描述说的和做的一致、有人在维护。列表里对「HTTP 路由不做 DSH 访问检查」的插件会标警告 —— 我们走的是 harness 的 `connection` 门禁，这点可以在 PR 正文里提一句。

## 7. 装给别人看

```powershell
dsh plugin --profile desktop add github:playfox2025/dsh-perf-control
```

有 npm 包以后更简单：`dsh plugin --profile desktop add dsh-perf-control`。
市场里点安装时，优先用 npm 包，其次作者的 Release tarball，最后才回退整仓源码。

## 8. 之后维护

- 改了代码：commit → push → 打新 tag（这一步决定别人能不能更新）。
- 发 npm 时升版本号，不然 publish 会被拒。
- 插件本体纯 JS，没有构建步骤，`files` 里放的就是跑的东西。
