import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SphereGeometry, MeshPhysicalMaterial, Group } from "three";
import { OrbitPath } from "./OrbitPath";
import { OrbitNode } from "./OrbitNode";
import { heroSceneConfig as C } from "./heroSceneConfig";
import type { CatmullRomCurve3 } from "three";
import type { MotionRef } from "./scene-utils";
export function OrbitGroup({
  curves,
  runtime,
  tablet,
}: {
  curves: CatmullRomCurve3[];
  runtime: MotionRef;
  tablet: boolean;
}) {
  const group = useRef<Group>(null);
  const geometry = useMemo(() => new SphereGeometry(C.nodeRadius, 24, 16), []);
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({ color: C.colors.gold, ...C.materials.node }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(() => {
    if (group.current)
      group.current.userData.nodeTime = runtime.current.nodeTime;
  });
  return (
    <group ref={group} name="orbit-group">
      {curves.map((curve, index) => (
        <group
          key={index}
          name={index === 0 ? "orbit-a" : "orbit-b"}
          userData={{ curve, pathIndex: index }}
        >
          <OrbitPath curve={curve} />
          <OrbitNode
            curve={curve}
            pathIndex={index}
            runtime={runtime}
            tablet={tablet}
            geometry={geometry}
            material={material}
          />
        </group>
      ))}
    </group>
  );
}
