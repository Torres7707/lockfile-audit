# lockfile-audit

检查 npm、pnpm、yarn 锁文件里的已知漏洞（直接依赖和间接依赖），显示每个漏洞是经由哪条依赖链引入的，给出修复建议，并生成 HTML 报告。漏洞数据来自 [OSV](https://osv.dev)。

支持的锁文件：`package-lock.json`（v1/v2/v3）、`npm-shrinkwrap.json`、`pnpm-lock.yaml`（v5/v6/v9）、`yarn.lock`（classic 和 berry）。

npm lockfile v1 和 yarn classic 没有记录哪些是直接依赖，需要同一目录下（网页版是一起拖入）有 `package.json`。

## 网页版

把锁文件拖进页面，分析后可以预览并下载 HTML 报告。文件只在浏览器里解析，不会上传；只有包名和版本号会发送给 `api.osv.dev`。

```sh
npm install
npm run web:dev     # 开发服务器，http://localhost:5173
npm run web:build   # 构建到 web/dist，是纯静态文件
npm run web:preview # 本地预览构建结果
```

### 部署到 Vercel

仓库根目录的 `vercel.json` 已经配置好构建命令和输出目录。Vercel 上的项目设置保持默认值即可，**Root Directory 必须留在仓库根目录**，不能设成 `web`。网页端直接引用根目录下的 `parse-core.mjs`、`audit-core.mjs` 等文件，单独构建 `web/` 会找不到它们。

- 通过 Git 导入：在 Vercel 里 Add New → Project，选择这个仓库，直接 Deploy。之后每次推送到 `main` 都会自动部署。
- 或用命令行：`npx vercel` 首次会引导登录和建立项目关联，之后 `npx vercel --prod` 部署到正式域名。

部署产物只包含 `web/dist` 里的静态文件。分析在用户浏览器里完成，服务器不接收锁文件内容。

`vercel.json` 没有设置响应头。内容安全策略（CSP）写在构建出的 HTML 里，只允许连接 `api.osv.dev`。

## 命令行

```sh
node audit.mjs <lockfile> [--out report.html]
```

默认写出 `dependency-audit.html`。退出码：`0` 没有发现漏洞，`1` 发现漏洞，`2` 出错。

## 代码结构

```
parse-core.mjs   把锁文件文本解析成依赖图（不依赖 Node，浏览器也能用）
audit-core.mjs   查询 OSV、计算引入路径和修复版本（不依赖 Node）
osv.mjs          OSV API 调用
report.mjs       生成 HTML 报告和修复建议
parse.mjs        读文件的封装，给命令行用
audit.mjs        命令行入口
web/             Vite + React 网页版，直接引用上面的核心模块
fixtures/        各种锁文件格式的样例和预期报告
```

命令行和网页版共用同一份核心代码，所以同一个输入生成的 HTML 报告是一样的。

## 测试

```sh
npm test                          # 解析、完整流程（用假的 OSV）和报告的黄金文件测试
npm test --workspace web          # 网页端的文件识别、流程，并检查和命令行报告逐字节一致
npm run typecheck --workspace web
```

修改了报告的输出之后，用 `UPDATE_GOLDEN=1 npm test` 重新生成预期文件。
