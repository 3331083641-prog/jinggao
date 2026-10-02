import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  Clock3,
  CheckCircle2,
  RefreshCw,
  Search,
  ChevronRight,
  Download,
  ArrowRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  PageHero,
  Empty,
  StatusBadge,
  FileIcon,
  RiskSummary,
  Notice,
} from "../components/ui";
import { Dialog } from "../components/Dialog";
import { DocumentViewer } from "../components/DocumentViewer";
import { useTasks, useRun, api, date, reportUrl } from "../api";
import type { Task } from "../types";
export function History() {
  const { data: tasks, error } = useTasks();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [rule, setRule] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [selected, setSelected] = useState<Task>();
  const { data: run } = useRun(selected?.latest_run_id);
  const { data: detail } = useQuery({
    queryKey: ["task", selected?.id],
    queryFn: () => api<Task>("/tasks/" + selected?.id),
    enabled: !!selected,
  });
  const filtered = tasks?.filter(
    (t) =>
      (t.name + t.id + t.latest_run.ruleset_snapshot.name).includes(search) &&
      (status === "ALL" || t.latest_run.status === status) &&
      (rule === "ALL" || t.latest_run.ruleset_id === rule) &&
      (period === "ALL" ||
        Date.now() - new Date(t.updated_at).getTime() <=
          Number(period) * 86400000),
  );
  const completed =
    tasks?.filter((t) => t.latest_run.state === "COMPLETED").length || 0;
  const review =
    tasks?.filter((t) => t.latest_run.status === "REVIEW").length || 0;
  const rechecks = tasks?.reduce((n, t) => n + t.run_ids.length - 1, 0) || 0;
  return (
    <>
      <PageHero
        title="历史任务"
        subtitle="查看以往的检测记录，支持重新检测与结果对比。"
      />
      <div className="history-stats">
        {[
          [ClipboardList, "任务总数", tasks?.length || 0, "本机保存的检测任务"],
          [Clock3, "需人工复核", review, "以最新检测结论统计"],
          [CheckCircle2, "已完成", completed, "检测流程已完成"],
          [RefreshCw, "累计复检", rechecks, "保留全部历史 Run"],
        ].map(([I, t, n, d]) => {
          const Icon = I as typeof ClipboardList;
          return (
            <div className="panel stat-card" key={String(t)}>
              <span>
                <Icon size={25} />
              </span>
              <div>
                <small>{String(t)}</small>
                <strong>{String(n)}</strong>
                <p>{String(d)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <section className="panel history-table">
        <div className="table-filters">
          <div className="search-box">
            <Search size={17} />
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
            className="button"
            onClick={() => {
              setSearch("");
              setStatus("ALL");
              setRule("ALL");
              setPeriod("ALL");
            }}
          >
            <RefreshCw size={14} />
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
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className={selected?.id === t.id ? "selected" : ""}
                    onClick={() => setSelected(t)}
                  >
                    <td>
                      <div className="table-file">
                        <FileIcon format={t.name.split(".").pop()} />
                        <div>
                          <b>{t.name}</b>
                          <small>
                            #{t.id.slice(0, 10)} · Run {t.run_ids.length}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {t.latest_run.ruleset_snapshot.name}
                      <small>v{t.latest_run.ruleset_snapshot.version}</small>
                    </td>
                    <td>{date(t.latest_run.created_at)}</td>
                    <td>
                      <StatusBadge status={t.latest_run.status} />
                    </td>
                    <td>
                      <div className="count-inline">
                        <span className="red">
                          {t.latest_run.counts.FAIL}
                          <small>FAIL</small>
                        </span>
                        <span className="orange">
                          {t.latest_run.counts.REVIEW}
                          <small>REVIEW</small>
                        </span>
                        <span className="green">
                          {t.latest_run.counts.PASS}
                          <small>PASS</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={"查看任务 " + t.name}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="table-footer">共 {filtered.length} 条本地任务</div>
          </div>
        ) : (
          <Empty
            title={tasks?.length ? "未找到匹配任务" : "还没有历史任务"}
            text="完成一次检测后，材料、规则快照和每次复检记录都会保存在这里。"
            action={
              <Link to="/new" className="button primary">
                开始检测
                <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>
      {selected && (
        <Dialog title="任务详情" drawer onClose={() => setSelected(undefined)}>
          {run ? (
            <>
              <div className="drawer-file">
                <FileIcon format={run.document?.format} />
                <div>
                  <h3>{selected.name}</h3>
                  <p>#{selected.id.slice(0, 12)}</p>
                </div>
              </div>
              <div className="drawer-rule">
                <span>使用规则集</span>
                <b>{run.ruleset_snapshot.name}</b>
                <StatusBadge status={run.status} />
              </div>
              <h3 className="drawer-section">结果统计</h3>
              <RiskSummary run={run} />
              <h3 className="drawer-section">文档预览</h3>
              <div className="drawer-preview">
                <DocumentViewer document={run.document} />
              </div>
              {detail?.runs && detail.runs.length > 1 && (
                <>
                  <h3 className="drawer-section">复检对比</h3>
                  <div className="compare-table">
                    {detail.runs.map((r) => (
                      <Link to={"/workspace/" + r.id} key={r.id}>
                        <b>Run {r.version}</b>
                        <span className="red">FAIL {r.counts.FAIL}</span>
                        <span className="orange">REVIEW {r.counts.REVIEW}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
              <div className="drawer-actions">
                <Link className="button primary" to={"/workspace/" + run.id}>
                  查看详情
                </Link>
                <Link
                  className="button"
                  to={`/new?task=${run.task_id}&rule=${run.ruleset_id}`}
                >
                  <RefreshCw size={15} />
                  复检
                </Link>
                <a className="button" href={reportUrl(run.id)} download>
                  <Download size={15} />
                  报告
                </a>
              </div>
            </>
          ) : (
            <Notice>正在读取任务…</Notice>
          )}
        </Dialog>
      )}
    </>
  );
}
