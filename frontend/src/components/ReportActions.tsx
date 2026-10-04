import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { MoreHorizontal, Download, RefreshCw, Trash2 } from "lucide-react";
import { reportUrl } from "../api";
import type { Run } from "../types";

export function ReportActions({
  run,
  onDelete,
}: {
  run: Run;
  onDelete: (run: Run) => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!position) return;
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    const dismiss = (event: PointerEvent) => {
      if (
        !menu.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setPosition(undefined);
    };
    const resize = () => setPosition(undefined);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize, true);
    };
  }, [position]);
  function close() {
    setPosition(undefined);
    trigger.current?.focus();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="icon-button"
        aria-label={"更多报告操作 " + run.document_name}
        aria-haspopup="menu"
        aria-expanded={!!position}
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          setPosition(
            position
              ? undefined
              : {
                  top: Math.max(
                    8,
                    Math.min(rect.bottom + 8, window.innerHeight - 176),
                  ),
                  left: Math.max(
                    8,
                    Math.min(rect.right - 176, window.innerWidth - 184),
                  ),
                },
          );
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {position &&
        createPortal(
          <div
            ref={menu}
            className="action-menu"
            role="menu"
            aria-label="报告操作"
            style={{ top: position.top, left: position.left }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              const items = Array.from(
                menu.current?.querySelectorAll<HTMLElement>(
                  "[role=menuitem]",
                ) || [],
              );
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const current = items.indexOf(
                  document.activeElement as HTMLElement,
                );
                const index =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : (current +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length;
                items[index]?.focus();
              }
              if (event.key === "Tab") setPosition(undefined);
            }}
          >
            <a
              role="menuitem"
              href={reportUrl(run.id)}
              download
              onClick={close}
            >
              <Download size={16} />
              导出报告
            </a>
            <Link
              role="menuitem"
              to={`/new?task=${run.task_id}&rule=${run.ruleset_id}`}
              onClick={close}
            >
              <RefreshCw size={16} />
              发起复检
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onDelete(run);
              }}
            >
              <Trash2 size={16} />
              删除报告
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
