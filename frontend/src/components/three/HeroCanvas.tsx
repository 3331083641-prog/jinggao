import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Group,
  MathUtils,
  Vector3,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  PCFShadowMap,
} from "three";
import { DocumentStack } from "./DocumentStack";
import { ShieldMark } from "./ShieldMark";
import { OrbitGroup } from "./OrbitGroup";
import { StudioLighting } from "./StudioLighting";
import { FloatingHeroLabel } from "./FloatingHeroLabel";
import { heroSceneConfig as C } from "./heroSceneConfig";
import { orbitCurves, type SceneRuntime } from "./scene-utils";
const cameraConfig = {
  position: [0, 0, C.camera.distance] as [number, number, number],
  fov: C.camera.fov,
  near: 0.1,
  far: 30,
};
const desktopDpr: [number, number] = [1, 1.5];

type Props = {
  labels: RefObject<(HTMLSpanElement | null)[]>;
  root: RefObject<HTMLDivElement | null>;
  pointer: RefObject<{ x: number; y: number }>;
  visible: boolean;
  animated: boolean;
  tablet: boolean;
  active: boolean;
  rulesActive: boolean;
  documentActive: boolean;
  shieldClick: number;
  view: string;
  orbitOnly: boolean;
  helpers: boolean;
  onReady: () => void;
  onError: () => void;
  onDocumentClick: () => void;
  onShieldClick: () => void;
};
function Scene(props: Props) {
  const group = useRef<Group>(null);
  const runtime = useRef<SceneRuntime>({
    time: 0,
    document: 0,
    shieldPulse: 0,
    nodeTime: 0,
  });
  const frames = useRef(0);
  const frameTime = useRef(0);
  const lastClick = useRef(props.shieldClick);
  const pulseStart = useRef(-10);
  const point = useRef(new Vector3());
  const curves = useMemo(orbitCurves, []);
  const { gl, camera, scene, size, invalidate } = useThree();
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      props.onError();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, props.onError]);
  useEffect(() => {
    camera.up.set(0, 1, 0);
    const preset = C.debugCamera[props.view as keyof typeof C.debugCamera];
    if (preset) camera.position.set(preset[0], preset[1], preset[2]);
    else camera.position.set(0, 0, C.camera.distance);
    camera.lookAt(props.view === "production" ? 0 : 0.4, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, props.view]);
  useEffect(() => {
    if (props.visible) invalidate();
  }, [
    props.visible,
    invalidate,
    props.active,
    props.rulesActive,
    props.documentActive,
    props.shieldClick,
    props.orbitOnly,
    props.helpers,
  ]);
  useEffect(() => {
    // Reset on pause/resume, while preserving real elapsed time between active
    // frames. Capping every delta slowed closed-orbit periods on lower FPS.
    frameTime.current = performance.now();
  }, [props.visible, props.animated]);
  useFrame(() => {
    if (!props.visible) return;
    const now = performance.now();
    const dt = Math.max(0, (now - frameTime.current) / 1000);
    frameTime.current = now;
    const r = runtime.current;
    if (props.animated) {
      r.time += dt;
      r.nodeTime += dt * (props.active ? 1.1 : 1);
    }
    r.document = props.animated
      ? MathUtils.damp(r.document, props.documentActive ? 1 : 0, 5, dt)
      : 0;
    if (lastClick.current !== props.shieldClick) {
      // Show feedback on the first rendered frame, even when the next frame
      // takes longer on a software renderer.
      pulseStart.current = r.time - 0.02;
      lastClick.current = props.shieldClick;
    }
    const age = r.time - pulseStart.current;
    r.shieldPulse =
      props.animated && age < 0.55
        ? Math.sin((Math.max(0, age) / 0.55) * Math.PI)
        : 0;
    if (group.current) {
      const interactive = props.animated && props.view === "production";
      group.current.rotation.x = MathUtils.damp(
        group.current.rotation.x,
        interactive ? props.pointer.current.y * C.parallax.x : 0,
        C.parallax.damping,
        dt,
      );
      group.current.rotation.y = MathUtils.damp(
        group.current.rotation.y,
        interactive ? props.pointer.current.x * C.parallax.y : 0,
        C.parallax.damping,
        dt,
      );
    }
    frames.current++;
    const element = props.root.current;
    if (element) {
      element.dataset.frames = String(frames.current);
      element.dataset.renderedView = props.view;
      element.dataset.documentDepth = r.document.toFixed(4);
      element.dataset.shieldPulse = r.shieldPulse.toFixed(4);
      if (
        frames.current < 4 ||
        frames.current % 30 === 0 ||
        element.dataset.projectionView !== props.view
      ) {
        element.dataset.projectionView = props.view;
        element.dataset.triangles = String(gl.info.render.triangles);
        element.dataset.drawCalls = String(gl.info.render.calls);
        element.dataset.geometries = String(gl.info.memory.geometries);
        element.dataset.parallax = String(group.current?.rotation.y.toFixed(4));
        element.dataset.pixelRatio = String(gl.getPixelRatio());
        scene.updateMatrixWorld();
        for (const [name, prefix] of [
          ["main-document", "document"],
          ["shield", "shield"],
        ]) {
          const object = scene.getObjectByName(name);
          if (object) {
            point.current
              .set(0, name === "main-document" ? 0.5 : 0, 0)
              .applyMatrix4(object.matrixWorld)
              .project(camera);
            element.dataset[prefix + "X"] = String(
              ((point.current.x + 1) * size.width) / 2,
            );
            element.dataset[prefix + "Y"] = String(
              ((1 - point.current.y) * size.height) / 2,
            );
          }
        }
      }
    }
    if (frames.current === 1) props.onReady();
  }, -1);
  return (
    <>
      <StudioLighting />
      <group ref={group} name="hero-root">
        {!props.orbitOnly && (
          <DocumentStack
            runtime={runtime}
            animated={props.animated}
            onClick={props.onDocumentClick}
          />
        )}
        {!props.orbitOnly && (
          <ShieldMark
            runtime={runtime}
            animated={props.animated}
            active={props.active}
            onClick={props.onShieldClick}
          />
        )}
        <OrbitGroup curves={curves} runtime={runtime} tablet={props.tablet} />
        {!props.orbitOnly &&
          C.labels.map((label, index) => (
            <FloatingHeroLabel
              key={label.text}
              {...label}
              runtime={runtime}
              animated={props.animated}
              active={props.rulesActive}
              highlighted={props.documentActive}
              elements={props.labels}
              index={index}
            />
          ))}
        {props.helpers && (
          <>
            <axesHelper args={[2.5]} />
            <gridHelper
              args={[5, 10, "#cbb89a", "#e8e0d4"]}
              position={[0, -1.3, 0]}
            />
          </>
        )}
      </group>
    </>
  );
}
export default function HeroCanvas(props: Props) {
  return (
    <Canvas
      shadows={{ type: PCFShadowMap }}
      camera={cameraConfig}
      dpr={props.tablet ? 1 : desktopDpr}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = C.camera.exposure;
      }}
      frameloop={
        !props.visible ? "never" : props.animated ? "always" : "demand"
      }
      fallback={null}
    >
      <Scene {...props} />
    </Canvas>
  );
}
