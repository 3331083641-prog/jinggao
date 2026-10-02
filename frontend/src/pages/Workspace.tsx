import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  ArrowRight,
  Check,
  Clock3,
  FileText,
  BookOpen,
  ScanLine,
} from "lucide-react";
import {
  PageHero,
  Empty,
  Notice,
  RiskSummary,
  StatusBadge,
  FileIcon,
} from "../components/ui";
import { DocumentViewer } from "../components/DocumentViewer";
import { FindingsList } from "../components/FindingsList";
import { useTasks, useRun, api, date, bytes, reportUrl } from "../api";
import type { Finding, Status, Task } from "../types";
export function Workspace({ scanning = false }: { scanning?: boolean }) {
  const { runId } = useParams();
  const { data: tasks } = useTasks();
  const id = runId || tasks?.[0]?.latest_run_id;
  const { data: run, error } = useRun(id);
  const [selected, setSelected] = useState<Finding>();
  const [locateVersion, setLocateVersion] = useState(0);
  const [tab, setTab] = useState("概览");
  const [filter, setFilter] = useState("ALL");
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
        <PageHero title="工作台" subtitle="专注每一次检查，让提交更规范。" />
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
    filter === "ALL" ? f.status !== "PASS" : f.status === filter,
  );
  const previous = task?.runs?.find((r) => r.version === run.version - 1);
  const recheck = `/new?task=${run.task_id}&rule=${run.ruleset_id}`;
  function select(f: Finding) {
    setSelected(f);
    setLocateVersion((version) => version + 1);
  }
  return (
    <>
      <PageHero
        title={scanning ? (busy ? "检测进行中" : "检测已结束") : "工作台"}
        subtitle={
          scanning
            ? "多层检查正在本地执行，让每一项发现都有据可循。"
            : "专注每一次检查，让科研材料更规范。"
        }
      />
      {scanning ? (
        <div className="scan-filebar panel">
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
            <Link to={"/workspace/" + run.id} className="button primary">
              查看工作台
              <ArrowRight size={16} />
            </Link>
          )}
        </div>
      ) : (
        <div className="workspace-tabs panel">
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
                    layoutId="work-tab"
                    transition={{ duration: 0.2 }}
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
            <Link className="button primary" to={recheck}>
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
      <AnimatePresence mode="wait">
        <motion.div
          key={scanning ? "scan" : tab}
          initial={{ opacity: 0, y: 6 }}
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
                      <p>
                        {s.detail ||
                          [
                            "提取结构、页面与文本",
                            "扫描身份与联系方式",
                            "检查作者与单位属性",
                            "读取批注、修订与隐藏结构",
                            "本地识别图像文字",
                            "依据真实规则生成证据",
                          ][i]}
                      </p>
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
                <small>阶段实际完成进度，不预估倒计时</small>
              </div>
            </aside>
          ) : (
            <aside className="task-sidebar">
              <section className="panel">
                <div className="section-title">
                  <h2>任务信息</h2>
                  <StatusBadge status={run.status} />
                </div>
                <h3 className="task-name">{run.document?.name}</h3>
                <p className="task-sub">
                  {run.ruleset_snapshot.category} · 第 {run.version} 次检测
                </p>
                <dl className="info-list">
                  <dt>
                    <FileText size={14} />
                    任务编号
                  </dt>
                  <dd>{run.task_id.slice(0, 12)}</dd>
                  <dt>
                    <Clock3 size={14} />
                    创建时间
                  </dt>
                  <dd>{date(run.created_at)}</dd>
                  <dt>
                    <ScanLine size={14} />
                    检测状态
                  </dt>
                  <dd>
                    {busy
                      ? "正在检测"
                      : run.state === "COMPLETED"
                        ? "已完成"
                        : run.state === "CANCELLED"
                          ? "已取消"
                          : "检测失败"}
                  </dd>
                  <dt>
                    <BookOpen size={14} />
                    检测范围
                  </dt>
                  <dd>
                    {run.scopes
                      .map(
                        (s) =>
                          ({
                            body: "正文",
                            metadata: "属性",
                            hidden: "隐藏",
                            images: "OCR",
                          })[s],
                      )
                      .join(" / ")}
                  </dd>
                </dl>
              </section>
              <section className="panel">
                <div className="section-title">
                  <h2>检测规则集</h2>
                  <Link to="/rules" className="text-link">
                    规则详情
                  </Link>
                </div>
                <div className="ruleset-label">
                  <BookOpen size={18} />
                  {run.ruleset_snapshot.name}
                </div>
                <Notice>{run.ruleset_snapshot.description}</Notice>
              </section>
              <section className="panel">
                <h2>检测文件</h2>
                <div className="task-file">
                  <FileIcon format={run.document?.format} />
                  <div>
                    <b>{run.document?.name}</b>
                    <small>{bytes(run.document?.size || 0)} · 本地保存</small>
                  </div>
                </div>
                <p className="hash-label">
                  SHA-256 · {run.document?.sha256.slice(0, 20)}…
                </p>
              </section>
              {task?.runs && task.runs.length > 1 && (
                <section className="panel">
                  <h2>复检记录</h2>
                  {task.runs.map((r) => (
                    <Link
                      key={r.id}
                      className="run-link"
                      to={"/workspace/" + r.id}
                    >
                      <span>Run {r.version}</span>
                      <StatusBadge status={r.status} />
                    </Link>
                  ))}
                  {previous && (
                    <div className="comparison">
                      <b>较上次检测</b>
                      <p>
                        FAIL {previous.counts.FAIL} → {run.counts.FAIL}
                      </p>
                      <p>
                        REVIEW {previous.counts.REVIEW} → {run.counts.REVIEW}
                      </p>
                    </div>
                  )}
                </section>
              )}
            </aside>
          )}
          <div className="center-column">
            {!scanning && tab === "文档" && (
              <section className="panel source-details">
                <h3>真实文档解析</h3>
                <p>
                  {run.document?.parsed?.surfaces.length || 0} 个已抽取表层 ·{" "}
                  {run.document?.format.toUpperCase()} ·{" "}
                  {run.document?.page_count
                    ? `${run.document.page_count} 页 / 幻灯片`
                    : "不推测排版页数"}
                </p>
                <p>点击右侧证据可定位；属性、隐藏结构等通过原始表层显示。</p>
              </section>
            )}
            {!scanning && tab === "证据" && (
              <section className="panel source-details">
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
              </section>
            )}
            <DocumentViewer
              document={run.document}
              finding={selected}
              locateVersion={locateVersion}
              findings={run.findings}
              scanning={scanning && busy}
            />
            {selected && (
              <div className="selection-caption">
                <span>{selected.detector}</span>
                <p>{selected.reason}</p>
              </div>
            )}
            {!scanning && tab === "整改" && (
              <div className="panel remediation-help">
                <h2>整改 — 复检</h2>
                <p>
                  依据右侧证据修改原材料；上传整改版本后保留当前
                  Run，并生成独立结果。
                </p>
                <Link to={recheck} className="button primary">
                  上传整改版本
                  <RefreshCw size={16} />
                </Link>
              </div>
            )}
          </div>
          <aside className="results-column">
            <section className="panel">
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
      </AnimatePresence>
    </>
  );
}
