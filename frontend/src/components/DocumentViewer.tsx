import { useCallback, useEffect, useRef, useState } from "react";
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
import { ContinuousPDF } from "./ContinuousPDF";
function PDFThumbnail({
  pdf,
  pageNumber,
}: {
  pdf: pdfjs.PDFDocumentProxy;
  pageNumber: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canvas.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
        } else {
          setVisible(false);
        }
      },
      { root: canvas.current.closest(".pdf-thumbnails"), rootMargin: "250px" },
    );
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!canvas.current) return;
    if (!visible) {
      canvas.current.width = 1;
      canvas.current.height = 1;
      return;
    }
    let alive = true;
    let render: pdfjs.RenderTask | undefined;
    void pdf
      .getPage(pageNumber)
      .then((page) => {
        if (!alive || !canvas.current) return;
        const viewport = page.getViewport({
          scale:
            (72 / page.getViewport({ scale: 1 }).width) *
            (window.devicePixelRatio || 1),
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = page.render({
          canvasContext: canvas.current.getContext("2d")!,
          viewport,
        });
        return render.promise;
      })
      .catch((error) => {
        if (alive && error?.name !== "RenderingCancelledException")
          setFailed(true);
      });
    return () => {
      alive = false;
      render?.cancel();
    };
  }, [pdf, pageNumber, visible]);
  return (
    <>
      <canvas ref={canvas} aria-label={`第 ${pageNumber} 页缩略图`} />
      {failed && <small>预览失败</small>}
    </>
  );
}
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
  compact = false,
}: {
  document?: Document;
  finding?: Finding;
  findings?: Finding[];
  scanning?: boolean;
  locateVersion?: number;
  compact?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(430);
  const [zoom, setZoom] = useState(1);
  const [jump, setJump] = useState({ page: 1, version: 0 });
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const thumbnails = useRef<HTMLElement>(null);
  function goTo(number: number) {
    setJump((current) => ({ page: number, version: current.version + 1 }));
  }
  const docx = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const attachScroll = useCallback((node: HTMLDivElement | null) => {
    scroll.current = node;
    setScrollRoot(node);
  }, []);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(
        Math.max(
          160,
          entry.contentRect.width -
            (doc?.format === "pdf" && !compact ? 112 : 38),
        ),
      ),
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [doc?.format, compact]);
  useEffect(() => {
    setPage(1);
    setJump({ page: 1, version: 0 });
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
    const current = thumbnails.current?.querySelector(`[aria-current="page"]`);
    if (current) scrollWithin(thumbnails.current, current);
  }, [page]);
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
    if (doc.format !== "pdf" && finding.bbox && scroll.current) {
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
  return (
    <section
      ref={host}
      className={
        "viewer panel" +
        (compact ? " compact-viewer" : "") +
        (scanning ? " scanning-viewer" : "")
      }
    >
      <div className="viewer-toolbar">
        <FileIcon format={doc.format} />
        <b title={doc.name}>{doc.name}</b>
        {visual && (
          <div className="page-controls">
            <button
              className="icon-button"
              aria-label="上一页"
              disabled={page <= 1}
              onClick={() => goTo(page - 1)}
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
              onClick={() => goTo(page + 1)}
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
      <div className="viewer-body">
        {visual && pdf && !compact && (
          <nav
            ref={thumbnails}
            className="pdf-thumbnails"
            aria-label="文档页面"
          >
            {Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(
              (number) => (
                <button
                  type="button"
                  className={
                    "pdf-thumbnail " + (page === number ? "selected" : "")
                  }
                  key={number}
                  aria-label={`跳到第 ${number} 页`}
                  aria-current={page === number ? "page" : undefined}
                  onClick={() => goTo(number)}
                >
                  <PDFThumbnail pdf={pdf} pageNumber={number} />
                  <span>{number}</span>
                </button>
              ),
            )}
          </nav>
        )}
        <div className="viewer-scroll" ref={attachScroll}>
          {error && <Notice error>{error}</Notice>}
          {visual ? (
            pdf && scrollRoot ? (
              <ContinuousPDF
                pdf={pdf}
                root={scrollRoot}
                width={width * zoom}
                finding={finding}
                findings={findings}
                locateVersion={locateVersion}
                jump={jump}
                onPage={setPage}
              />
            ) : (
              <div className="viewer-loading">
                {!error && "正在读取真实 PDF…"}
              </div>
            )
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
