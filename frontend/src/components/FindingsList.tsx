import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, MapPin } from "lucide-react";
import type { Finding } from "../types";
import { StatusIcon, StatusBadge } from "./ui";
export function FindingsList({
  findings,
  onSelect,
  selected,
  compact = false,
}: {
  findings: Finding[];
  onSelect: (f: Finding) => void;
  selected?: Finding;
  compact?: boolean;
}) {
  return (
    <div className={"findings-list " + (compact ? "compact" : "")}>
      <AnimatePresence initial={false}>
        {findings.map((f) => (
          <motion.button
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            key={f.id}
            className={
              "finding-row " + (selected?.id === f.id ? "selected" : "")
            }
            onClick={() => onSelect(f)}
          >
            <StatusIcon status={f.status} />
            <div>
              <div className="finding-title">
                <b>{f.title}</b>
                <StatusBadge status={f.status} />
              </div>
              <p className={"finding-excerpt " + f.status.toLowerCase()}>
                {f.evidence}
              </p>
              <div className="finding-location">
                <MapPin size={11} />
                {f.location}
              </div>
              {!compact && (
                <small className="finding-suggestion">{f.suggestion}</small>
              )}
              {f.resolution && (
                <span className="decision-tag">
                  {f.resolution.decision === "fixed"
                    ? "已记录整改，待复检"
                    : f.resolution.decision === "dismissed"
                      ? "已记录非问题"
                      : "已确认问题"}
                </span>
              )}
            </div>
            <ChevronRight size={14} />
          </motion.button>
        ))}
      </AnimatePresence>
      {!findings.length && (
        <p className="list-empty">当前筛选下暂无检测结果。</p>
      )}
    </div>
  );
}
