import type { ReactNode } from "react";
import { Check, X, AlertCircle, FileText, ShieldCheck } from "lucide-react";
import type { Status, Run } from "../types";
import { HeroDocumentScene } from "./HeroDocumentScene";
export function StatusBadge({ status }: { status: Status }) {
  const I = status === "PASS" ? Check : status === "FAIL" ? X : AlertCircle;
  return (
    <span className={"status " + status.toLowerCase()} title={status}>
      <I size={14} />
      {status === "PASS"
        ? "合规"
        : status === "FAIL"
          ? "不合规"
          : status === "REVIEW"
            ? "需确认"
            : "未验证"}{" "}
      <small>{status}</small>
    </span>
  );
}
export function StatusIcon({ status }: { status: Status }) {
  const I = status === "PASS" ? Check : status === "FAIL" ? X : AlertCircle;
  return (
    <span className={"status-icon " + status.toLowerCase()}>
      <I size={17} />
    </span>
  );
}
export function FileIcon({ format = "pdf" }: { format?: string }) {
  return (
    <span className={"file-icon " + format.toLowerCase()}>
      <FileText size={18} />
      <small>{format.toUpperCase()}</small>
    </span>
  );
}
export function PageHero({
  title,
  subtitle,
  children,
  home = false,
  className = "",
  visual,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
  home?: boolean;
  className?: string;
  visual?: ReactNode;
}) {
  return (
    <section className={"page-hero " + (home ? "home-hero " : "") + className}>
      {visual ?? <HeroDocumentScene compact={!home} />}
      <div className="hero-copy">
        <h1>{title}</h1>
        <p className="hero-subtitle">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}
export function WorkHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="work-heading">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}
export function Empty({
  title = "还没有检测任务",
  text = "上传一份真实材料，开始提交前的合规检查。",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={30} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div className={"notice " + (error ? "notice-error" : "")}>
      <ShieldCheck size={19} />
      <div>{children}</div>
    </div>
  );
}
export function RiskSummary({
  run,
  wide = false,
  onSelect,
}: {
  run: Run;
  wide?: boolean;
  onSelect?: (s: Status) => void;
}) {
  return (
    <div className={"risk-summary " + (wide ? "wide" : "")}>
      {(["FAIL", "REVIEW", "PASS"] as const).map((status) => {
        const content = (
          <>
            <StatusIcon status={status} />
            <strong>{run.counts[status]}</strong>
            <span>
              {status === "FAIL"
                ? "不合规"
                : status === "REVIEW"
                  ? "需确认"
                  : "合规"}
              <small>{status}</small>
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={status}
            type="button"
            className={"risk-item " + status.toLowerCase()}
            onClick={() => onSelect(status)}
          >
            {content}
          </button>
        ) : (
          <div key={status} className={"risk-item " + status.toLowerCase()}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
