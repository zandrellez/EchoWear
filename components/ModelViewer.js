import React, {
  useEffect,
  useState,
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

const ModelViewer = forwardRef(
  ({ source, zoom = 1, animationSpeed = 1 }, ref) => {
    const timeout = useRef();
    const rotation = useRef({ y: 0 }); // ✅ only horizontal rotation
    const mixerRef = useRef(null);
    const clipsRef = useRef([]);
    const actionsRef = useRef([]);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const modelRef = useRef(null);
    const speedRef = useRef(animationSpeed);

    useEffect(() => {
        speedRef.current = animationSpeed;
    }, [animationSpeed]);

    const [sceneReady, setSceneReady] = useState(false);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (evt, gestureState) => {
          // ✅ scale rotation speed by prop
          rotation.current.y += gestureState.dx * rotationSpeed;
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

    useEffect(() => {
      if (!source || !sceneReady) return;

      const loader = new GLTFLoader();
      const modelFile = Array.isArray(source) ? source[0] : source;
      const modelAsset = Asset.fromModule(modelFile);

      (async () => {
        await modelAsset.downloadAsync();
        loader.load(
          modelAsset.localUri || modelAsset.uri,
          (gltf) => {
            // Remove old model
            if (modelRef.current) {
              sceneRef.current.remove(modelRef.current);
              modelRef.current.traverse((child) => {
                if (child.geometry) child.geometry.dispose?.();
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach((m) => m.dispose?.());
                  } else {
                    child.material.dispose?.();
                  }
                }
              });
            }

            const model = gltf.scene;
            modelRef.current = model;
            sceneRef.current.add(model);

            // Center model
            const box = new Box3().setFromObject(model);
            const center = new Vector3();
            box.getCenter(center);
            model.position.sub(center);

            // Offset if needed
            model.position.x += 5.5;
            model.position.y -= 5;

            // Fit camera
            const size = new Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = cameraRef.current.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
            cameraZ *= 1.5 * zoom;
            cameraRef.current.position.set(0, 0, cameraZ);
            cameraRef.current.lookAt(0, 0, 0);

            // Animations
            if (gltf.animations && gltf.animations.length > 0) {
              mixerRef.current = new AnimationMixer(model);
              clipsRef.current = gltf.animations;
              actionsRef.current = gltf.animations.map((clip) => {
                const action = mixerRef.current.clipAction(clip);
                action.setLoop(LoopOnce, 1);
                action.clampWhenFinished = true;
                action.play();
                return action;
              });
            }
          },
          undefined,
          (error) => console.error("❌ Error loading model:", error)
        );
      })();
    }, [source, sceneReady, zoom]);

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

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;

      const clock = new Clock();

      setSceneReady(true);

      const animate = () => {
        timeout.current = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (mixerRef.current) {
            mixerRef.current.timeScale = speedRef.current; // ✅ speed control
            mixerRef.current.update(delta);
        }
        if (modelRef.current) {
            modelRef.current.rotation.y = rotation.current.y;
        }
        renderer.render(scene, camera);
        gl.endFrameEXP();
      };
      animate();
    };

    return (
      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <GLView
          style={{ width: "100%", height: "100%" }}
          onContextCreate={onContextCreate}
        />
      </View>
    );
  }
);

export default ModelViewer;
