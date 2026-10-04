import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Download,
  RefreshCw,
  ArrowRight,
  Check,
  Clock3,
  BookOpen,
  ScanLine,
  ChevronRight,
  CircleCheck,
} from "lucide-react";
import {
  WorkHeading,
  Empty,
  Notice,
  RiskSummary,
  StatusBadge,
  FileIcon,
} from "../components/ui";
import { Dialog } from "../components/Dialog";
import { DocumentViewer } from "../components/DocumentViewer";
import { FindingsList } from "../components/FindingsList";
import { useTasks, useRun, api, date, bytes, reportUrl } from "../api";
import type { Finding, Task } from "../types";
export function Workspace({ scanning = false }: { scanning?: boolean }) {
  const { runId, taskId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: tasks } = useTasks();
  const id =
    runId ||
    searchParams.get("run") ||
    (taskId
      ? tasks?.find((t) => t.id === taskId)?.latest_run_id
      : tasks?.[0]?.latest_run_id);
  const { data: run, error } = useRun(id);
  const [selected, setSelected] = useState<Finding>();
  const [locateVersion, setLocateVersion] = useState(0);
  const [tab, setTab] = useState("概览");
  const [taskDetails, setTaskDetails] = useState(false);
  const [ruleDetails, setRuleDetails] = useState(false);
  const [filter, setFilter] = useState("ALL");
  useEffect(() => {
    setSelected(undefined);
    setFilter("ALL");
  }, [id]);
  const qc = useQueryClient();
  const { data: task } = useQuery({
    queryKey: ["task", run?.task_id],
    queryFn: () => api<Task>("/tasks/" + run?.task_id),
    enabled: !!run?.task_id,
  });
  if (error) return <Notice error>{error.message}</Notice>;
  if (!run)
    return (
      <>
        <WorkHeading title="工作台" />
        <section className="panel">
          <Empty
            title={tasks?.length ? "正在读取检测结果" : "工作台等待第一份材料"}
            action={
              <Link to="/new" className="button primary">
                开始检测
                <ArrowRight size={16} />
              </Link>
            }
          />
        </section>
      </>
    );
  const busy = ["RUNNING", "QUEUED"].includes(run.state);
  const issues = run.findings.filter((f) =>
    filter === "ALL" ? true : f.status === filter,
  );
  const previous = task?.runs?.find((r) => r.version === run.version - 1);
  const recheck = `/new?task=${run.task_id}&rule=${run.ruleset_id}`;
  function select(f: Finding) {
    setSelected(f);
    setLocateVersion((version) => version + 1);
  }
  return (
    <>
      <WorkHeading
        title={scanning ? (busy ? "检测进行中" : "检测已结束") : "工作台"}
        subtitle={
          scanning ? run.document?.name : "查看检测结果，定位问题并进行整改。"
        }
      />
      {scanning ? (
        <div className="scan-filebar">
          <FileIcon format={run.document?.format} />
          <div>
            <b>{run.document?.name}</b>
            <p>
              {bytes(run.document?.size || 0)} · {run.ruleset_snapshot.name}
            </p>
          </div>
          <StatusBadge status={run.status} />
          {busy ? (
            <button
              className="button"
              onClick={async () => {
                await api("/runs/" + run.id + "/cancel", { method: "POST" });
                qc.invalidateQueries({ queryKey: ["run", run.id] });
              }}
            >
              取消检测
            </button>
          ) : (
            <Link
              to={"/workbench/" + run.task_id + "?run=" + run.id}
              className="button primary"
            >
              查看工作台
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      ) : (
        <div className="workspace-tabs">
          <div className="tabs">
            {["概览", "文档", "证据", "整改"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
                {tab === t && (
                  <motion.span
                    layoutId="active-tab"
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <a className="button" href={reportUrl(run.id)} download>
              <Download size={16} />
              导出报告
            </a>
            <Link
              className={tab === "整改" ? "button" : "button primary"}
              to={recheck}
            >
              <RefreshCw size={16} />
              发起复检
            </Link>
          </div>
        </div>
      )}
      {run.error && <Notice error>{run.error}</Notice>}
      {run.state === "CANCELLED" && (
        <Notice>检测已取消。当前结果不完整，请重新检测。</Notice>
      )}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -3 }}
        transition={{ duration: 0.2 }}
        className={"workspace-grid " + (scanning ? "scan-grid" : "")}
      >
        {scanning ? (
          <aside className="panel stage-panel">
            <h2>检测流程</h2>
            <div className="stage-list">
              {run.stages.map((s, i) => (
                <div key={s.id} className={"stage " + s.state.toLowerCase()}>
                  <span className="stage-circle">
                    {s.state === "Done" ? (
                      <Check size={17} />
                    ) : s.state === "Running" ? (
                      <ScanLine size={17} />
                    ) : s.state === "Review" ? (
                      <Clock3 size={17} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div>
                    <h3>
                      {s.name}
                      <small>
                        {s.state === "Done"
                          ? "已完成"
                          : s.state === "Review"
                            ? "需复核"
                            : s.state === "Running"
                              ? "进行中"
                              : s.state === "Failed"
                                ? "失败"
                                : "等待中"}
                      </small>
                    </h3>
                    {s.state === "Running" && <p>{s.detail || "正在检查…"}</p>}
                    {s.detail && s.state !== "Running" && (
                      <details className="disclosure">
                        <summary>阶段详情</summary>
                        <p>{s.detail}</p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="progress-block">
              <strong>{run.progress}%</strong>
              <p>
                {busy
                  ? "根据已完成阶段更新进度"
                  : run.state === "COMPLETED"
                    ? "检测流程已完成"
                    : "流程未完整完成"}
              </p>
              <progress value={run.progress} max={100} />
            </div>
          </aside>
        ) : (
          <aside className="task-sidebar">
            <div className="task-context">
              <div className="section-title">
                <h2>文件信息</h2>
                <button
                  type="button"
                  className="text-link task-details-trigger"
                  onClick={() => setTaskDetails(true)}
                >
                  任务详情
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="task-file-heading">
                <FileIcon format={run.document?.format} />
                <div>
                  <h3 className="task-name">{run.document?.name}</h3>
                  <p>
                    {run.document?.format.toUpperCase()} ·{" "}
                    {bytes(run.document?.size || 0)}
                  </p>
                </div>
              </div>
              <dl className="task-summary">
                <dt>
                  <BookOpen size={18} />
                  当前规则
                </dt>
                <dd>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setRuleDetails(true)}
                  >
                    {run.ruleset_snapshot.name}
                  </button>
                  {run.execution_mode === "STRICT_CUSTOM" && (
                    <small className="muted">仅按当前规则集检查</small>
                  )}
                </dd>
                <dt>
                  <CircleCheck size={18} />
                  检测状态
                </dt>
                <dd>
                  <span
                    className={
                      "status " +
                      (run.state === "COMPLETED" ? "pass" : "review")
                    }
                  >
                    <Check size={14} />
                    {busy
                      ? "检测中"
                      : run.state === "COMPLETED"
                        ? "已完成"
                        : "结果不完整"}
                  </span>
                </dd>
                <dt>
                  <Clock3 size={18} />
                  检测时间
                </dt>
                <dd>{date(run.created_at)}</dd>
              </dl>
            </div>
            {task?.runs && task.runs.length > 1 && (
              <details open className="disclosure run-history">
                <summary>
                  复检记录 <span>（{task.runs.length}）</span>
                </summary>
                {[...task.runs]
                  .sort((a, b) => b.version - a.version)
                  .map((r) => (
                    <Link
                      key={r.id}
                      className={
                        "run-link " + (r.id === run.id ? "selected" : "")
                      }
                      to={"/workbench/" + run.task_id + "?run=" + r.id}
                    >
                      <span>
                        <b>Run {r.version}</b>
                        <small>{date(r.created_at)}</small>
                      </span>
                      <StatusBadge status={r.status} />
                    </Link>
                  ))}
                {previous && (
                  <details className="run-comparison">
                    <summary>结果对比</summary>
                    <div className="comparison">
                      <b>较上次检测</b>
                      <p>
                        FAIL {previous.counts.FAIL} → {run.counts.FAIL}
                      </p>
                      <p>
                        REVIEW {previous.counts.REVIEW} → {run.counts.REVIEW}
                      </p>
                    </div>
                  </details>
                )}
              </details>
            )}
          </aside>
        )}
        <div className="center-column">
          {!scanning && tab === "文档" && (
            <motion.section
              className="source-details"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3>真实文档解析</h3>
              <p>
                {run.document?.parsed?.surfaces.length || 0} 个已抽取表层 ·{" "}
                {run.document?.format.toUpperCase()} ·{" "}
                {run.document?.page_count
                  ? `${run.document.page_count} 页 / 幻灯片`
                  : "不推测排版页数"}
              </p>
            </motion.section>
          )}
          {!scanning && tab === "证据" && (
            <motion.section
              className="source-details"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <h3>{selected?.title || "选择一项证据"}</h3>
              <p>
                {selected?.evidence ||
                  "点击右侧问题，查看真实位置、规则依据与风险判断。"}
              </p>
              {selected && (
                <>
                  <p>
                    规则：
                    {run.ruleset_snapshot.rules.find(
                      (r) => r.id === selected.rule_id,
                    )?.source_clause || "检测覆盖边界"}
                  </p>
                  <p>{selected.reason}</p>
                </>
              )}
              <Link to={"/evidence/" + run.id} className="text-link">
                打开完整证据链
                <ArrowRight size={13} />
              </Link>
            </motion.section>
          )}
          <DocumentViewer
            document={run.document}
            finding={selected}
            locateVersion={locateVersion}
            findings={run.findings}
            scanning={scanning && busy}
          />
          {!scanning && tab === "整改" && (
            <motion.div
              className="remediation-help"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2>整改 — 复检</h2>
              <p>
                依据右侧证据修改原材料；上传整改版本后保留当前
                Run，并生成独立结果。
              </p>
              <Link to={recheck} className="button primary">
                上传整改版本
                <RefreshCw size={16} />
              </Link>
            </motion.div>
          )}
        </div>
        <aside className="results-column">
          <section className="risk-overview">
            <div className="section-title">
              <h2>{scanning ? "实时检测结果" : "风险概览"}</h2>
              <small className="muted">
                {run.state === "COMPLETED"
                  ? "已完成"
                  : busy
                    ? "本机处理中"
                    : "结果不完整"}
              </small>
            </div>
            <RiskSummary run={run} onSelect={(s) => setFilter(s)} />
          </section>
          <section className="panel results-panel">
            <div className="section-title">
              <h2>
                问题列表 <span>({issues.length})</span>
              </h2>
              <select
                aria-label="筛选检测状态"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="ALL">全部问题</option>
                {["FAIL", "REVIEW", "PASS"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <FindingsList
              findings={issues}
              onSelect={select}
              selected={selected}
              compact={scanning}
              rules={run.ruleset_snapshot.rules}
            />
            {!scanning && (
              <Link className="evidence-link" to={"/evidence/" + run.id}>
                查看完整证据链
                <ArrowRight size={15} />
              </Link>
            )}
          </section>
        </aside>
      </motion.div>
      {taskDetails && (
        <Dialog title="任务详情" drawer onClose={() => setTaskDetails(false)}>
          <dl className="task-facts">
            <dt>文件</dt>
            <dd>{run.document?.name}</dd>
            <dt>大小</dt>
            <dd>{bytes(run.document?.size || 0)}</dd>
            <dt>任务 ID</dt>
            <dd>{run.task_id}</dd>
            <dt>检测版本</dt>
            <dd>Run {run.version}</dd>
            <dt>创建时间</dt>
            <dd>{date(run.created_at)}</dd>
            <dt>检测范围</dt>
            <dd>{run.scopes.join(" / ")}</dd>
            <dt>SHA-256</dt>
            <dd>{run.document?.sha256}</dd>
            <dt>规则快照</dt>
            <dd>
              {run.ruleset_snapshot.name} · v{run.ruleset_snapshot.version}
            </dd>
            <dt>规则来源</dt>
            <dd>{run.ruleset_snapshot.source}</dd>
          </dl>
        </Dialog>
      )}
      {!!run.diagnostics?.length && (
        <details className="disclosure system-diagnostics">
          <summary>系统诊断（{run.diagnostics.length}）· 不计为违规</summary>
          {run.diagnostics.map((diagnostic) => (
            <p key={diagnostic.id}>{diagnostic.evidence}</p>
          ))}
        </details>
      )}
      {ruleDetails && (
        <Dialog
          title="当前生效规则"
          drawer
          onClose={() => setRuleDetails(false)}
        >
          <h3>{run.ruleset_snapshot.name}</h3>
          <p>
            生效 {run.ruleset_snapshot.rules.length} 项 · 已执行{" "}
            {run.rule_ids_executed?.length ?? "历史记录未保存"} 项
          </p>
          {run.ruleset_snapshot.rules.map((rule) => (
            <details className="disclosure" key={rule.id}>
              <summary>{rule.description}</summary>
              <p>{rule.original_text || rule.source_clause}</p>
              <small>
                {rule.parameters.source_file || run.ruleset_snapshot.source} ·{" "}
                {rule.source_page
                  ? `来源第 ${rule.source_page} 页`
                  : rule.source_section || "未提供可靠来源页码"}
              </small>
              <p>检查范围：{rule.scope.join(" / ")}</p>
            </details>
          ))}
        </Dialog>
      )}
    </>
  );
}
