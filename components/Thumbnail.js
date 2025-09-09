import React, { useEffect, useRef } from "react";
import { View, Text } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import { Asset } from "expo-asset";
import {
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Box3,
  Vector3,
  AnimationMixer,
  LoopOnce,
  Clock,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Ionicons } from "@expo/vector-icons";

export default function Thumbnail({ zoom = 1.5, source }) {
  const timeout = useRef();

  useEffect(() => {
    return () => {
      if (timeout.current) cancelAnimationFrame(timeout.current);
    };
  }, []);

  if (!source) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#FDECEA",
          borderRadius: 10,
        }}
      >
        <Ionicons name="cube-outline" size={36} color="#aaa" />
        <Text style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
          No thumbnail
        </Text>
      </View>
    );
  }

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const scene = new Scene();
    const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    scene.add(new AmbientLight(0xffffff, 0.6));
    const light = new DirectionalLight(0xffffff, 0.8);
    light.position.set(5, 10, 7.5);
    scene.add(light);

    try {
      const modelFile = Array.isArray(source) ? source[0] : source;
      const modelAsset = Asset.fromModule(modelFile);
      await modelAsset.downloadAsync();

      const loader = new GLTFLoader();
      loader.load(
        modelAsset.localUri || modelAsset.uri,
        (gltf) => {
          const model = gltf.scene;
          scene.add(model);

          // Center model
          const box = new Box3().setFromObject(model);
          const center = new Vector3();
          box.getCenter(center);
          model.position.sub(center);

          // Scale model
          model.scale.multiplyScalar(zoom);

          // Camera fit
          const size = new Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const fov = camera.fov * (Math.PI / 180);
          let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
          cameraZ *= 1.5;
          camera.position.set(0, 0, cameraZ);
          camera.lookAt(0, 0, 0);

          // Play animation once & freeze on last frame
          if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new AnimationMixer(model);
            const clip = gltf.animations[0];
            const action = mixer.clipAction(clip);
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();

            // Jump to last frame
            mixer.update(clip.duration);
          }

          // Render once (static thumbnail)
          renderer.render(scene, camera);
          gl.endFrameEXP();
        },
        undefined,
        (error) => console.error("❌ Error loading thumbnail model:", error)
      );
    } catch (err) {
      console.error("❌ Failed to load thumbnail asset:", err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <GLView
        style={{ width: "100%", height: "100%" }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
}
