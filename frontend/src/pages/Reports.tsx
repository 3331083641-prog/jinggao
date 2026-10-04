import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Download,
  X,
  ArrowRight,
  ChevronRight,
  Trash2,
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
import { ReportActions } from "../components/ReportActions";
import { Pagination } from "../components/Pagination";
import { Dialog } from "../components/Dialog";
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
  const [format, setFormat] = useState("ALL");
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<Run>();
  const qc = useQueryClient();
  const deletion = useMutation({
    mutationFn: (id: string) => api("/reports/" + id, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<Run[]>(["reports"], (current) =>
        current?.filter((r) => r.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["reports"] });
      if (active === id) setActive(undefined);
      setRemoving(undefined);
    },
  });
  function requestDelete(run: Run) {
    deletion.reset();
    setRemoving(run);
  }
  useEffect(() => setPage(1), [search, status, period, format]);
  const filtered = reports?.filter(
    (r) =>
      (r.document_name + r.ruleset_snapshot.name).includes(search) &&
      (status === "ALL" || r.status === status) &&
      (format === "ALL" ||
        r.document_name?.split(".").pop()?.toLowerCase() === format) &&
      (period === "ALL" ||
        Date.now() - new Date(r.created_at).getTime() <=
          Number(period) * 86400000),
  );
  useEffect(() => {
    setPage((current) =>
      Math.min(current, Math.max(1, Math.ceil((filtered?.length || 0) / 5))),
    );
  }, [filtered?.length]);
  const selectedId = filtered?.some((r) => r.id === active)
    ? active
    : undefined;
  const { data: selected } = useRun(selectedId);
  return (
    <>
      <PageHero
        className="report-hero"
        title="报告中心"
        subtitle="查看与导出合规检测报告。"
      />
      <div className="table-filters report-filters">
        <div className="search-box">
          <Search size={17} />
          <input
            aria-label="搜索报告"
            placeholder="搜索报告名称或文件名…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActive(undefined);
            }}
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
        <select
          aria-label="报告类型"
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setActive(undefined);
          }}
        >
          <option value="ALL">全部类型</option>
          {[
            ...new Set(
              reports
                ?.map((r) => r.document_name?.split(".").pop()?.toLowerCase())
                .filter(Boolean),
            ),
          ].map((f) => (
            <option key={f} value={f}>
              {f?.toUpperCase()}
            </option>
          ))}
        </select>
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
        <div
          className={
            "reports-grid " + (selectedId ? "has-detail" : "without-detail")
          }
        >
          <section className="panel report-list">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>报告名称</th>
                    <th>文件</th>
                    <th>规则</th>
                    <th>检测时间 ↓</th>
                    <th>结果状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice((page - 1) * 5, page * 5).map((r) => (
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
                            <small>合规检测报告</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <FileIcon format={r.document_name?.split(".").pop()} />
                      </td>
                      <td>{r.ruleset_snapshot.name}</td>
                      <td>{date(r.created_at)}</td>
                      <td>
                        <StatusBadge status={r.status} />
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="button report-view"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActive(r.id);
                            }}
                          >
                            查看
                          </button>
                          <ReportActions run={r} onDelete={requestDelete} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={filtered.length}
              unit="份报告"
              page={page}
              pageSize={5}
              onChange={setPage}
            />
          </section>
          <AnimatePresence>
            {selectedId && selected && (
              <motion.aside
                className="panel report-detail"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="section-title">
                  <h2 className="sr-only">报告详情</h2>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="关闭报告详情"
                    onClick={() => setActive(undefined)}
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="report-file-heading">
                  <FileIcon format={selected.document?.format} />
                  <div>
                    <h3>{selected.document?.name}</h3>
                    <p className="report-meta">
                      {date(selected.created_at)} · Run {selected.version}
                    </p>
                    <p className="report-meta">
                      使用规则：{selected.ruleset_snapshot.name}
                    </p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="report-preview">
                  <DocumentViewer document={selected.document} compact />
                </div>
                <RiskSummary run={selected} />
                <div className="section-title report-key-title">
                  <h3>关键发现</h3>
                  <Link to={"/evidence/" + selected.id} className="text-link">
                    查看全部
                    <ChevronRight size={14} />
                  </Link>
                </div>
                <div className="report-findings">
                  {selected.findings
                    .filter((f) => f.status !== "PASS")
                    .slice(0, 3)
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
                <button
                  type="button"
                  className="button report-delete"
                  onClick={() => requestDelete(selected)}
                >
                  <Trash2 size={16} />
                  删除报告
                </button>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}
      {removing && (
        <Dialog
          title="删除报告"
          onClose={() => {
            if (!deletion.isPending) setRemoving(undefined);
          }}
        >
          <div className="form-stack">
            <p>
              确定删除「{removing.document_name || removing.document?.name}」的
              Run {removing.version} 报告？
            </p>
            <p className="muted">
              仅从报告中心移除这份报告。检测证据、复检记录和原始材料保留，可从工作台重新导出。
            </p>
            {deletion.error && <Notice error>{deletion.error.message}</Notice>}
            <button
              type="button"
              className="button primary"
              disabled={deletion.isPending}
              onClick={() => deletion.mutate(removing.id)}
            >
              {deletion.isPending ? "正在删除…" : "确认删除"}
            </button>
            <button
              type="button"
              className="button"
              disabled={deletion.isPending}
              onClick={() => setRemoving(undefined)}
            >
              取消
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
