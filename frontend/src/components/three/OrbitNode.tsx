import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  InstancedMesh,
  Object3D,
  Vector3,
  type CatmullRomCurve3,
  type SphereGeometry,
  type MeshPhysicalMaterial,
} from "three";
import { heroSceneConfig as C } from "./heroSceneConfig";
import type { MotionRef } from "./scene-utils";
export function OrbitNode({
  curve,
  pathIndex,
  runtime,
  tablet,
  geometry,
  material,
}: {
  curve: CatmullRomCurve3;
  pathIndex: number;
  runtime: MotionRef;
  tablet: boolean;
  geometry: SphereGeometry;
  material: MeshPhysicalMaterial;
}) {
  const mesh = useRef<InstancedMesh>(null),
    model = useRef(new Object3D()),
    point = useRef(new Vector3());
  const nodes = useMemo(
    () => C.nodes.filter((node) => node.path === pathIndex),
    [pathIndex],
  );
  const count = tablet ? 2 : nodes.length;
  useFrame(() => {
    if (!mesh.current) return;
    for (let i = 0; i < count; i++) {
      const node = nodes[i];
      const phase = (node.phase + runtime.current.nodeTime / node.period) % 1;
      curve.getPointAt(phase, point.current);
      model.current.position.copy(point.current);
      model.current.scale.setScalar(node.scale);
      model.current.updateMatrix();
      mesh.current.setMatrixAt(i, model.current.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      name={"orbit-nodes-" + pathIndex}
      userData={{ nodes }}
    />
  );
}
