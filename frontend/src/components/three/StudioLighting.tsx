import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { heroSceneConfig as C } from "./heroSceneConfig";

export function StudioLighting() {
  const { gl, scene, invalidate } = useThree();
  useEffect(() => {
    // Procedural local studio: no HDR file, network request or background image.
    const room = new RoomEnvironment();
    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(room, 0.035, 0.1, 100, { size: 128 });
    const previous = scene.environment;
    const intensity = scene.environmentIntensity;
    scene.environment = target.texture;
    scene.environmentIntensity = C.light.environment;
    room.dispose();
    generator.dispose();
    invalidate();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = intensity;
      target.dispose();
    };
  }, [gl, scene, invalidate]);
  return (
    <>
      <hemisphereLight args={["#fff8ed", "#cfc2ad", C.light.hemisphere]} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={C.light.key}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.002}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={0.1}
        shadow-camera-far={15}
        shadow-radius={4}
      />
      <directionalLight
        position={[-4, 1, 4]}
        intensity={C.light.fill}
        color="#fffdfa"
      />
      <directionalLight
        position={[-2, 3, -4]}
        intensity={C.light.rim}
        color="#fff0d7"
      />
    </>
  );
}
