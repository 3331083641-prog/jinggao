import { useLayoutEffect, useRef } from "react";
import {
  InstancedMesh,
  Object3D,
  type ExtrudeGeometry,
  type MeshPhysicalMaterial,
} from "three";
import { heroSceneConfig as C } from "./heroSceneConfig";
export function DocumentSheet({
  geometry,
  material,
  main = false,
}: {
  geometry: ExtrudeGeometry;
  material: MeshPhysicalMaterial[];
  main?: boolean;
}) {
  const lines = useRef<InstancedMesh>(null);
  const front = C.paper.thickness + C.paper.bevel + 0.002;
  useLayoutEffect(() => {
    if (!lines.current) return;
    const model = new Object3D();
    for (let i = 0; i < 7; i++) {
      model.position.set(i === 6 ? -0.13 : 0, 0.53 - i * 0.176, front);
      model.scale.set(i === 6 ? 0.72 : 0.98, 0.038, 1);
      model.updateMatrix();
      lines.current.setMatrixAt(i, model.matrix);
    }
    lines.current.instanceMatrix.needsUpdate = true;
  }, [front]);
  return (
    <group>
      <mesh
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
        name={main ? "paper-main" : "paper-back"}
      />
      {main && (
        <>
          <mesh position={[0, 0.77, front]}>
            <planeGeometry args={[1.04, 0.066]} />
            <meshStandardMaterial color={C.colors.title} roughness={0.86} />
          </mesh>
          <instancedMesh ref={lines} args={[undefined, undefined, 7]}>
            <planeGeometry args={[1, 1]} />
            <meshStandardMaterial color={C.colors.line} roughness={0.9} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
