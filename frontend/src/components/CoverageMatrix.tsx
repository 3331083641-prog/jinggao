import type { Run } from "../types";

export function CoverageMatrix({ run }: { run: Run }) {
  return (
    <details className="disclosure coverage-matrix">
      <summary>检测覆盖（{run.coverage_matrix?.length ?? 0} 项）</summary>
      <p className="muted">VERIFIED 表示实现范围已检查，不等于材料通过。</p>
      {run.coverage_matrix?.length ? (
        <div className="coverage-table-wrap">
          <table>
            <thead>
              <tr>
                <th>规则</th>
                <th>状态</th>
                <th>Detector / 范围</th>
                <th>覆盖说明</th>
              </tr>
            </thead>
            <tbody>
              {run.coverage_matrix.map((entry) => (
                <tr key={entry.rule_id}>
                  <td>{entry.rule}</td>
                  <td>
                    <span className="coverage-status">{entry.status}</span>
                  </td>
                  <td>
                    {entry.detectors.join(" · ")}
                    <small>{entry.scope.join(" / ")}</small>
                  </td>
                  <td>{entry.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">此历史 Run 未保存覆盖记录；不推测其已验证范围。</p>
      )}
    </details>
  );
}
