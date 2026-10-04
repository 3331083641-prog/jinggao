import { useMemo, useEffect, useRef } from "react";
import {
  Shape,
  Path,
  ExtrudeGeometry,
  Group,
  MeshPhysicalMaterial,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { heroSceneConfig as C } from "./heroSceneConfig";
import { smoothBevel, type MotionRef } from "./scene-utils";

function outline(scale = 1) {
  const s = new Shape();
  s.moveTo(0, 0.52 * scale);
  s.bezierCurveTo(
    0.14 * scale,
    0.35 * scale,
    0.31 * scale,
    0.29 * scale,
    0.43 * scale,
    0.27 * scale,
  );
  s.bezierCurveTo(
    0.43 * scale,
    -0.14 * scale,
    0.28 * scale,
    -0.42 * scale,
    0,
    -0.6 * scale,
  );
  s.bezierCurveTo(
    -0.28 * scale,
    -0.42 * scale,
    -0.43 * scale,
    -0.14 * scale,
    -0.43 * scale,
    0.27 * scale,
  );
  s.bezierCurveTo(
    -0.31 * scale,
    0.29 * scale,
    -0.14 * scale,
    0.35 * scale,
    0,
    0.52 * scale,
  );
  s.closePath();
  return s;
}
function curvedFace() {
  const polygon = outline(0.855).getPoints(96);
  const rows = 40,
    columns = 24,
    positions: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const v = row / rows,
      y = -0.6 * 0.855 + v * 1.12 * 0.855;
    let width = 0;
    for (let i = 0; i < polygon.length - 1; i++) {
      const a = polygon[i],
        b = polygon[i + 1];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y))
        width = Math.max(
          width,
          Math.abs(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)),
        );
    }
    for (let col = 0; col <= columns; col++) {
      const u = col / columns,
        x = (u * 2 - 1) * width;
      const crown =
        Math.sin(v * Math.PI) * (1 - Math.pow(u * 2 - 1, 2)) * 0.065;
      positions.push(x, y, 0.068 + crown);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col,
          b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function ShieldMark({
  runtime,
  animated,
  active,
  onClick,
}: {
  runtime: MotionRef;
  animated: boolean;
  active: boolean;
  onClick: () => void;
}) {
  const group = useRef<Group>(null),
    material = useRef<MeshPhysicalMaterial>(null);
  const gl = useThree((s) => s.gl);
  const geometries = useMemo(() => {
    const ring = outline();
    ring.holes.push(new Path(outline(0.87).getPoints(28).reverse()));
    const check = new Shape();
    check.moveTo(-0.225, -0.025);
    check.lineTo(-0.166, 0.04);
    check.lineTo(-0.055, -0.071);
    check.lineTo(0.202, 0.185);
    check.lineTo(0.269, 0.115);
    check.lineTo(-0.053, -0.211);
    check.closePath();
    const bevel = { bevelEnabled: true, bevelSegments: 6, curveSegments: 28 };
    return {
      face: curvedFace(),
      body: smoothBevel(
        new ExtrudeGeometry(outline(), {
          ...bevel,
          depth: C.shield.depth,
          bevelThickness: 0.012,
          bevelSize: C.shield.bevel,
        }),
      ),
      rim: smoothBevel(
        new ExtrudeGeometry(ring, {
          ...bevel,
          depth: 0.014,
          bevelThickness: 0.006,
          bevelSize: 0.006,
        }),
      ),
      inset: smoothBevel(
        new ExtrudeGeometry(outline(0.86), {
          ...bevel,
          depth: 0.014,
          bevelThickness: 0.006,
          bevelSize: 0.008,
        }),
      ),
      check: smoothBevel(
        new ExtrudeGeometry(check, {
          ...bevel,
          depth: 0.016,
          bevelThickness: 0.003,
          bevelSize: 0.004,
        }),
      ),
    };
  }, []);
  useEffect(
    () => () => Object.values(geometries).forEach((g) => g.dispose()),
    [geometries],
  );
  useFrame(() => {
    const { time, document, shieldPulse } = runtime.current;
    if (group.current) {
      group.current.scale.setScalar(
        C.shield.scale *
          (1 +
            (animated
              ? Math.sin((time * Math.PI * 2) / C.shield.period) * 0.0075
              : 0) +
            shieldPulse * C.shield.clickScale),
      );
      group.current.position.y =
        C.shield.position[1] + (animated ? Math.sin(time * 0.8) * 0.015 : 0);
      group.current.position.z = C.shield.position[2] + document * 0.04;
    }
    if (material.current)
      material.current.envMapIntensity = active ? 1.16 : 1 + shieldPulse * 0.12;
  });
  return (
    <group
      ref={group}
      name="shield"
      position={[...C.shield.position]}
      rotation={[...C.shield.rotation]}
      scale={C.shield.scale}
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
      <mesh geometry={geometries.body} castShadow receiveShadow>
        <meshPhysicalMaterial
          color={C.colors.edge}
          {...C.materials.gold}
          roughness={0.36}
        />
      </mesh>
      <mesh
        geometry={geometries.inset}
        position={[0, 0, 0.045]}
        castShadow
        receiveShadow
        name="shield-inset"
      >
        <meshPhysicalMaterial color={C.colors.gold} {...C.materials.gold} />
      </mesh>
      <mesh
        geometry={geometries.face}
        castShadow
        receiveShadow
        name="shield-face"
      >
        <meshPhysicalMaterial
          ref={material}
          color={C.colors.gold}
          {...C.materials.gold}
        />
      </mesh>
      <mesh
        geometry={geometries.rim}
        position={[0, 0, 0.056]}
        castShadow
        receiveShadow
        name="shield-rim"
      >
        <meshPhysicalMaterial
          color={C.colors.highlight}
          {...C.materials.gold}
          metalness={0.6}
          roughness={0.26}
        />
      </mesh>
      <mesh
        geometry={geometries.check}
        position={[0, 0, 0.146]}
        castShadow
        receiveShadow
        name="shield-check"
      >
        <meshPhysicalMaterial
          color="#fffdf8"
          metalness={0}
          roughness={0.42}
          clearcoat={0.1}
        />
      </mesh>
    </group>
  );
}
