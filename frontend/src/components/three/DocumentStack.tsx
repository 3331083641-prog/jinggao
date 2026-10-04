import { useMemo, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, MeshPhysicalMaterial } from "three";
import { DocumentSheet } from "./DocumentSheet";
import { heroSceneConfig as C } from "./heroSceneConfig";
import { paperGeometry, type MotionRef } from "./scene-utils";
export function DocumentStack({
  runtime,
  animated,
  onClick,
}: {
  runtime: MotionRef;
  animated: boolean;
  onClick: () => void;
}) {
  const geometry = useMemo(paperGeometry, []);
  const material = useMemo(
    () => [
      new MeshPhysicalMaterial({ color: C.colors.paper, ...C.materials.paper }),
      new MeshPhysicalMaterial({
        color: C.colors.paperEdge,
        ...C.materials.paper,
      }),
    ],
    [],
  );
  const main = useRef<Group>(null);
  const backMaterials = useMemo(
    () =>
      C.colors.backPapers.map((color) => [
        new MeshPhysicalMaterial({ color, ...C.materials.paper }),
        material[1],
      ]),
    [material],
  );
  const backs = useRef<(Group | null)[]>([]);
  const gl = useThree((s) => s.gl);
  useEffect(
    () => () => {
      geometry.dispose();
      material.forEach((m) => m.dispose());
      backMaterials.forEach((m) => m[0].dispose());
    },
    [geometry, material, backMaterials],
  );
  useFrame(() => {
    const t = runtime.current.time;
    if (main.current) {
      main.current.position.y = animated
        ? Math.sin((t * Math.PI * 2) / C.paperFloatPeriod) *
          C.paperFloatAmplitude
        : 0;
      main.current.position.z = runtime.current.document * 0.12;
      main.current.rotation.y = animated ? Math.sin(t * 0.6) * 0.01 : 0;
    }
    backs.current.forEach((g, i) => {
      if (g)
        g.position.y =
          C.layers[i].position[1] +
          (animated ? Math.sin(t * 0.65 + i * 1.8) * 0.02 : 0);
    });
  });
  return (
    <group
      position={[...C.stack.position]}
      rotation={[...C.stack.rotation]}
      name="document-stack"
    >
      {C.layers.map((layer, i) => (
        <group
          key={i}
          ref={(g) => {
            backs.current[i] = g;
          }}
          position={[...layer.position]}
          rotation={[0, 0, layer.rotation]}
        >
          <DocumentSheet geometry={geometry} material={backMaterials[i]} />
        </group>
      ))}
      <group
        ref={main}
        name="main-document"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          gl.domElement.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          gl.domElement.style.cursor = "";
        }}
      >
        <DocumentSheet geometry={geometry} material={material} main />
      </group>
    </group>
  );
}
