import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  Search,
  ChevronRight,
  Download,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  X,
  FileText,
  Trash2,
} from "lucide-react";
import {
  PageHero,
  Empty,
  StatusBadge,
  FileIcon,
  RiskSummary,
  Notice,
} from "../components/ui";
import { DocumentViewer } from "../components/DocumentViewer";
import { Pagination } from "../components/Pagination";
import { useTasks, useRun, date, reportUrl, api } from "../api";
import { Dialog } from "../components/Dialog";
import type { Task } from "../types";
export function History() {
  const { data: tasks, error } = useTasks();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rule, setRule] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [selected, setSelected] = useState<Task>();
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<Task[]>([]);
  const qc = useQueryClient();
  const deletion = useMutation({
    mutationFn: (ids: string[]) =>
      api<{ deleted: number }>("/tasks/delete-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      setSelected(undefined);
      setRemoving([]);
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
  useEffect(() => setPage(1), [search, status, rule, period]);
  const { data: run } = useRun(selected?.latest_run_id);
  const filtered = tasks?.filter(
    (t) =>
      (t.name + t.id + t.latest_run.ruleset_snapshot.name)
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "ALL" || t.latest_run.status === status) &&
      (rule === "ALL" || t.latest_run.ruleset_id === rule) &&
      (period === "ALL" ||
        Date.now() - new Date(t.updated_at).getTime() <=
          Number(period) * 86400000),
  );
  const stats = [
    [ClipboardList, "任务总数", tasks?.length || 0],
    [
      AlertCircle,
      "需确认",
      tasks?.filter((t) => ["REVIEW", "UNKNOWN"].includes(t.latest_run.status))
        .length || 0,
    ],
    [
      RefreshCw,
      "累计复检",
      tasks?.reduce((sum, t) => sum + Math.max(0, t.run_ids.length - 1), 0) ||
        0,
    ],
  ];
  return (
    <div className={"history-page " + (selected ? "has-selection" : "")}>
      <PageHero
        title="历史任务"
        subtitle="查看以往的检测记录，支持重新检测与结果对比。"
      >
        {tasks?.some((t) => t.name.toLowerCase().endsWith(".pdf")) && (
          <button
            type="button"
            className="button"
            onClick={() => {
              deletion.reset();
              setRemoving(
                tasks.filter((t) => t.name.toLowerCase().endsWith(".pdf")),
              );
            }}
          >
            <Trash2 size={16} />
            清理 PDF 任务
          </button>
        )}
      </PageHero>
      <div className="history-stats">
        {stats.map(([I, label, value]) => {
          const Icon = I as typeof ClipboardList;
          return (
            <div className="history-stat" key={String(label)}>
              <span>
                <Icon size={32} />
              </span>
              <div>
                <p>{String(label)}</p>
                <strong>{Number(value)}</strong>
              </div>
            </div>
          );
        })}
      </div>
      <section className="panel history-table">
        <div className="table-filters">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label="搜索任务"
              placeholder="搜索文件名、规则集或任务编号…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="任务状态"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">全部状态</option>
            {["FAIL", "REVIEW", "PASS", "UNKNOWN"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="任务规则"
            value={rule}
            onChange={(e) => setRule(e.target.value)}
          >
            <option value="ALL">全部规则集</option>
            {[
              ...new Map(
                tasks?.map((t) => [
                  t.latest_run.ruleset_id,
                  t.latest_run.ruleset_snapshot.name,
                ]),
              ).entries(),
            ].map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
          </select>
          <select
            aria-label="任务时间"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="ALL">全部时间</option>
            <option value="7">最近 7 天</option>
            <option value="30">最近 30 天</option>
          </select>
          <button
            type="button"
            className="button"
            onClick={() => {
              setSearch("");
              setStatus("ALL");
              setRule("ALL");
              setPeriod("ALL");
            }}
          >
            <RefreshCw size={16} />
            重置
          </button>
        </div>
        {error ? (
          <Notice error>{error.message}</Notice>
        ) : filtered?.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>文件信息</th>
                  <th>使用规则集</th>
                  <th>检测时间 ↓</th>
                  <th>状态</th>
                  <th>结果统计</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page - 1) * 5, page * 5).map((t) => (
                  <tr
                    key={t.id}
                    className={selected?.id === t.id ? "selected" : ""}
                    onClick={() => setSelected(t)}
                    onKeyDown={(e) => {
                      if (
                        e.target === e.currentTarget &&
                        (e.key === "Enter" || e.key === " ")
                      ) {
                        e.preventDefault();
                        setSelected(t);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td>
                      <div className="table-file">
                        <FileIcon format={t.name.split(".").pop()} />
                        <div>
                          <b>{t.name}</b>
                          <small>
                            #{t.id.slice(0, 10)} · Run {t.latest_run.version}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.latest_run.ruleset_snapshot.name}
                      <small className="table-version">
                        v{t.latest_run.ruleset_snapshot.version}
                      </small>
                    </td>
                    <td>{date(t.latest_run.created_at)}</td>
                    <td>
                      <StatusBadge status={t.latest_run.status} />
                    </td>
                    <td>
                      <div className="count-inline">
                        {(
                          [
                            ["FAIL", "red"],
                            ["REVIEW", "orange"],
                            ["PASS", "green"],
                          ] as const
                        ).map(([s, c]) => (
                          <span key={s} className={c}>
                            {t.latest_run.counts[s]}
                            <small>{s}</small>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"查看任务 " + t.name}
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={"删除任务 " + t.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          deletion.reset();
                          setRemoving([t]);
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              total={filtered.length}
              unit="条本地任务"
              page={page}
              pageSize={5}
              onChange={setPage}
            />
          </div>
        ) : (
          <Empty
            title={tasks?.length ? "未找到匹配任务" : "还没有历史任务"}
            text="完成检测后，记录会保存在这里。"
            action={
              <Link to="/new" className="button primary">
                开始检测
                <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>
      <AnimatePresence>
        {selected && (
          <motion.aside
            role="dialog"
            aria-modal="false"
            aria-label="任务详情"
            className="history-drawer"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(undefined);
            }}
          >
            <div className="section-title">
              <h2>{selected.name}</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭"
                onClick={() => setSelected(undefined)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="drawer-caption">
              #{selected.id.slice(0, 10)} · {date(run?.created_at)}
            </p>
            {run ? (
              <>
                <div className="drawer-preview">
                  <DocumentViewer document={run.document} compact />
                </div>
                <dl className="drawer-metadata">
                  <dt>使用规则集</dt>
                  <dd>
                    {run.ruleset_snapshot.name} v{run.ruleset_snapshot.version}
                  </dd>
                  <dt>检测时间</dt>
                  <dd>{date(run.created_at)}</dd>
                  <dt>状态</dt>
                  <dd>
                    <StatusBadge status={run.status} />
                  </dd>
                </dl>
                <h3 className="drawer-section">结果统计</h3>
                <RiskSummary run={run} />
                <h3 className="drawer-section">快捷操作</h3>
                <div className="drawer-actions">
                  <Link
                    className="button primary"
                    to={"/workbench/" + run.task_id + "?run=" + run.id}
                  >
                    <FileText size={18} />
                    查看详情
                  </Link>
                  <Link
                    className="button"
                    to={`/new?task=${run.task_id}&rule=${run.ruleset_id}`}
                  >
                    <RefreshCw size={18} />
                    复检
                  </Link>
                  <a className="button" href={reportUrl(run.id)} download>
                    <Download size={18} />
                    导出报告
                  </a>
                </div>
              </>
            ) : (
              <Notice>正在读取任务…</Notice>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
      {!!removing.length && (
        <Dialog
          title="删除本地任务"
          onClose={() => {
            if (!deletion.isPending) setRemoving([]);
          }}
        >
          <div className="form-stack">
            <p>
              将删除 {removing.length}{" "}
              个任务及关联检测记录、报告。应用内副本会存入本地备份，原始文件保留。
            </p>
            <details className="disclosure">
              <summary>查看待删除文件</summary>
              {removing.map((t) => (
                <p key={t.id}>
                  {t.name} · {t.run_ids.length} 次检测
                </p>
              ))}
            </details>
            {deletion.error && <Notice error>{deletion.error.message}</Notice>}
            <button
              type="button"
              className="button primary"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate(removing.map((t) => t.id))}
            >
              {deletion.isPending ? "正在删除…" : "确认删除"}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
