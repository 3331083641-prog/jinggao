import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { Run } from "../types";
import { Notice } from "./ui";

type Plan = {
  preview_token: string;
  source_sha256: string;
  change_count: number;
  changes: { operation: string; location: string; description: string }[];
  warning: string;
};
export function RemediationPanel({
  run,
  recheck,
}: {
  run: Run;
  recheck: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [operations, setOperations] = useState<string[]>([]);
  const [plan, setPlan] = useState<Plan>();
  const { data } = useQuery({
    queryKey: ["cleanup-options", run.id],
    queryFn: () =>
      api<{ operations: { id: string; label: string }[] }>(
        "/runs/" + run.id + "/cleanup-options",
      ),
  });
  const preview = useMutation({
    mutationFn: () =>
      api<Plan>("/runs/" + run.id + "/cleanup-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      }),
    onSuccess: setPlan,
  });
  const cleanup = useMutation({
    mutationFn: () =>
      api<Run>("/runs/" + run.id + "/cleanup-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview_token: plan?.preview_token }),
      }),
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task", run.task_id] });
      navigate("/scan/" + next.id);
    },
  });
  return (
    <section className="remediation-help">
      <h2>安全整改副本</h2>
      <p className="muted">
        先预览，再生成副本并按同一规则快照复检。原稿保留；正文、公式、引用和图片不自动修改。
      </p>
      {data?.operations.length ? (
        <>
          <fieldset className="cleanup-options">
            <legend>选择安全操作</legend>
            {data.operations.map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  checked={operations.includes(option.id)}
                  onChange={(event) => {
                    setPlan(undefined);
                    setOperations((current) =>
                      event.target.checked
                        ? [...current, option.id]
                        : current.filter((id) => id !== option.id),
                    );
                  }}
                />
                {option.label}
              </label>
            ))}
          </fieldset>
          <button
            className="button"
            disabled={
              !operations.length || preview.isPending || cleanup.isPending
            }
            onClick={() => preview.mutate()}
          >
            预览整改
          </button>
          {plan && (
            <div className="cleanup-preview">
              <p>将修改 {plan.change_count} 处结构内容</p>
              <ul>
                {plan.changes.map((change, index) => (
                  <li key={index}>
                    {change.description}
                    <small>{change.location}</small>
                  </li>
                ))}
              </ul>
              <p className="muted">{plan.warning}</p>
              <button
                className="button primary"
                disabled={!plan.change_count || cleanup.isPending}
                onClick={() => cleanup.mutate()}
              >
                {cleanup.isPending ? "正在校验副本…" : "生成副本并复检"}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          当前格式没有可安全自动处理的结构内容，请人工整改。
        </p>
      )}
      {(preview.error || cleanup.error) && (
        <Notice error>{(preview.error || cleanup.error)?.message}</Notice>
      )}
      {run.remediation && (
        <a
          className="button"
          href={`/api/documents/${run.document_id}/file`}
          download
        >
          下载净化副本
        </a>
      )}
      <Link to={recheck} className="button">
        上传整改版本
      </Link>
    </section>
  );
}
