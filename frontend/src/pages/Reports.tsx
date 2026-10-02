import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Download,
  RefreshCw,
  ArrowRight,
  ChevronRight,
  FileText,
} from "lucide-react";
import {
  PageHero,
  Empty,
  StatusBadge,
  FileIcon,
  Notice,
  RiskSummary,
} from "../components/ui";
import { DocumentViewer } from "../components/DocumentViewer";
import { api, useRun, date, reportUrl } from "../api";
import type { Run } from "../types";
export function Reports() {
  const { data: reports, error } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api<Run[]>("/reports"),
    refetchInterval: 5000,
  });
  const [active, setActive] = useState<string>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const filtered = reports?.filter(
    (r) =>
      (r.document_name + r.ruleset_snapshot.name).includes(search) &&
      (status === "ALL" || r.status === status) &&
      (period === "ALL" ||
        Date.now() - new Date(r.created_at).getTime() <=
          Number(period) * 86400000),
  );
  const { data: selected } = useRun(active || filtered?.[0]?.id);
  return (
    <>
      <PageHero title="报告中心" subtitle="查看与导出合规检测报告">
        <p className="hero-description">
          集中管理本机检测报告，保留规则、证据与复检记录。
        </p>
      </PageHero>
      <div className="panel table-filters report-filters">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="搜索报告"
            placeholder="搜索文件名或规则…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="报告状态"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setActive(undefined);
          }}
        >
          <option value="ALL">全部状态</option>
          {["FAIL", "REVIEW", "PASS"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="报告时间"
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setActive(undefined);
          }}
        >
          <option value="ALL">全部时间</option>
          <option value="7">最近 7 天</option>
          <option value="30">最近 30 天</option>
        </select>
        <span className="report-type">
          <FileText size={16} />
          合规检测报告 · PDF
        </span>
      </div>
      {error ? (
        <Notice error>{error.message}</Notice>
      ) : !filtered?.length ? (
        <section className="panel">
          <Empty
            title="暂无检测报告"
            text="完成真实检测后，报告将在这里生成；每次复检独立保留。"
            action={
              <Link to="/new" className="button primary">
                新建检测
                <ArrowRight size={16} />
              </Link>
            }
          />
        </section>
      ) : (
        <div className="reports-grid">
          <section className="panel report-list">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>报告名称 / 文件</th>
                    <th>规则</th>
                    <th>检测时间 ↓</th>
                    <th>结果状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={selected?.id === r.id ? "selected" : ""}
                      onClick={() => setActive(r.id)}
                    >
                      <td>
                        <div className="table-file">
                          <FileIcon
                            format={r.document_name?.split(".").pop()}
                          />
                          <div>
                            <b>{r.document_name}</b>
                            <small>合规检测报告 · Run {r.version}</small>
                          </div>
                        </div>
                      </td>
                      <td>{r.ruleset_snapshot.name}</td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActive(r.id);
                            }}
                          >
                            查看
                          </button>
                          <a
                            href={reportUrl(r.id)}
                            download
                            onClick={(e) => e.stopPropagation()}
                          >
                            导出
                          </a>
                          <Link
                            to={`/new?task=${r.task_id}&rule=${r.ruleset_id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            复检
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              共 {filtered.length} 份真实报告 · 每次检测独立生成
            </div>
          </section>
          {selected && (
            <aside className="panel report-detail">
              <div className="section-title">
                <h2>报告详情</h2>
                <StatusBadge status={selected.status} />
              </div>
              <h3>{selected.document?.name}</h3>
              <p className="report-meta">
                {date(selected.created_at)} · Run {selected.version}
              </p>
              <p className="report-meta">
                使用规则：{selected.ruleset_snapshot.name}
              </p>
              <div className="report-preview">
                <DocumentViewer document={selected.document} />
              </div>
              <RiskSummary run={selected} />
              <div className="section-title report-key-title">
                <h3>关键发现</h3>
                <Link to={"/evidence/" + selected.id} className="text-link">
                  完整证据
                  <ChevronRight size={14} />
                </Link>
              </div>
              <div className="report-findings">
                {selected.findings
                  .filter((f) => f.status !== "PASS")
                  .slice(0, 4)
                  .map((f) => (
                    <Link key={f.id} to={"/evidence/" + selected.id}>
                      <span className={f.status.toLowerCase()}>●</span>
                      <div>
                        <b>{f.title}</b>
                        <small>{f.evidence}</small>
                      </div>
                      <ChevronRight size={13} />
                    </Link>
                  ))}
              </div>
              <a
                className="button primary report-download"
                href={reportUrl(selected.id)}
                download
              >
                <Download size={16} />
                导出完整 PDF 报告
              </a>
            </aside>
          )}
        </div>
      )}
    </>
  );
}
