import { useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  UploadCloud,
  Check,
  ArrowRight,
  GraduationCap,
  Trophy,
  FileText,
  SlidersHorizontal,
  X,
  LockKeyhole,
  UserRound,
  EyeOff,
  Image,
  Copyright,
  ListChecks,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHero, FileIcon, Notice } from "../components/ui";
import { useRules, api, bytes } from "../api";
import type { Run } from "../types";
const scopes = [
  ["body", "正文内容", "正文、页眉、页脚与链接"],
  ["metadata", "文档属性", "作者、单位与创建信息"],
  ["hidden", "隐藏内容", "批注、修订与隐藏结构"],
  ["images", "图片 / OCR", "图片与扫描件中的文字"],
] as const;
export function NewDetection() {
  const { data: rules } = useRules();
  const [params] = useSearchParams();
  const [ruleId, setRuleId] = useState(params.get("rule") || "anonymous");
  const [selected, setSelected] = useState([
    "body",
    "metadata",
    "hidden",
    "images",
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  const qc = useQueryClient();
  const taskId = params.get("task");
  function choose(f?: File) {
    if (!f) return;
    if (!/\.(pdf|docx|pptx|txt|md)$/i.test(f.name)) {
      setError("请选择 PDF、DOCX、PPTX、TXT 或 MD 文件。");
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setError("首版单文件上限 50 MB。");
      return;
    }
    setFile(f);
    setError("");
  }
  const start = useMutation({
    mutationFn: async () => {
      if (!file) throw Error("请先选择材料");
      if (!selected.length) throw Error("请至少启用一个检测范围");
      const form = new FormData();
      form.append("file", file);
      form.append("ruleset_id", ruleId);
      form.append("scopes", selected.join(","));
      if (taskId) form.append("task_id", taskId);
      return api<Run>("/generate", { method: "POST", body: form });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      nav("/scan/" + r.id);
    },
    onError: (e) => setError(e.message),
  });
  const actualRule = rules?.find((r) => r.id === ruleId);
  return (
    <>
      <PageHero
        title={taskId ? "发起复检" : "新建检测"}
        subtitle={
          taskId
            ? "上传整改后的材料，保留旧结果并进行真实对比。"
            : "上传材料并配置检测规则，系统将进行多层文档合规检查。"
        }
      />
      <div className="steps panel">
        {[
          ["1", "上传材料", "选择待检测的文档"],
          ["2", "选择规则", "配置检测范围与规则"],
          ["3", "开始检测", "生成可追溯的检查证据"],
        ].map(([n, t, d], i) => (
          <div
            key={n}
            className={(i == 0 && !file) || (i == 1 && file) ? "current" : ""}
          >
            <span>{n}</span>
            <div>
              <b>{t}</b>
              <small>{d}</small>
            </div>
            {i < 2 && <i />}
          </div>
        ))}
      </div>
      <div className="new-grid">
        <section className="panel upload-panel">
          <div className="section-title">
            <div>
              <h2>上传材料</h2>
              <p>本机处理，单个文件不超过 50 MB</p>
            </div>
          </div>
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx,.pptx,.txt,.md"
            hidden
            onChange={(e) => choose(e.target.files?.[0])}
          />
          <div
            className={"dropzone " + (drag ? "drag" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={44} strokeWidth={1.35} />
            <h3>点击上传或拖拽文件到此处</h3>
            <p>支持 PDF / DOCX / PPTX / TXT / MD</p>
            <button className="button" onClick={() => input.current?.click()}>
              <FileText size={17} />
              选择文件
            </button>
            <div className="format-list">
              {["pdf", "docx", "pptx", "txt", "md"].map((x) => (
                <div key={x}>
                  <FileIcon format={x} />
                  <small>{x.toUpperCase()}</small>
                </div>
              ))}
            </div>
          </div>
          <h3 className="uploaded-title">
            已选择材料 <span>({file ? 1 : 0})</span>
          </h3>
          {file ? (
            <div className="selected-file">
              <FileIcon format={file.name.split(".").pop()} />
              <div>
                <b>{file.name}</b>
                <small>{bytes(file.size)} · 等待开始检测</small>
              </div>
              <Check size={18} className="green" />
              <button
                className="icon-button"
                aria-label="移除材料"
                onClick={() => setFile(null)}
              >
                <X size={17} />
              </button>
            </div>
          ) : (
            <p className="muted upload-hint">
              选择真实材料后，文件信息会显示在这里。
            </p>
          )}
          <Notice>
            <b>隐私优先</b>
            <p>
              材料存储在本机服务，解析与 OCR
              在本地执行。不会将完整文件发送给外部 AI。
            </p>
          </Notice>
        </section>
        <section className="panel configuration">
          <div className="section-title">
            <div>
              <h2>检测规则配置</h2>
              <p>选择适合的检查建议，以真实提交规范为准。</p>
            </div>
          </div>
          <h3>规则模板</h3>
          <div className="rule-template-grid">
            {[
              ["anonymous", "匿名评审", GraduationCap, "检查身份与隐私残留"],
              ["competition", "竞赛提交", Trophy, "检查文档残留与可读性"],
              ["academic", "学术投稿", FileText, "匿名投稿前的基础检查"],
            ].map(([id, name, I, d]) => {
              const Icon = I as typeof FileText;
              return (
                <button
                  key={String(id)}
                  className={
                    "rule-template " + (ruleId === id ? "selected" : "")
                  }
                  onClick={() => setRuleId(String(id))}
                >
                  <span className="template-icon">
                    <Icon size={24} />
                  </span>
                  {ruleId === id && (
                    <Check className="selected-check" size={14} />
                  )}
                  <b>{String(name)}</b>
                  <small>{String(d)}</small>
                </button>
              );
            })}
            <Link className="rule-template" to="/rules">
              <span className="template-icon gold">
                <SlidersHorizontal size={24} />
              </span>
              <b>自定义规则</b>
              <small>导入或定义真实规范</small>
            </Link>
          </div>
          {rules &&
            rules.filter(
              (r) => !["anonymous", "competition", "academic"].includes(r.id),
            ).length > 0 && (
              <label className="custom-select">
                或使用已确认的规则
                <select
                  value={ruleId}
                  onChange={(e) => setRuleId(e.target.value)}
                >
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          <h3 className="scope-heading">
            检测范围 <small>选择需要检查的内容范围（可多选）</small>
          </h3>
          <div className="scope-grid">
            {scopes.map(([id, name, d]) => (
              <button
                role="switch"
                aria-checked={selected.includes(id)}
                key={id}
                className="scope-item"
                onClick={() =>
                  setSelected((s) =>
                    s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
                  )
                }
              >
                <div>
                  <span
                    className={"switch " + (selected.includes(id) ? "on" : "")}
                  />
                  <b>{name}</b>
                </div>
                <small>{d}</small>
              </button>
            ))}
          </div>
          <div className="privacy-strip">
            <LockKeyhole size={20} />
            <div>
              <b>本地解析 · 最小数据暴露</b>
              <p>无法验证的图像语义、解析缺口及模糊身份，明确进入人工复核。</p>
            </div>
          </div>
          <h3>
            检测能力{" "}
            <small>
              {actualRule
                ? `${actualRule.rules.length} 条真实规则`
                : "正在读取规则"}
            </small>
          </h3>
          <div className="detector-grid">
            {[
              [UserRound, "身份信息"],
              [FileText, "元数据"],
              [Image, "OCR 识别"],
              [EyeOff, "隐藏信息"],
              [Copyright, "Logo 复核"],
              [ListChecks, "格式规范"],
            ].map(([I, t]) => {
              const Icon = I as typeof FileText;
              return (
                <div key={String(t)}>
                  <Icon size={18} />
                  <span>{String(t)}</span>
                </div>
              );
            })}
          </div>
          <p className="rule-note">
            Logo 当前进入人工复核；基础规则是净稿检查建议，不冒称官方规范。
          </p>
          <div className="start-row">
            <span>{file ? "材料已就绪" : "请先上传材料"}</span>
            <button
              className="button primary"
              onClick={() => start.mutate()}
              disabled={!file || start.isPending || !actualRule}
            >
              {start.isPending ? "正在上传…" : "开始检测"}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
