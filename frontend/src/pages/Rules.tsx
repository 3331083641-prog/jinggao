import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Plus,
  Search,
  GraduationCap,
  Trophy,
  FileText,
  BookOpen,
  ChevronRight,
  Check,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { PageHero, Notice, Empty } from "../components/ui";
import { Dialog } from "../components/Dialog";
import { FilePicker, validateFile } from "../components/FilePicker";
import { useRules, api } from "../api";
import type { Rule, RuleSet } from "../types";
type Draft = {
  source_documents?: Record<string, unknown>[];
  name: string;
  source: string;
  rules: Rule[];
  notice: string;
  explanations: {
    confidence: number;
    rule_id: string;
    predicted_target: string;
  }[];
  warnings: string[];
  files?: { name: string; sha256: string }[];
};
export function Rules() {
  const { data: rulesets, error } = useRules();
  const [active, setActive] = useState("anonymous");
  const [category, setCategory] = useState("全部规则");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("概述");
  const [modal, setModal] = useState<"custom" | "import" | null>(null);
  const [draft, setDraft] = useState<Draft>();
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [source, setSource] = useState("");
  const [fileError, setFileError] = useState("");
  const [expandedChecks, setExpandedChecks] = useState(false);
  const [removing, setRemoving] = useState<RuleSet>();
  const qc = useQueryClient();
  const importing = useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      files.forEach((file) =>
        form.append(files.length === 1 ? "file" : "files", file),
      );
      return api<Draft>(
        files.length === 1 ? "/rulesets/parse" : "/rulesets/parse-batch",
        { method: "POST", body: form },
      );
    },
    onSuccess: (d) => {
      setDraft(d);
      setName(d.name);
      setModal("import");
    },
  });
  const save = useMutation({
    mutationFn: (payload: any) =>
      api<RuleSet>("/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["rules"] });
      setActive(r.id);
      setModal(null);
      setDraft(undefined);
    },
  });
  const selected = rulesets?.find((r) => r.id === active) || rulesets?.[0];
  const deletion = useMutation({
    mutationFn: (id: string) =>
      api<{ deleted: boolean }>("/rulesets/" + id, { method: "DELETE" }),
    onSuccess: (_, id) => {
      qc.setQueryData<RuleSet[]>(["rules"], (current) =>
        current?.filter((rule) => rule.id !== id),
      );
      qc.invalidateQueries({ queryKey: ["rules"] });
      setActive("anonymous");
      setTab("概述");
      setExpandedChecks(false);
      setRemoving(undefined);
    },
  });
  const categories = [
    "全部规则",
    "匿名评审",
    "竞赛提交",
    "学术投稿",
    "自定义规则",
  ];
  const visible = rulesets
    ?.filter(
      (r) =>
        (category === "全部规则" || r.category === category) &&
        (r.name + r.description + r.source).includes(search),
    )
    .sort(
      (a, b) =>
        (["anonymous", "competition", "academic"].indexOf(a.id) < 0
          ? 3
          : ["anonymous", "competition", "academic"].indexOf(a.id)) -
        (["anonymous", "competition", "academic"].indexOf(b.id) < 0
          ? 3
          : ["anonymous", "competition", "academic"].indexOf(b.id)),
    );
  const Icon =
    selected?.category === "匿名评审"
      ? GraduationCap
      : selected?.category === "竞赛提交"
        ? Trophy
        : FileText;
  const makeCustom = () => {
    if (!name.trim() || !term.trim()) return;
    save.mutate({
      name: name.trim(),
      category: "自定义规则",
      description: "依据实际提交规范，检查明确禁止的内容。",
      source: source || "用户自定义",
      rules: [
        {
          id: crypto.randomUUID(),
          category: "身份泄露",
          target: "literal",
          severity: "high",
          scope: [
            "BODY_TEXT",
            "HEADER",
            "FOOTER",
            "METADATA",
            "COMMENT",
            "REVISION",
            "HIDDEN_TEXT",
            "HYPERLINK",
            "IMAGE_OCR",
            "NOTES",
          ],
          description: "禁止出现：" + term,
          detection_method: "literal",
          evidence_requirement: "原文与位置",
          remediation: "删除或替换该内容后重新上传复检。",
          source_clause: source || "用户确认的禁止词",
          parameters: { text: term.trim() },
        },
      ],
    });
  };
  return (
    <>
      <PageHero
        title="规则库"
        subtitle="选择和管理检查标准，让审核更专业、更高效。"
      >
        <div className="hero-actions">
          <FilePicker
            label="导入规则"
            className="button primary file-picker-button"
            accept=".pdf,.doc,.docx,.txt,.md"
            multiple
            onFiles={(files) => {
              const problem =
                files.length > 10
                  ? "每次最多选择 10 份规则文件"
                  : files
                      .map((file) =>
                        validateFile(file, ["pdf", "doc", "docx", "txt", "md"]),
                      )
                      .find(Boolean) || "";
              setFileError(problem);
              if (!problem) {
                setDraft(undefined);
                setModal("import");
                importing.mutate(files);
              }
            }}
            disabled={importing.isPending}
          >
            <Upload size={17} />
            {importing.isPending ? "正在解析…" : "导入规则"}
          </FilePicker>
          <button
            className="button"
            onClick={() => {
              setName("");
              setTerm("");
              setSource("");
              setModal("custom");
            }}
          >
            <Plus size={17} />
            新建自定义规则
          </button>
        </div>
      </PageHero>
      {importing.isPending && (
        <div className="import-progress" role="status">
          正在解析规则…
          <progress aria-label="正在解析规则" />
        </div>
      )}
      {(error || importing.error || fileError) && (
        <Notice error>
          {fileError || error?.message || importing.error?.message}
        </Notice>
      )}
      <div className="rules-grid">
        <aside className="rule-categories">
          <h2>规则分类</h2>
          {categories.map((c, i) => {
            const I = [
              BookOpen,
              GraduationCap,
              Trophy,
              FileText,
              SlidersHorizontal,
            ][i];
            return (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                <I size={18} />
                <span>{c === "竞赛提交" ? "竞赛申报" : c}</span>
                <small>
                  {rulesets?.filter((r) => c === "全部规则" || r.category === c)
                    .length || 0}
                </small>
              </button>
            );
          })}
        </aside>
        <section className="rule-catalog">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="搜索规则"
              placeholder="搜索规则名称、来源或关键词…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="rule-card-grid">
            {visible?.map((r) => {
              const I =
                r.category === "匿名评审"
                  ? GraduationCap
                  : r.category === "竞赛提交"
                    ? Trophy
                    : r.category === "自定义规则"
                      ? SlidersHorizontal
                      : FileText;
              return (
                <button
                  key={r.id}
                  className={
                    "rule-card " +
                    (r.id === "competition"
                      ? "competition "
                      : r.category === "自定义规则"
                        ? "custom "
                        : "") +
                    (selected?.id === r.id ? "selected" : "")
                  }
                  onClick={() => {
                    setActive(r.id);
                    setTab("概述");
                    setExpandedChecks(false);
                  }}
                >
                  <span className="rule-card-icon">
                    <I size={25} />
                  </span>
                  {selected?.id === r.id && (
                    <span className="rule-card-check">
                      <Check size={13} />
                    </span>
                  )}
                  <h3>{r.name}</h3>
                  <div className="rule-tags">
                    <span>{r.category}</span>
                  </div>
                  <p>{r.description}</p>
                  <div className="rule-card-footer">
                    <FileText size={13} />
                    {r.rules.length} 项检查
                  </div>
                  <ChevronRight size={16} className="rule-card-chevron" />
                </button>
              );
            })}
          </div>
          {visible?.length === 0 && (
            <Empty
              title="没有匹配的规则"
              text="尝试其他关键词或导入真实提交规范。"
            />
          )}
        </section>
        {selected && (
          <aside className="panel rule-detail">
            <div className="rule-detail-header">
              <span className="rule-card-icon">
                <Icon size={28} />
              </span>
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.category}</p>
                <p className="rule-version-caption">
                  版本：v{selected.version} · {selected.updated_at.slice(0, 10)}{" "}
                  更新
                </p>
              </div>
            </div>
            <div className="detail-tabs">
              {["概述", "适用场景", "检查项", "版本信息"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                  {tab === t && (
                    <motion.span
                      className="tab-underline"
                      layoutId="rules-tab"
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </button>
              ))}
            </div>
            <motion.div
              key={selected.id + tab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              {tab === "概述" ? (
                <>
                  <h3 className="rule-overview-title">规则概述</h3>
                  <p>{selected.description}</p>
                  <h3>
                    主要检查项 <small>（共 {selected.rules.length} 项）</small>
                  </h3>
                  <div className="rule-checks">
                    {selected.rules
                      .slice(0, expandedChecks ? undefined : 4)
                      .map((r) => (
                        <button key={r.id} onClick={() => setTab("检查项")}>
                          <FileText size={14} />
                          {r.description}
                          <ChevronRight size={14} />
                        </button>
                      ))}
                  </div>
                  {selected.rules.length > 4 && (
                    <button
                      type="button"
                      className="text-link all-checks"
                      aria-label="全部检查项"
                      aria-expanded={expandedChecks}
                      onClick={() => setExpandedChecks((value) => !value)}
                    >
                      {expandedChecks
                        ? "收起检查项"
                        : `查看全部 ${selected.rules.length} 项`}
                      <ChevronRight size={16} />
                    </button>
                  )}
                  <small className="rule-origin">
                    {["anonymous", "competition", "academic"].includes(
                      selected.id,
                    )
                      ? "基础自查建议"
                      : "用户确认的规范"}
                  </small>
                </>
              ) : tab === "检查项" ? (
                <div className="rule-items">
                  {selected.rules.map((r) => (
                    <details key={r.id}>
                      <summary>{r.description}</summary>
                      <p>{r.source_clause}</p>
                      <small>
                        检测：{r.detection_method} · {r.severity} ·{" "}
                        {r.scope.join(" / ")}
                      </small>
                      <p>整改：{r.remediation}</p>
                    </details>
                  ))}
                </div>
              ) : tab === "适用场景" ? (
                <>
                  <h3>{selected.category}</h3>
                  <p>
                    用于当前规范下的材料提交前检查。基础建议不替代实际赛事、期刊或评审要求。
                  </p>
                </>
              ) : (
                <>
                  <h3>来源与版本</h3>
                  <p>{selected.source}</p>
                  <p>版本 {selected.version}</p>
                  <p>{selected.updated_at}</p>
                  <p className="version-note">
                    每次检测保存规则快照，后续规则变更不会影响旧报告。
                  </p>
                </>
              )}
            </motion.div>
            <Link
              className="button primary use-rule"
              to={"/new?rule=" + selected.id}
            >
              使用该规则
              <ChevronRight size={16} />
            </Link>
            {!["anonymous", "competition", "academic"].includes(
              selected.id,
            ) && (
              <button
                type="button"
                className="button delete-rule"
                onClick={() => {
                  deletion.reset();
                  setRemoving(selected);
                }}
              >
                <Trash2 size={16} />
                删除规则
              </button>
            )}
          </aside>
        )}
      </div>
      {removing && (
        <Dialog
          title="删除规则"
          onClose={() => {
            if (!deletion.isPending) setRemoving(undefined);
          }}
        >
          <div className="form-stack">
            <p>确定删除「{removing.name}」？</p>
            <p className="muted">
              将从规则库移除。历史检测、报告和复检保留原规则快照。
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
      {modal && (
        <Dialog
          drawer={modal === "import"}
          title={modal === "custom" ? "新建自定义规则" : "确认导入规则"}
          onClose={() => setModal(null)}
        >
          {modal === "custom" ? (
            <div className="form-stack">
              <label>
                规则集名称
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="输入真实规则名称"
                />
              </label>
              <label>
                明确禁止的关键词
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="例如需要隐去的真实单位名称"
                />
              </label>
              <label>
                规范原文 / 来源
                <textarea
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="记录规则依据，便于审查与追溯"
                  rows={3}
                />
              </label>
              <Notice>
                仅精确检查你明确指定的词。别名、图片语义和解析缺口仍需人工复核。
              </Notice>
              <button
                className="button primary"
                disabled={!name.trim() || !term.trim() || save.isPending}
                onClick={makeCustom}
              >
                保存规则
              </button>
            </div>
          ) : importing.isPending ? (
            <div className="rule-import-status" role="status">
              <h3>正在读取规则…</h3>
              <progress aria-label="规则解析中" />
              <p>提取检查项后，请核对并确认。</p>
            </div>
          ) : (
            draft && (
              <div className="form-stack">
                <p>请核对候选条款后保存。</p>
                {draft.files && (
                  <details className="disclosure">
                    <summary>
                      {draft.files.length} 份来源文件 · {draft.rules.length}{" "}
                      项检查
                    </summary>
                    {draft.files.map((file) => (
                      <p key={file.sha256}>{file.name}</p>
                    ))}
                  </details>
                )}
                <label>
                  规则集名称
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <div className="draft-list">
                  {draft.rules.map((r, i) => (
                    <div key={r.id}>
                      <label>
                        条款 {i + 1}
                        <textarea
                          value={r.description}
                          onChange={(e) =>
                            setDraft(
                              (d) =>
                                d && {
                                  ...d,
                                  rules: d.rules.map((x, j) =>
                                    j === i
                                      ? { ...x, description: e.target.value }
                                      : x,
                                  ),
                                },
                            )
                          }
                        />
                      </label>
                      <small>原文：{r.source_clause}</small>
                      {typeof r.parameters.source_file === "string" && (
                        <small>来源：{r.parameters.source_file}</small>
                      )}
                      <details className="disclosure">
                        <summary>检测详情</summary>
                        <div className="draft-controls">
                          <select
                            aria-label={`条款 ${i + 1} 检测方式`}
                            value={r.detection_method}
                            disabled={!!(r.condition || r.exception)}
                            onChange={(e) =>
                              setDraft(
                                (d) =>
                                  d && {
                                    ...d,
                                    rules: d.rules.map((x, j) =>
                                      j === i
                                        ? {
                                            ...x,
                                            detection_method: e.target.value,
                                          }
                                        : x,
                                    ),
                                  },
                              )
                            }
                          >
                            <option value="manual">人工复核</option>
                            <option value="recognizer">身份识别</option>
                            <option value="presence">属性 / 隐藏残留</option>
                            <option value="visual">图像语义复核</option>
                            <option value="format">格式检查</option>
                          </select>
                          <span>
                            {draft.explanations.find((x) => x.rule_id === r.id)
                              ?.confidence !== undefined
                              ? "语义分类置信度 " +
                                Math.round(
                                  (draft.explanations.find(
                                    (x) => x.rule_id === r.id,
                                  )?.confidence || 0) * 100,
                                ) +
                                "%"
                              : "原文映射 · 待确认"}
                          </span>
                        </div>
                        {r.condition && (
                          <p className="muted">适用条件：{r.condition}</p>
                        )}
                        {r.exception && (
                          <p className="muted">例外：{r.exception}</p>
                        )}
                        {r.coverage_expectation && (
                          <p className="muted">
                            覆盖：{r.coverage_expectation}
                          </p>
                        )}
                        {typeof r.parameters.semantic_suggestion ===
                          "string" && (
                          <p className="muted">
                            本地模型建议（不改变执行权限）：
                            {r.parameters.semantic_suggestion}
                          </p>
                        )}
                      </details>
                    </div>
                  ))}
                </div>
                <details className="disclosure">
                  <summary>解析说明</summary>
                  <p>{draft.notice}</p>
                  {draft.warnings?.map((w) => (
                    <p className="muted" key={w}>
                      {w}
                    </p>
                  ))}
                </details>
                <button
                  className="button primary"
                  disabled={!name.trim() || save.isPending}
                  onClick={() =>
                    save.mutate({
                      name,
                      source: draft.source,
                      source_documents: draft.source_documents || [],
                      category: "自定义规则",
                      description: "用户导入并确认的真实提交规范",
                      rules: draft.rules,
                    })
                  }
                >
                  <Check size={16} />
                  我已逐条确认，保存规则
                </button>
              </div>
            )
          )}
          {save.error && <Notice error>{save.error.message}</Notice>}
          {importing.error && <Notice error>{importing.error.message}</Notice>}
        </Dialog>
      )}
    </>
  );
}
