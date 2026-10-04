import { useEffect, useRef, useState } from "react";
import type * as pdfjs from "pdfjs-dist";
import type { Finding } from "../types";

type PageSize = { width: number; height: number };
function LazyPage({
  pdf,
  number,
  width,
  size,
  root,
  findings,
  selected,
  pulse,
}: {
  pdf: pdfjs.PDFDocumentProxy;
  number: number;
  width: number;
  size: PageSize;
  root: HTMLDivElement;
  findings: Finding[];
  selected?: Finding;
  pulse: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { root, rootMargin: `${root.clientHeight * 2}px 0px` },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [root]);
  useEffect(() => {
    if (!visible || !canvas.current) return;
    let alive = true;
    let rendering: pdfjs.RenderTask | undefined;
    const node = canvas.current;
    void pdf
      .getPage(number)
      .then((page) => {
        if (!alive) return;
        const viewport = page.getViewport({
          scale:
            (width / size.width) * Math.min(window.devicePixelRatio || 1, 1.5),
        });
        node.width = viewport.width;
        node.height = viewport.height;
        rendering = page.render({
          canvasContext: node.getContext("2d")!,
          viewport,
        });
        return rendering.promise.then(() => {
          if (alive) node.dataset.rendered = String(number);
        });
      })
      .catch((error) => {
        if (alive && error?.name !== "RenderingCancelledException")
          setError(true);
      });
    return () => {
      alive = false;
      rendering?.cancel();
    };
  }, [pdf, number, visible, width, size.width]);
  return (
    <div
      ref={host}
      className="pdf-paper continuous-page"
      data-page={number}
      style={{ width, height: (width * size.height) / size.width }}
    >
      {visible ? (
        <canvas ref={canvas} aria-label={`PDF 第 ${number} 页`} />
      ) : (
        <span className="page-placeholder">第 {number} 页</span>
      )}
      {error && (
        <span className="page-placeholder">第 {number} 页预览失败</span>
      )}
      {visible &&
        findings.map((f) => (
          <div
            key={`${f.id}-${f.id === selected?.id ? pulse : 0}`}
            data-selected={f.id === selected?.id}
            className={`evidence-highlight ${f.status.toLowerCase()} ${f.id === selected?.id ? "locate-pulse selected" : ""}`}
            title={f.evidence}
            style={{
              left: (f.bbox![0] / size.width) * 100 + "%",
              top: (f.bbox![1] / size.height) * 100 + "%",
              width: ((f.bbox![2] - f.bbox![0]) / size.width) * 100 + "%",
              height: ((f.bbox![3] - f.bbox![1]) / size.height) * 100 + "%",
            }}
          />
        ))}
    </div>
  );
}

export function ContinuousPDF({
  pdf,
  root,
  width,
  finding,
  findings,
  locateVersion,
  jump,
  onPage,
}: {
  pdf: pdfjs.PDFDocumentProxy;
  root: HTMLDivElement;
  width: number;
  finding?: Finding;
  findings: Finding[];
  locateVersion: number;
  jump: { page: number; version: number };
  onPage: (page: number) => void;
}) {
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      // Page metadata is cheap; canvases are created only near the viewport.
      const first = await pdf.getPage(1);
      const base = first.getViewport({ scale: 1 });
      const measured = Array.from({ length: pdf.numPages }, () => ({
        width: base.width,
        height: base.height,
      }));
      if (alive) setSizes([...measured]);
      for (let start = 1; start < pdf.numPages && alive; start += 8) {
        await Promise.all(
          measured.slice(start, start + 8).map(async (_, index) => {
            const page = await pdf.getPage(start + index + 1);
            const viewport = page.getViewport({ scale: 1 });
            measured[start + index] = {
              width: viewport.width,
              height: viewport.height,
            };
          }),
        );
      }
      if (alive) setSizes(measured);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pdf]);
  useEffect(() => {
    if (!host.current || !sizes.length) return;
    let frame = 0;
    const measure = () => {
      const viewport = root.getBoundingClientRect();
      let best = 0,
        page = 1;
      host.current
        ?.querySelectorAll<HTMLElement>("[data-page]")
        .forEach((node) => {
          const rect = node.getBoundingClientRect();
          const visible = Math.max(
            0,
            Math.min(rect.bottom, viewport.bottom) -
              Math.max(rect.top, viewport.top),
          );
          if (visible > best) {
            best = visible;
            page = Number(node.dataset.page);
          }
        });
      if (best) onPage(page);
      frame = 0;
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    root.addEventListener("scroll", scroll, { passive: true });
    const resize = new ResizeObserver(scroll);
    resize.observe(root);
    measure();
    return () => {
      root.removeEventListener("scroll", scroll);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [root, sizes, onPage]);
  function locate(page: number, bbox?: number[]) {
    const node = host.current?.querySelector<HTMLElement>(
      `[data-page="${page}"]`,
    );
    if (!node) return;
    const top =
      root.scrollTop +
      node.getBoundingClientRect().top -
      root.getBoundingClientRect().top;
    const offset = bbox
      ? (bbox[1] / sizes[page - 1].height) * node.clientHeight -
        root.clientHeight / 3
      : 0;
    root.scrollTo({
      top: Math.max(0, top + offset),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    if (jump.version) locate(jump.page);
  }, [jump, sizes.length]);
  useEffect(() => {
    if (finding?.page) locate(finding.page, finding.bbox || undefined);
  }, [finding?.id, locateVersion, sizes.length]);
  return (
    <div ref={host} className="continuous-pdf">
      {sizes.map((size, index) => (
        <LazyPage
          key={index}
          pdf={pdf}
          number={index + 1}
          width={width}
          size={size}
          root={root}
          findings={findings.filter(
            (f) =>
              f.page === index + 1 &&
              f.bbox &&
              f.surface_id &&
              f.status !== "PASS",
          )}
          selected={finding}
          pulse={locateVersion}
        />
      ))}
    </div>
  );
}
