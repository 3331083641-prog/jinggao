import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Maximize2,
  FileSearch,
} from "lucide-react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { renderAsync } from "docx-preview";
import type { Document, Finding } from "../types";
import { FileIcon, Notice } from "./ui";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const hiddenSources = [
  "METADATA",
  "COMMENT",
  "REVISION",
  "HIDDEN_TEXT",
  "HYPERLINK",
  "EMBEDDED_OBJECT",
];
function scrollWithin(container: HTMLElement | null, element: Element) {
  if (!container) return;
  const c = container.getBoundingClientRect(),
    e = element.getBoundingClientRect();
  const top =
    container.scrollTop +
    e.top -
    c.top -
    container.clientHeight / 2 +
    e.height / 2;
  const left =
    container.scrollLeft +
    e.left -
    c.left -
    container.clientWidth / 2 +
    e.width / 2;
  container.scrollTo({
    top: Math.max(0, top),
    left: Math.max(0, left),
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
export function DocumentViewer({
  document: doc,
  finding,
  findings = [],
  scanning = false,
  locateVersion = 0,
}: {
  document?: Document;
  finding?: Finding;
  findings?: Finding[];
  scanning?: boolean;
  locateVersion?: number;
}) {
  const [page, setPage] = useState(1);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(430);
  const [zoom, setZoom] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 595, height: 842 });
  const canvas = useRef<HTMLCanvasElement>(null);
  const docx = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(220, entry.contentRect.width - 38)),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPage(1);
    setError("");
    setReady(false);
    setPdf(null);
    if (!doc) return;
    let alive = true;
    let loading: pdfjs.PDFDocumentLoadingTask | undefined;
    if (doc.format === "pdf") {
      loading = pdfjs.getDocument({
        url: "/api/documents/" + doc.id + "/file",
        cMapUrl: "/pdf-cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdf-fonts/",
      });
      loading.promise
        .then((p) => {
          if (alive) {
            setPdf(p);
            setReady(true);
          }
        })
        .catch(
          () => alive && setError("PDF 预览失败，请通过下方真实表层查看证据。"),
        );
    } else if (doc.format === "docx" && docx.current) {
      const node = docx.current;
      node.innerHTML = "";
      fetch("/api/documents/" + doc.id + "/file")
        .then((r) => r.arrayBuffer())
        .then(
          (data) =>
            alive &&
            renderAsync(data, node, undefined, {
              inWrapper: true,
              ignoreWidth: true,
              ignoreHeight: false,
              ignoreFonts: true,
              breakPages: true,
              useBase64URL: true,
            }),
        )
        .then(() => {
          if (alive) setReady(true);
        })
        .catch(
          () =>
            alive && setError("DOCX 版式预览失败，仍可查看已解析的真实表层。"),
        );
    } else setReady(true);
    return () => {
      alive = false;
      // PDF.js can throw inside its worker if Terminate races initial parsing.
      // Finish the local load before releasing the disposed viewer's worker.
      if (loading) {
        const disposed = loading;
        const release = () => disposed.destroy().catch(() => undefined);
        void disposed.promise.then(release, release);
      }
    };
  }, [doc?.id]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    delete canvas.current.dataset.rendered;
    let cancelled = false;
    let rendering: pdfjs.RenderTask | undefined;
    pdf
      .getPage(page)
      .then((p) => {
        if (cancelled || !canvas.current) return;
        const base = p.getViewport({ scale: 1 });
        setDimensions({ width: base.width, height: base.height });
        const scale = (width / base.width) * zoom;
        const ratio = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * ratio });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        canvas.current.style.width = base.width * scale + "px";
        canvas.current.style.height = base.height * scale + "px";
        rendering = p.render({
          canvasContext: canvas.current.getContext("2d")!,
          viewport,
        });
        return rendering.promise.then(() => {
          if (!cancelled && canvas.current)
            canvas.current.dataset.rendered = String(page);
        });
      })
      .catch((e) => {
        if (!cancelled && e?.name !== "RenderingCancelledException")
          setError("PDF 页面渲染失败。");
      });
    return () => {
      cancelled = true;
      rendering?.cancel();
    };
  }, [pdf, page, width, zoom]);
  useEffect(() => {
    if (finding?.page) setPage(finding.page);
  }, [finding?.id, locateVersion]);
  useEffect(() => {
    if (!finding || !ready || !doc) return;
    const highlighted = docx.current?.querySelector("mark");
    if (highlighted)
      highlighted.replaceWith(...Array.from(highlighted.childNodes));
    if (
      doc.format === "docx" &&
      docx.current &&
      finding.evidence &&
      finding.surface_id &&
      !hiddenSources.includes(finding.source_type)
    ) {
      const walk = globalThis.document.createTreeWalker(
        docx.current,
        NodeFilter.SHOW_TEXT,
      );
      let node;
      while ((node = walk.nextNode())) {
        const index = node.textContent?.indexOf(finding.evidence) ?? -1;
        if (index >= 0) {
          const range = globalThis.document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + finding.evidence.length);
          const mark = globalThis.document.createElement("mark");
          mark.className = "locate-pulse";
          range.surroundContents(mark);
          scrollWithin(scroll.current, mark);
          break;
        }
      }
    }
    if (finding.bbox && scroll.current) {
      const el = scroll.current.querySelector('[data-selected="true"]');
      if (el) scrollWithin(scroll.current, el);
    }
  }, [finding?.id, locateVersion, page, ready, doc?.id]);
  if (!doc)
    return (
      <div className="viewer panel">
        <div className="viewer-wait">
          <FileSearch size={40} />
          <p>上传后将在这里显示真实文档。</p>
        </div>
      </div>
    );
  const activeSurface = doc.parsed?.surfaces.find(
    (s) => s.id === finding?.surface_id,
  );
  const visual = doc.format === "pdf";
  const pageFindings = findings.filter(
    (f) => f.page === page && f.bbox && f.surface_id && f.status !== "PASS",
  );
  const overlays = [
    ...pageFindings.filter((f) => f.id !== finding?.id).slice(0, 25),
    ...(finding?.bbox && finding.page === page ? [finding] : []),
  ];
  return (
    <section ref={host} className="viewer panel">
      <div className="viewer-toolbar">
        <FileIcon format={doc.format} />
        <b title={doc.name}>{doc.name}</b>
        {visual && (
          <div className="page-controls">
            <button
              className="icon-button"
              aria-label="上一页"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              {page} / {pdf?.numPages || doc.page_count || "—"}
            </span>
            <button
              className="icon-button"
              aria-label="下一页"
              disabled={!pdf || page >= pdf.numPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <button
          className="zoom-control"
          aria-label="切换缩放"
          onClick={() => setZoom((z) => (z === 1 ? 1.25 : 1))}
        >
          <Search size={15} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          className="icon-button"
          aria-label="全屏预览"
          onClick={() => host.current?.requestFullscreen()}
        >
          <Maximize2 size={15} />
        </button>
      </div>
      <div className="viewer-scroll" ref={scroll}>
        {error && <Notice error>{error}</Notice>}
        {visual ? (
          <div
            className="pdf-paper"
            style={{
              width: width * zoom,
              minHeight: (width * zoom * dimensions.height) / dimensions.width,
            }}
          >
            <canvas ref={canvas} aria-label={`PDF 第 ${page} 页`} />
            {overlays.map((f) => {
              const b = f.bbox!;
              return (
                <div
                  key={`${f.id}-${f.id === finding?.id ? locateVersion : 0}`}
                  data-selected={f.id === finding?.id}
                  className={`evidence-highlight ${f.status.toLowerCase()} ${f.id === finding?.id ? "locate-pulse selected" : ""}`}
                  title={f.evidence}
                  style={{
                    left: (b[0] / dimensions.width) * 100 + "%",
                    top: (b[1] / dimensions.height) * 100 + "%",
                    width: ((b[2] - b[0]) / dimensions.width) * 100 + "%",
                    height: ((b[3] - b[1]) / dimensions.height) * 100 + "%",
                  }}
                />
              );
            })}
            {scanning && <div className="scan-line" />}
            {!ready && !error && (
              <div className="viewer-loading">正在读取真实 PDF…</div>
            )}
          </div>
        ) : doc.format === "docx" ? (
          <div ref={docx} className="docx-container" />
        ) : (
          <div className="text-document">
            {doc.format === "pptx" && (
              <Notice>PPTX 当前提供真实文本表层预览，页码对应幻灯片。</Notice>
            )}
            {doc.parsed?.surfaces
              .filter(
                (s) =>
                  !hiddenSources.includes(s.source_type) &&
                  s.source_type !== "LOGO",
              )
              .map((s) => (
                <p
                  id={"surface-" + s.id}
                  key={s.id}
                  className={
                    s.id === finding?.surface_id
                      ? "text-highlight locate-pulse"
                      : ""
                  }
                >
                  <small>{s.location}</small>
                  {s.text}
                </p>
              ))}
          </div>
        )}
      </div>
      {activeSurface &&
        (hiddenSources.includes(activeSurface.source_type) ||
          (!finding?.bbox && doc.format !== "docx")) && (
          <div className="surface-inspector">
            <span>原始表层 · {activeSurface.source_type}</span>
            <small>{activeSurface.location}</small>
            <p>{activeSurface.text}</p>
          </div>
        )}
      {finding && !finding.surface_id && (
        <div className="surface-inspector">
          <span>此项是覆盖说明，未指定原文位置</span>
          <p>{finding.evidence}</p>
        </div>
      )}
      {!visual && (
        <div className="viewer-footnote">
          {doc.format === "docx"
            ? "DOCX 页码受排版影响；证据以真实部件 / 段落定位。"
            : "展示已解析的真实文档内容。"}
        </div>
      )}
    </section>
  );
}
