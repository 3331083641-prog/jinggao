import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { Run, RunComparison } from "../types";

const labels: Record<string, string> = {
  disappeared: "已消失风险（未自动判通过）",
  persisted: "仍存在风险",
  added: "新增风险",
  FAIL_TO_PASS: "FAIL → PASS",
  FAIL_TO_REVIEW: "FAIL → REVIEW",
  REVIEW_TO_PASS: "REVIEW → PASS",
  REVIEW_TO_FAIL: "REVIEW → FAIL",
};
export function RunDiffPanel({ run }: { run: Run }) {
  const { data, error } = useQuery({
    queryKey: ["diff", run.id],
    queryFn: () => api<RunComparison>("/runs/" + run.id + "/diff"),
    enabled: !!run.parent_run_id && run.state === "COMPLETED",
  });
  if (!run.parent_run_id) return null;
  return (
    <details className="disclosure run-diff">
      <summary>整改前后对比</summary>
      {error && <p>{error.message}</p>}
      {data && (
        <>
          <div className="diff-counts">
            {(["FAIL", "REVIEW", "PASS"] as const).map((status) => (
              <span key={status}>
                {status}{" "}
                <b>
                  {data.counts[status].before} → {data.counts[status].after}
                </b>
              </span>
            ))}
          </div>
          {!data.comparable && (
            <p className="muted">
              快照、范围或完成状态不同，数值仅作并列展示。
            </p>
          )}
          <p className="muted">{data.note}</p>
          {Object.entries(labels).map(([category, label]) => {
            const pairs = data.pairs.filter(
              (pair) => pair.category === category,
            );
            return pairs.length ? (
              <details key={category} className="diff-category">
                <summary>
                  {label}（{pairs.length}）
                </summary>
                {pairs.map((pair, index) => (
                  <div className="diff-evidence-pair" key={index}>
                    {pair.before && (
                      <Link
                        to={`/workbench/${run.task_id}?run=${data.before_run_id}&finding=${pair.before.id}`}
                      >
                        <small>旧 Evidence · {pair.before.status}</small>
                        {pair.before.evidence}
                      </Link>
                    )}
                    {pair.after && (
                      <Link
                        to={`/workbench/${run.task_id}?run=${data.after_run_id}&finding=${pair.after.id}`}
                      >
                        <small>新 Evidence · {pair.after.status}</small>
                        {pair.after.evidence}
                      </Link>
                    )}
                  </div>
                ))}
              </details>
            ) : null;
          })}
        </>
      )}
    </details>
  );
}
