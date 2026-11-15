import { LogoMark } from "./Icons.tsx";

/** Page header: brand bar, headline, and an illustration of what the report shows. */
export function Hero({ compact }: { compact: boolean }) {
  return (
    <header className="masthead">
      <div className="brandbar">
        <span className="brand">
          <LogoMark size={26} className="brand-mark" />
          <span className="brand-name">
            lockfile<span className="brand-dash">-</span>audit
          </span>
        </span>
        <span className="brand-meta" title="漏洞数据来源">
          <span className="live-dot" aria-hidden="true" />
          数据源 OSV
        </span>
      </div>

      {!compact && (
        <div className="hero">
          <div className="hero-copy">
            <p className="eyebrow">DEPENDENCY LOCKFILE AUDIT</p>
            <h1>
              锁文件里的每个版本，
              <br />
              <span className="hero-em">逐个核对已知漏洞</span>
            </h1>
            <p className="lead">
              拖入 npm、pnpm 或 yarn 的锁文件，检查直接和间接依赖，追到漏洞是经由哪条依赖链引入的，给出修复建议，并导出 HTML 报告。
            </p>
            <ul className="assurances">
              <li>
                <b>本地解析</b>
                <span>锁文件不会上传</span>
              </li>
              <li>
                <b>只发包名和版本</b>
                <span>仅发送给 api.osv.dev</span>
              </li>
              <li>
                <b>与命令行一致</b>
                <span>同一份核心代码</span>
              </li>
            </ul>
          </div>

          <figure className="chain" aria-hidden="true">
            <figcaption>
              <span>引入路径</span>
              <em>示例</em>
            </figcaption>
            <div className="chain-body">
              <div className="chain-node">
                <span className="chain-pkg">my-app</span>
                <span className="chain-tag">项目</span>
              </div>
              <div className="chain-node depth-1">
                <span className="chain-pkg">direct-dep</span>
                <span className="chain-tag">直接依赖</span>
              </div>
              <div className="chain-node depth-2">
                <span className="chain-pkg">middle-dep</span>
                <span className="chain-tag">间接依赖</span>
              </div>
              <div className="chain-node depth-3 is-vuln">
                <span className="chain-pkg">vulnerable-pkg</span>
                <span className="chain-tag chain-sev">已知漏洞</span>
              </div>
              <div className="chain-fix">
                <span className="chain-fix-label">修复建议</span>
                升级 <code>direct-dep</code> 到包含修复版本的发布
              </div>
            </div>
          </figure>
        </div>
      )}
    </header>
  );
}
