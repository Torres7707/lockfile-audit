# lockfile-audit

检查 npm、pnpm、yarn 锁文件里的已知漏洞（直接依赖和间接依赖），显示每个漏洞是经由哪条依赖链引入的，给出修复建议，并生成 HTML 报告。漏洞数据来自 [OSV](https://osv.dev)。

支持的锁文件：`package-lock.json`（v1/v2/v3）、`npm-shrinkwrap.json`、`pnpm-lock.yaml`（v5/v6/v9）、`yarn.lock`（classic 和 berry）。

npm lockfile v1 和 yarn classic 没有记录哪些是直接依赖，需要同一目录下（网页版是一起拖入）有 `package.json`。

## 网页版

把锁文件拖进页面，分析后可以预览并下载 HTML 报告。文件只在浏览器里解析，不会上传；只有包名和版本号会发送给 `api.osv.dev`。

```sh
npm install
npm run web:dev     # 开发服务器
npm run web:build   # 构建到 web/dist，是纯静态文件，可放在任何静态托管上
```

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
