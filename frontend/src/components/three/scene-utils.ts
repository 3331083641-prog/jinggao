import {
  ExtrudeGeometry,
  Shape,
  CatmullRomCurve3,
  Vector3,
  Euler,
  type BufferGeometry,
} from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { RefObject } from "react";
import { heroSceneConfig as C } from "./heroSceneConfig";
export type SceneRuntime = {
  time: number;
  document: number;
  shieldPulse: number;
  nodeTime: number;
};
export type MotionRef = RefObject<SceneRuntime>;
export function smoothBevel<T extends BufferGeometry>(geometry: T): T {
  // No UV texture is used. Weld the bevel seams so reflected studio light
  // flows over the rounded edge instead of exposing individual flat facets.
  geometry.deleteAttribute("uv");
  geometry.deleteAttribute("normal");
  const smooth = mergeVertices(geometry, 0.00001) as T;
  smooth.computeVertexNormals();
  geometry.dispose();
  return smooth;
}
export function paperGeometry() {
  const { width: w, height: h, radius: r, thickness: depth } = C.paper;
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return smoothBevel(
    new ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: C.paper.bevel,
      bevelSize: C.paper.bevel,
      bevelSegments: 4,
      curveSegments: 8,
    }),
  );
}
export function orbitCurves() {
  return C.orbit.rotations.map((rotation) => {
    const orientation = new Euler(...rotation);
    const center = new Vector3(...C.orbit.center);
    const curve = new CatmullRomCurve3(
      Array.from({ length: 96 }, (_, i) => {
        const t = (i / 96) * Math.PI * 2;
        return new Vector3(
          Math.cos(t) * C.orbit.radius[0],
          Math.sin(t) * C.orbit.radius[1],
          0,
        )
          .applyEuler(orientation)
          .add(center);
      }),
      true,
      "centripetal",
    );
    curve.arcLengthDivisions = 512;
    curve.updateArcLengths();
    return curve;
  });
}
