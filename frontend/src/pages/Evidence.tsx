import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  RefreshCw,
  ArrowLeft,
  MapPin,
  ChevronDown,
  Check,
  EyeOff,
  Wrench,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRun, api, reportUrl, bytes, date } from "../api";
import type { Finding, Status } from "../types";
import {
  RiskSummary,
  StatusBadge,
  StatusIcon,
  FileIcon,
  Notice,
} from "../components/ui";
import { DocumentViewer } from "../components/DocumentViewer";
import { CoverageMatrix } from "../components/CoverageMatrix";
export function Evidence() {
  const { runId } = useParams();
  const { data: run, error } = useRun(runId);
  const [status, setStatus] = useState<Status>("FAIL");
  const [category, setCategory] = useState("全部问题");
  const [active, setActive] = useState<string>();
  const [note, setNote] = useState("");
  const [locateVersion, setLocateVersion] = useState(0);
  const qc = useQueryClient();
  const decision = useMutation({
    mutationFn: ({ f, d }: { f: Finding; d: string }) =>
      api("/runs/" + runId + "/findings/" + f.id + "/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: d, note }),
      }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["run", runId] });
    },
  });
  if (error) return <Notice error>{error.message}</Notice>;
  if (!run) return <Notice>正在读取真实证据…</Notice>;
  const categories = [
    "全部问题",
    ...new Set(run.findings.map((f) => f.category)),
  ];
  const filtered = run.findings.filter(
    (f) =>
      f.status === status &&
      (category === "全部问题" || f.category === category),
  );
  const selected = filtered.find((f) => f.id === active) || filtered[0];
  return (
    <>
      <section className="evidence-hero">
        <Link
          to={"/workbench/" + run.task_id + "?run=" + run.id}
          className="back-link"
        >
          <ArrowLeft size={15} />
          返回工作台
        </Link>
        <div className="evidence-heading">
          <div>
            <h1>检测结果 / 证据链</h1>
            <p>
              依据已确认的规则检查材料。<em>{run.counts.FAIL}</em> 项不合规，
              <em>{run.counts.REVIEW}</em> 项需人工确认。
            </p>
          </div>
          <div className="toolbar-actions">
            <a href={reportUrl(run.id)} className="button" download>
              <Download size={17} />
              导出报告
            </a>
            <Link
              to={`/new?task=${run.task_id}&rule=${run.ruleset_id}`}
              className="button primary"
            >
              <RefreshCw size={17} />
              发起复检
            </Link>
          </div>
        </div>
        <div className="evidence-file">
          <FileIcon format={run.document?.format} />
          <b>{run.document?.name}</b>
          <span>
            {bytes(run.document?.size || 0)} · {date(run.created_at)}
          </span>
        </div>
      </section>
      <CoverageMatrix run={run} />
      <RiskSummary
        run={run}
        wide
        onSelect={(s) => {
          setStatus(s);
          setActive(undefined);
        }}
      />
      <div className="evidence-grid">
        <aside className="panel category-panel">
          <h2>问题分类</h2>
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => {
                setCategory(c);
                setActive(undefined);
              }}
            >
              <span>{c}</span>
              <small>
                {
                  run.findings.filter(
                    (f) =>
                      f.status === status &&
                      (c === "全部问题" || f.category === c),
                  ).length
                }
              </small>
            </button>
          ))}
          <Notice>
            未发现不等于不存在。查看 REVIEW 了解语义与解析覆盖边界。
          </Notice>
        </aside>
        <section className="panel evidence-panel">
          <div className="section-title">
            <h2>
              检测问题{" "}
              <span>
                ({filtered.length} 项 {status})
              </span>
            </h2>
            <StatusBadge status={status} />
          </div>
          {filtered.map((f) => (
            <div
              key={f.id}
              className={
                "evidence-accordion " + (selected?.id === f.id ? "open" : "")
              }
            >
              <button
                className="accordion-head"
                onClick={() => {
                  setActive(f.id);
                  setNote("");
                }}
              >
                <StatusIcon status={f.status} />
                <b>{f.title}</b>
                <StatusBadge status={f.status} />
                <small>{f.page ? `第 ${f.page} 页` : f.source_type}</small>
                <ChevronDown size={16} />
              </button>
              <AnimatePresence initial={false}>
                {selected?.id === f.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="evidence-expanded"
                  >
                    <div className="evidence-detail">
                      <dl>
                        <dt>规则依据</dt>
                        <dd>
                          {run.ruleset_snapshot.rules.find(
                            (r) => r.id === f.rule_id,
                          )?.source_clause || "检测覆盖边界"}
                          <Link className="text-link" to="/rules">
                            查看规则
                          </Link>
                        </dd>
                        <dt>问题内容</dt>
                        <dd
                          className={"evidence-quote " + f.status.toLowerCase()}
                        >
                          {f.evidence}
                        </dd>
                        <dt>出现位置</dt>
                        <dd>
                          {f.location}
                          <button
                            className="text-link locate-button"
                            onClick={() => {
                              setActive(f.id);
                              setLocateVersion((version) => version + 1);
                            }}
                          >
                            <MapPin size={13} />
                            在原文中定位
                          </button>
                        </dd>
                        <dt>风险判断</dt>
                        <dd>{f.reason}</dd>
                        <dt>整改建议</dt>
                        <dd className="suggestion-box">{f.suggestion}</dd>
                      </dl>
                      <details className="disclosure evidence-technical">
                        <summary>检测详情</summary>

                        {f.detector}
                        <small className="confidence">
                          抽取置信度 {(f.confidence * 100).toFixed(0)}%
                        </small>
                        {f.ai_review && (
                          <>
                            <h3>AI 辅助</h3>
                            <p>
                              {f.ai_review.label}
                              <small className="confidence">
                                模型得分 {(f.ai_review.score * 100).toFixed(0)}%
                                · 仅为局部语境提示
                              </small>
                              <small className="confidence">
                                {f.ai_review.note}
                              </small>
                            </p>
                          </>
                        )}
                      </details>
                      <div className="decision-box">
                        <label>
                          人工判断记录
                          <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="记录判断依据或整改说明（可选）"
                            rows={2}
                          />
                        </label>
                        <div className="decision-actions">
                          <button
                            disabled={decision.isPending || !note.trim()}
                            onClick={() => decision.mutate({ f, d: "pending" })}
                          >
                            保存待确认
                          </button>
                          <button
                            disabled={decision.isPending}
                            onClick={() =>
                              decision.mutate({ f, d: "confirmed" })
                            }
                          >
                            <Check size={13} />
                            确认问题
                          </button>
                          <button
                            disabled={decision.isPending}
                            onClick={() =>
                              decision.mutate({ f, d: "dismissed" })
                            }
                          >
                            <EyeOff size={13} />
                            非问题
                          </button>
                          <button
                            disabled={decision.isPending}
                            onClick={() => decision.mutate({ f, d: "fixed" })}
                          >
                            <Wrench size={13} />
                            已整改
                          </button>
                        </div>
                        {f.resolution && (
                          <p>
                            已保存：
                            {f.resolution.decision === "pending"
                              ? "待确认"
                              : f.resolution.decision === "fixed"
                                ? "已整改（需复检验证）"
                                : f.resolution.decision === "dismissed"
                                  ? "非问题"
                                  : "确认问题"}{" "}
                            · {f.resolution.note}
                          </p>
                        )}
                        <small>
                          人工记录保留原始证据与统计；整改是否生效由复检验证。
                        </small>
                      </div>
                    </div>
                    <div className="evidence-preview">
                      <DocumentViewer
                        document={run.document}
                        finding={f}
                        findings={[f]}
                        locateVersion={locateVersion}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {!filtered.length && (
            <div className="list-empty">
              当前分类下没有 {status} 结果。请切换状态或分类。
            </div>
          )}
          {decision.error && <Notice error>{decision.error.message}</Notice>}
        </section>
      </div>
    </>
  );
}
