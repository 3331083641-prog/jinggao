import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Finding, Rule } from "../types";
import { StatusBadge, StatusIcon } from "./ui";
export function FindingsList({
  findings,
  onSelect,
  selected,
  compact = false,
  rules = [],
}: {
  findings: Finding[];
  onSelect: (finding: Finding) => void;
  selected?: Finding;
  compact?: boolean;
  rules?: Rule[];
}) {
  const [expandedId, setExpandedId] = useState(selected?.id);
  return (
    <div className={"findings-list " + (compact ? "compact" : "")}>
      {findings.map((f) => (
        <div
          key={f.id}
          className={
            "finding-item " + (selected?.id === f.id ? "selected" : "")
          }
        >
          <button
            type="button"
            aria-expanded={expandedId === f.id}
            className={
              "finding-row " + (selected?.id === f.id ? "selected" : "")
            }
            onClick={() => {
              setExpandedId((current) => (current === f.id ? undefined : f.id));
              onSelect(f);
            }}
          >
            <StatusIcon status={f.status} />
            <div>
              <div className="finding-title">
                <b>{f.title}</b>
                <StatusBadge status={f.status} />
                <small className="finding-page" title={f.location}>
                  {f.page ? `P.${f.page}` : f.location}
                </small>
              </div>
              <p className="finding-excerpt">{f.evidence}</p>
            </div>
            <ChevronRight size={14} />
          </button>
          <AnimatePresence initial={false}>
            {selected?.id === f.id && expandedId === f.id && (
              <motion.div
                className="finding-expanded"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <dl>
                  <dt>规则</dt>
                  <dd>
                    {rules.find((rule) => rule.id === f.rule_id)
                      ?.source_clause || "检测覆盖边界"}
                  </dd>
                  <dt>原因</dt>
                  <dd>{f.reason}</dd>
                  <dt>建议</dt>
                  <dd>{f.suggestion}</dd>
                </dl>
                <details className="disclosure">
                  <summary>检测详情</summary>
                  <p>
                    {f.detector} · {f.source_type} · 置信度{" "}
                    {Math.round(f.confidence * 100)}%
                  </p>
                </details>
                {f.resolution && (
                  <small className="decision-tag">
                    {f.resolution.decision === "pending"
                      ? "待确认，已记录依据"
                      : f.resolution.decision === "fixed"
                        ? "已记录整改，待复检"
                        : f.resolution.decision === "dismissed"
                          ? "已记录非问题"
                          : "已确认问题"}
                  </small>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
      {!findings.length && <p className="list-empty">当前筛选下暂无结果。</p>}
    </div>
  );
}
