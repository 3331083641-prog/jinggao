import { useQuery } from "@tanstack/react-query";
import type { Run, Task, RuleSet } from "./types";
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch("/api" + path, options);
  if (!r.ok) {
    let message = "服务暂时不可用";
    try {
      const e = await r.json();
      message =
        typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail);
    } catch {}
    throw new Error(message);
  }
  return r.json();
}
export const useRules = () =>
  useQuery({ queryKey: ["rules"], queryFn: () => api<RuleSet[]>("/rulesets") });
export const useTasks = () =>
  useQuery({
    queryKey: ["tasks"],
    queryFn: () => api<Task[]>("/tasks"),
    refetchInterval: 5000,
  });
export const useRun = (id?: string) =>
  useQuery({
    queryKey: ["run", id],
    queryFn: () => api<Run>("/runs/" + id),
    enabled: !!id,
    refetchInterval: (q) =>
      ["RUNNING", "QUEUED"].includes(q.state.data?.state || "") ? 700 : false,
  });
export const date = (s?: string) =>
  s
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(s))
    : "—";
export const bytes = (n: number) =>
  n > 1024 * 1024
    ? (n / 1024 / 1024).toFixed(1) + " MB"
    : (n / 1024).toFixed(1) + " KB";
export const reportUrl = (id: string) => "/api/runs/" + id + "/report.pdf";
