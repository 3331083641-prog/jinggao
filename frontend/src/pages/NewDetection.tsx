import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  UploadCloud,
  ArrowRight,
  GraduationCap,
  Trophy,
  FileText,
  SlidersHorizontal,
  X,
  Check,
  Image,
  EyeOff,
  ListChecks,
  IdCard,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHero, FileIcon, Notice } from "../components/ui";
import { FilePicker, validateFile } from "../components/FilePicker";
import { useRules, api, bytes } from "../api";
import type { Run, Task } from "../types";
const scopes = [
  ["body", "正文内容", FileText],
  ["metadata", "文档属性", IdCard],
  ["hidden", "隐藏内容", EyeOff],
  ["images", "图片/OCR", Image],
] as const;
export function NewDetection() {
  const { data: rules } = useRules();
  const [params] = useSearchParams();
  const [ruleId, setRuleId] = useState(params.get("rule") || "anonymous");
  const [customRuleIds, setCustomRuleIds] = useState<string[]>(
    params.get("rule") &&
      !["anonymous", "competition", "academic"].includes(params.get("rule")!)
      ? [params.get("rule")!]
      : [],
  );
  const [ruleChosen, setRuleChosen] = useState(!!params.get("rule"));
  const [selected, setSelected] = useState([
    "body",
    "metadata",
    "hidden",
    "images",
  ]);
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(0);
  const nav = useNavigate();
  const qc = useQueryClient();
  const taskId = params.get("task");
  const { data: originalTask } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api<Task>("/tasks/" + taskId),
    enabled: !!taskId,
  });
  function processFiles(incoming: File[]) {
    if (!incoming.length) return;
    if (taskId && incoming.length > 1) {
      setError("复检请一次选择一份整改材料。");
      return;
    }
    const valid: File[] = [];
    const problems: string[] = [];
    for (const file of incoming) {
      const problem = validateFile(file, ["pdf", "docx", "pptx", "txt", "md"]);
      if (problem) problems.push(file.name + "：" + problem);
      else valid.push(file);
    }
    if (valid.length)
      setFiles((current) =>
        taskId
          ? [valid[0]]
          : [
              ...current.filter(
                (f) =>
                  !valid.some(
                    (v) =>
                      v.name === f.name &&
                      v.size === f.size &&
                      v.lastModified === f.lastModified,
                  ),
              ),
              ...valid,
            ],
      );
    setError(problems.join(" "));
  }
  const start = useMutation({
    mutationFn: async () => {
      if (!files.length) throw Error("请先选择材料");
      if (!selected.length) throw Error("请至少启用一个检测范围");
      if (customMode && !chosenRules.length) throw Error("请至少选择一份规则");
      setSubmitted(0);
      const runs: Run[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        if (customMode) {
          customRuleIds.forEach((id) => form.append("ruleset_ids", id));
        } else form.append("ruleset_id", ruleId);
        form.append("scopes", selected.join(","));
        if (taskId) form.append("task_id", taskId);
        runs.push(await api<Run>("/generate", { method: "POST", body: form }));
        setSubmitted(runs.length);
      }
      return runs;
    },
    onSuccess: (runs) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      nav("/scan/" + runs[0].id);
    },
    onError: (e) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setError(e.message);
    },
  });
  const historicalRule = originalTask?.runs?.find(
    (run) => run.ruleset_id === ruleId,
  )?.ruleset_snapshot;
  const actualRule = rules?.find((r) => r.id === ruleId) || historicalRule;
  const customRules =
    rules?.filter(
      (r) => !["anonymous", "competition", "academic"].includes(r.id),
    ) || [];
  const usingDeletedRule =
    !!historicalRule && !!rules && !rules.some((rule) => rule.id === ruleId);
  if (usingDeletedRule) customRules.push(historicalRule);
  const customMode = !["anonymous", "competition", "academic"].includes(ruleId);
  const chosenRules = customMode
    ? customRules.filter((rule) => customRuleIds.includes(rule.id))
    : actualRule
      ? [actualRule]
      : [];
  const capabilities = [
    ...new Set(
      chosenRules
        .flatMap((rule) => rule.rules)
        .map((r) => (r.category === "身份泄露" ? "身份信息" : r.category)) ||
        [],
    ),
  ].join(" · ");
  const step = start.isPending ? 2 : files.length ? (ruleChosen ? 2 : 1) : 0;
  return (
    <>
      <PageHero
        title={taskId ? "发起复检" : "新建检测"}
        subtitle={
          taskId
            ? "上传整改材料，保留旧结果并比较。"
            : "上传材料，选择规则，然后开始检查。"
        }
      />
      <div className="steps" aria-label="检测步骤">
        {["上传材料", "选择规则", "开始检测"].map((name, i) => (
          <div
            key={name}
            className={i < step ? "done" : i === step ? "current" : ""}
          >
            <motion.span
              animate={{
                backgroundColor:
                  i < step ? "#c3a47d" : i === step ? "#1d2d3f" : "#f0f0f1",
                color: i <= step ? "#ffffff" : "#687586",
              }}
              transition={{ duration: 0.24 }}
            >
              {i < step ? <Check size={22} /> : i + 1}
            </motion.span>
            <b>{name}</b>
            {i < 2 && <i />}
          </div>
        ))}
      </div>
      <div className="new-grid">
        <section className="upload-panel">
          <h2>上传材料</h2>
          <FilePicker
            label="选择文件"
            accept=".pdf,.docx,.pptx,.txt,.md"
            multiple={!taskId}
            onFiles={processFiles}
            className={"dropzone " + (drag ? "drag" : "")}
            disabled={start.isPending}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!start.isPending)
                processFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <UploadCloud size={48} strokeWidth={1.5} />
            <h3>点击上传或拖拽文件到此处</h3>
            <p>支持 PDF / DOCX / PPTX / TXT / MD</p>
            <span className="button primary file-picker-button">
              <FileText size={18} />
              选择文件
            </span>
          </FilePicker>
          {files.length > 0 && (
            <h3 className="selected-files-heading">
              已选择材料 <span>（{files.length}）</span>
            </h3>
          )}
          <AnimatePresence initial={false}>
            {files.map((file, i) => (
              <motion.div
                className="selected-file"
                key={file.name + file.size + file.lastModified}
                initial={{ opacity: 0, y: 4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{
                  opacity: 0,
                  height: 0,
                  margin: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
                transition={{ duration: 0.2 }}
              >
                <FileIcon format={file.name.split(".").pop()} />
                <div>
                  <b>{file.name}</b>
                  <small>{bytes(file.size)}</small>
                </div>
                <button
                  type="button"
                  disabled={start.isPending}
                  className="icon-button"
                  aria-label={
                    files.length === 1 ? "移除材料" : "移除材料 " + file.name
                  }
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((_, index) => index !== i),
                    )
                  }
                >
                  <X size={18} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </section>
        <section className="configuration">
          <h2>选择检查规则</h2>
          <div className="rule-template-grid" aria-label="规则模板">
            {(
              [
                ["anonymous", "匿名评审", GraduationCap, "检查身份与隐私残留"],
                ["competition", "竞赛提交", Trophy, "检查文档残留与可读性"],
                ["academic", "学术投稿", FileText, "检查匿名投稿材料"],
              ] as const
            ).map(([id, name, Icon, description]) => (
              <button
                type="button"
                key={id}
                title={description}
                aria-pressed={ruleId === id}
                className={"rule-template " + (ruleId === id ? "selected" : "")}
                onClick={() => {
                  setRuleId(id);
                  setCustomRuleIds([]);
                  setRuleChosen(true);
                }}
              >
                <span className="rule-template-icon">
                  <Icon size={25} />
                </span>
                <b>{name}</b>
                {ruleId === id && (
                  <>
                    <span className="rule-template-check">
                      <Check size={15} />
                    </span>
                    <small className="rule-template-description">
                      {description}
                    </small>
                  </>
                )}
              </button>
            ))}
            {customRules.length ? (
              <button
                type="button"
                className={"rule-template " + (customMode ? "selected" : "")}
                onClick={() => {
                  if (!customMode) setRuleId("custom");
                  if (!customRuleIds.length)
                    setCustomRuleIds([customRules[0].id]);
                  setRuleChosen(true);
                }}
              >
                <span className="rule-template-icon">
                  <SlidersHorizontal size={25} />
                </span>
                <b>自定义规则</b>
                {customMode && (
                  <span className="rule-choice-check">
                    <Check size={14} />
                  </span>
                )}
              </button>
            ) : (
              <Link
                className={
                  "rule-template " +
                  (customRules.some((r) => r.id === ruleId) ? "selected" : "")
                }
                to="/rules"
              >
                <span className="rule-template-icon">
                  <SlidersHorizontal size={25} />
                </span>
                <b>自定义规则</b>
              </Link>
            )}
          </div>
          {customMode && (
            <fieldset className="custom-rule-options">
              <legend>
                自定义规则 · 可多选（已选 {customRuleIds.length} 份）
              </legend>
              <div className="custom-rule-list">
                {customRules.map((rule) => (
                  <label key={rule.id}>
                    <input
                      type="checkbox"
                      checked={customRuleIds.includes(rule.id)}
                      disabled={
                        start.isPending ||
                        (!customRuleIds.includes(rule.id) &&
                          customRuleIds.length >= 10)
                      }
                      onChange={() => {
                        setCustomRuleIds((current) =>
                          current.includes(rule.id)
                            ? current.filter((id) => id !== rule.id)
                            : [...current, rule.id],
                        );
                        setRuleChosen(true);
                      }}
                    />
                    <span>{rule.name}</span>
                    <small>{rule.rules.length} 项</small>
                  </label>
                ))}
              </div>
              <Link className="text-link" to="/rules">
                导入更多规则文件
              </Link>
            </fieldset>
          )}
          {usingDeletedRule && (
            <p className="muted">
              {historicalRule?.members
                ? "本次复检使用已保存的联合规则快照。"
                : "该规则已从规则库删除，本次复检使用历史快照。"}
            </p>
          )}
          <h3 className="scope-heading">检测范围</h3>
          <div className="scope-grid">
            {scopes.map(([id, name, Icon]) => (
              <label key={id}>
                <span className="scope-toggle">
                  <input
                    type="checkbox"
                    checked={selected.includes(id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(id)
                          ? current.filter((x) => x !== id)
                          : [...current, id],
                      )
                    }
                  />
                </span>
                <Icon size={17} />
                {name}
              </label>
            ))}
          </div>
          <p className="capabilities-inline">
            <ListChecks size={20} />
            将检查：{capabilities || "按所选规则检查"}
          </p>
          <div className="start-row">
            <button
              type="button"
              className="button primary"
              disabled={
                !files.length ||
                start.isPending ||
                !chosenRules.length ||
                (customMode && chosenRules.length !== customRuleIds.length) ||
                !selected.length
              }
              onClick={() => start.mutate()}
            >
              {start.isPending
                ? `正在上传 ${submitted}/${files.length}…`
                : "开始检测"}
              <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </div>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
