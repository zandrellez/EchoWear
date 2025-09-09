import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { View, PanResponder } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import { Asset } from "expo-asset";
import {
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  Clock,
  AnimationMixer,
  Box3,
  Vector3,
  LoopOnce,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const ModelViewer = forwardRef(({ zoom = 1.5, source }, ref) => {
  const timeout = useRef();
  const rotation = useRef({ x: 0, y: 0 });
  const mixerRef = useRef(null);
  const clipsRef = useRef([]);
  const actionsRef = useRef([]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        rotation.current.y += gestureState.dx * 0.001;
      },
    })
  ).current;

  useImperativeHandle(ref, () => ({
    replay: () => {
      if (mixerRef.current && clipsRef.current.length > 0) {
        actionsRef.current.forEach((action) => {
          action.reset().play();
        });
      }
    },
  }));

  useEffect(() => {
    return () => {
      if (timeout.current) cancelAnimationFrame(timeout.current);
    };
  }, []);

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

    const clock = new Clock();

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

          // Animations (play once)
          if (gltf.animations && gltf.animations.length > 0) {
            mixerRef.current = new AnimationMixer(model);
            clipsRef.current = gltf.animations;

            actionsRef.current = gltf.animations.map((clip) => {
              const action = mixerRef.current.clipAction(clip);
              action.setLoop(LoopOnce, 1); // play once
              action.clampWhenFinished = true; // stop at last frame
              action.play(); // initial play once
              return action;
            });
          }

          // Animate loop
          const animate = () => {
            timeout.current = requestAnimationFrame(animate);
            const delta = clock.getDelta();
            if (mixerRef.current) mixerRef.current.update(delta);
            model.rotation.y = rotation.current.y;
            renderer.render(scene, camera);
            gl.endFrameEXP();
          };
          animate();
        },
        undefined,
        (error) => console.error("❌ Error loading model:", error)
      );
    } catch (err) {
      console.error("❌ Failed to load asset:", err);
    }
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <GLView
        style={{ width: "100%", height: "100%" }}
        onContextCreate={onContextCreate}
      />
    </View>
  );
});

export default ModelViewer;
