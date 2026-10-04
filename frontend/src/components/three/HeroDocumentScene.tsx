import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { HeroDocumentScene as SVGScene } from "../HeroDocumentScene";
import type { HeroSceneProps } from "./heroSceneConfig";
import { heroSceneConfig } from "./heroSceneConfig";
import "./hero.css";
const HeroCanvas = lazy(() => import("./HeroCanvas"));

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
export function HeroDocumentScene({
  active = false,
  rulesActive = false,
}: HeroSceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const labels = useRef<(HTMLSpanElement | null)[]>([]);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [mobile, setMobile] = useState(
    () => matchMedia("(max-width: 760px)").matches,
  );
  const [tablet, setTablet] = useState(
    () => matchMedia("(max-width: 1100px)").matches,
  );
  const [tooltip, setTooltip] = useState(false);
  const [shieldClick, setShieldClick] = useState(0);
  const [view, setView] = useState("production");
  const debug =
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("heroDebug") === "1";
  const orbitOnly =
    debug && new URLSearchParams(location.search).get("orbitOnly") === "1";
  const helpers =
    debug && new URLSearchParams(location.search).get("helpers") === "1";
  const [economy] = useState(() => (navigator.hardwareConcurrency || 4) <= 2);
  const visible = inView && pageVisible;
  const animated = visible && !reduced && !tablet && !economy;

  useEffect(() => {
    const queries = [
      [matchMedia("(prefers-reduced-motion: reduce)"), setReduced],
      [matchMedia("(max-width: 760px)"), setMobile],
      [matchMedia("(max-width: 1100px)"), setTablet],
    ] as const;
    const cleanups = queries.map(([query, set]) => {
      const update = () => set(query.matches);
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
    });
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.01 },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cleanups.forEach((clean) => clean());
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      clearTimeout(tooltipTimer.current);
    };
  }, []);
  useEffect(() => {
    if (mobile) return;
    const probe = document.createElement("canvas");
    try {
      const context = probe.getContext("webgl2");
      setSupported(Boolean(context));
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      setFailed(true);
    }
    return () => {
      probe.width = probe.height = 0;
    };
  }, [mobile]);
  useEffect(() => {
    if (
      !import.meta.env.DEV ||
      (!debug && new URLSearchParams(location.search).get("debug3d") !== "1")
    )
      return;
    const handler = (event: KeyboardEvent) => {
      if (
        (event.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const views: Record<string, string> = debug
        ? {
            "0": "production",
            "1": "front",
            "2": "left",
            "3": "right",
            "4": "top",
            "5": "bottom",
          }
        : {
            "0": "production",
            "1": "front",
            "2": "side",
            "3": "top",
          };
      if (views[event.key]) setView(views[event.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debug]);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => {
    setFailed(true);
    setReady(false);
  }, []);
  const documentClick = useCallback(() => {
    setTooltip(true);
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(false), 2000);
  }, []);
  const status =
    mobile || failed || !supported ? "fallback" : ready ? "ready" : "loading";
  return (
    <div
      ref={root}
      className="three-hero"
      aria-hidden="true"
      data-state={status}
      data-motion={animated ? "animated" : "static"}
      data-visible={visible}
      data-view={view}
      data-orbit-only={orbitOnly}
      data-cta={active ? "detect" : rulesActive ? "rules" : "none"}
      data-shield-click={shieldClick}
      onPointerMove={(e) => {
        if (!animated || !root.current) return;
        const rect = root.current.getBoundingClientRect();
        pointer.current.x = Math.max(
          -1,
          Math.min(1, ((e.clientX - rect.x) / rect.width) * 2 - 1),
        );
        pointer.current.y = Math.max(
          -1,
          Math.min(1, ((e.clientY - rect.y) / rect.height) * 2 - 1),
        );
      }}
      onPointerLeave={() => {
        pointer.current.x = pointer.current.y = 0;
      }}
    >
      <div className="three-haze" />
      <div className="three-fallback">
        <SVGScene staticScene />
      </div>
      {!mobile && supported && !failed && (
        <div className="three-canvas">
          <SceneBoundary onError={onError}>
            <Suspense fallback={null}>
              <HeroCanvas
                root={root}
                labels={labels}
                pointer={pointer}
                visible={visible}
                animated={animated}
                tablet={tablet}
                active={active}
                rulesActive={rulesActive}
                documentActive={tooltip}
                shieldClick={shieldClick}
                view={view}
                orbitOnly={orbitOnly}
                helpers={helpers}
                onReady={onReady}
                onError={onError}
                onDocumentClick={documentClick}
                onShieldClick={() => setShieldClick((value) => value + 1)}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      )}
      {!mobile && supported && !failed && (
        <div className="three-label-layer">
          {heroSceneConfig.labels.map((label, index) => (
            <span
              key={label.text}
              ref={(element) => {
                labels.current[index] = element;
              }}
              className="three-label"
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
      {tooltip && status === "ready" && (
        <span className="three-tooltip">规则 → 检测 → 证据</span>
      )}
    </div>
  );
}
