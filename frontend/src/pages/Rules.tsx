import { useRef, useState } from "react";
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
} from "lucide-react";
import { PageHero, Notice, Empty } from "../components/ui";
import { Dialog } from "../components/Dialog";
import { useRules, api } from "../api";
import type { Rule, RuleSet } from "../types";
type Draft = {
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
  const input = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importing = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api<Draft>("/rulesets/parse", { method: "POST", body: form });
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
  const categories = [
    "全部规则",
    "匿名评审",
    "竞赛提交",
    "学术投稿",
    "自定义规则",
  ];
  const visible = rulesets?.filter(
    (r) =>
      (category === "全部规则" || r.category === category) &&
      (r.name + r.description + r.source).includes(search),
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
          <button
            className="button primary"
            onClick={() => input.current?.click()}
            disabled={importing.isPending}
          >
            <Upload size={17} />
            {importing.isPending ? "正在解析…" : "导入规则"}
          </button>
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
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) importing.mutate(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {(error || importing.error) && (
        <Notice error>{error?.message || importing.error?.message}</Notice>
      )}
      <div className="rules-grid">
        <aside className="panel rule-categories">
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
                <span>{c}</span>
                <small>
                  {rulesets?.filter((r) => c === "全部规则" || r.category === c)
                    .length || 0}
                </small>
              </button>
            );
          })}
        </aside>
        <section className="panel rule-catalog">
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
                    "rule-card " + (selected?.id === r.id ? "selected" : "")
                  }
                  onClick={() => {
                    setActive(r.id);
                    setTab("概述");
                  }}
                >
                  <span
                    className={
                      "rule-card-icon " +
                      (r.category === "竞赛提交"
                        ? "mint"
                        : r.category === "自定义规则"
                          ? "gold"
                          : "")
                    }
                  >
                    <I size={25} />
                  </span>
                  {selected?.id === r.id && (
                    <span className="rule-card-check">
                      <Check size={13} />
                    </span>
                  )}
                  <h3>{r.name}</h3>
                  <div className="rule-tags">
                    <span>
                      {["anonymous", "competition", "academic"].includes(r.id)
                        ? "基础建议"
                        : "用户确认"}
                    </span>
                    <span>{r.category}</span>
                  </div>
                  <p>{r.description}</p>
                  <div className="rule-card-footer">
                    <FileText size={13} />
                    {r.rules.length} 项检查<span>v{r.version}</span>
                  </div>
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
          <Notice>
            内置规则是净稿自研的基础检查建议。导入赛事或期刊规则后，应逐条确认；不将演示名称当作官方规范。
          </Notice>
        </section>
        {selected && (
          <aside className="panel rule-detail">
            <div className="rule-detail-header">
              <span className="rule-card-icon">
                <Icon size={28} />
              </span>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.category} · {selected.source}
                </p>
              </div>
            </div>
            <p className="version-note">
              版本：v{selected.version} · {selected.updated_at.slice(0, 10)}{" "}
              更新
            </p>
            <div className="detail-tabs">
              {["概述", "适用场景", "检查项", "版本信息"].map((t) => (
                <button
                  key={t}
                  className={tab === t ? "active" : ""}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "概述" ? (
              <>
                <h3>规则概述</h3>
                <p>{selected.description}</p>
                <h3>适用场景</h3>
                <p>{selected.category} · 材料提交前自查</p>
                <h3>
                  检查项目 <small>（共 {selected.rules.length} 项）</small>
                </h3>
                <div className="rule-checks">
                  {selected.rules.map((r) => (
                    <button key={r.id} onClick={() => setTab("检查项")}>
                      <FileText size={14} />
                      {r.description}
                      <ChevronRight size={14} />
                    </button>
                  ))}
                </div>
              </>
            ) : tab === "检查项" ? (
              <div className="rule-items">
                {selected.rules.map((r) => (
                  <div key={r.id}>
                    <b>{r.description}</b>
                    <p>{r.source_clause}</p>
                    <small>
                      检测：{r.detection_method} · {r.severity} ·{" "}
                      {r.scope.join(" / ")}
                    </small>
                    <p>整改：{r.remediation}</p>
                  </div>
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
            <Link
              className="button primary use-rule"
              to={"/new?rule=" + selected.id}
            >
              使用该规则
              <ChevronRight size={16} />
            </Link>
          </aside>
        )}
      </div>
      {modal && (
        <Dialog
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
          ) : (
            draft && (
              <div className="form-stack">
                <Notice>{draft.notice}</Notice>
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
                      <div className="draft-controls">
                        <select
                          aria-label={`条款 ${i + 1} 检测方式`}
                          value={r.detection_method}
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
                            : "格式条款"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {draft.warnings?.map((w) => (
                  <p className="muted" key={w}>
                    {w}
                  </p>
                ))}
                <button
                  className="button primary"
                  disabled={!name.trim() || save.isPending}
                  onClick={() =>
                    save.mutate({
                      name,
                      source: draft.source,
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
        </Dialog>
      )}
    </>
  );
}
