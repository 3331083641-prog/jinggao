import { useMemo, useEffect } from "react";
import { TubeGeometry, type CatmullRomCurve3 } from "three";
import { heroSceneConfig as C } from "./heroSceneConfig";
export function OrbitPath({ curve }: { curve: CatmullRomCurve3 }) {
  const geometry = useMemo(
    () =>
      new TubeGeometry(
        curve,
        C.orbit.segments,
        C.orbit.tubeRadius,
        C.orbit.radialSegments,
        true,
      ),
    [curve],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} name="closed-orbit">
      <meshPhysicalMaterial color={C.colors.orbit} {...C.materials.orbit} />
    </mesh>
  );
}
