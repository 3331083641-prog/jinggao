import { useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import type { MotionRef } from "./scene-utils";
export function FloatingHeroLabel({
  text,
  position,
  phase,
  runtime,
  animated,
  active,
  highlighted,
  elements,
  index,
}: {
  text: string;
  position: readonly [number, number, number];
  phase: number;
  runtime: MotionRef;
  animated: boolean;
  active: boolean;
  highlighted: boolean;
  elements: RefObject<(HTMLSpanElement | null)[]>;
  index: number;
}) {
  const group = useRef<Group>(null);
  const point = useRef(new Vector3());
  const { camera, size } = useThree();
  useFrame(() => {
    if (group.current) {
      group.current.position.y =
        position[1] +
        (animated ? Math.sin(runtime.current.time * 0.72 + phase) * 0.012 : 0);
      group.current.position.z = position[2] + (active ? 0.02 : 0);
      group.current.updateWorldMatrix(true, false);
      group.current.getWorldPosition(point.current).project(camera);
      const element = elements.current[index];
      if (element) {
        const x = ((point.current.x + 1) * size.width) / 2;
        const y = ((1 - point.current.y) * size.height) / 2;
        const scale = Math.min(1.1, size.height / 400);
        element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) rotate(4deg) scale(${scale})`;
        element.style.opacity = active || highlighted ? "1" : "0.86";
      }
    }
  });
  return <group ref={group} position={[...position]} name={"label-" + text} />;
}
