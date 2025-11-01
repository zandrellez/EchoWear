import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from "react";
import { PanResponder, View, ActivityIndicator } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { Asset } from "expo-asset";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const modelCache = new Map();

const ModelViewer = forwardRef(function ModelViewer(
  { source, animationSpeed = 1, rotationSpeed = 0, offset = { x: 0.6, y: -0.7 } },
  ref
) {
  const modelRef = useRef();
  const mixerRef = useRef();
  const actionRef = useRef(); // 🔹 NEW
  const rotationYRef = useRef(0);
  const cameraRef = useRef();
  const lastTouchDistanceRef = useRef(null);
  const [loading, setLoading] = useState(true);

  const onContextCreate = async (gl) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0xfdecea, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    camera.position.z = 2;
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    const asset = Asset.fromModule(source);
    await asset.downloadAsync();

    const loader = new GLTFLoader();
    let model;
    const uri = asset.localUri || asset.uri;

    if (modelCache.has(uri)) {
      model = modelCache.get(uri).clone(true);
    } else {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(uri, resolve, undefined, reject);
      });
      model = gltf.scene;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.5 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.sub(center.multiplyScalar(scale));
      model.position.x += offset.x;
      model.position.y += offset.y;

      modelCache.set(uri, model.clone(true));

      // 🔹 Animations
      if (gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        const action = mixer.clipAction(gltf.animations[0]);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        mixerRef.current = mixer;
        actionRef.current = action; // ✅ store reference
      }
    }

    scene.add(model);
    modelRef.current = model;
    setLoading(false);

    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (mixerRef.current) {
        mixerRef.current.update(delta * animationSpeed);
      }

      if (modelRef.current) {
        if (rotationSpeed !== 0) rotationYRef.current += rotationSpeed;
        modelRef.current.rotation.y = rotationYRef.current;
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();
  };

  // 🔹 Update playback speed dynamically
  useEffect(() => {
    if (mixerRef.current && actionRef.current) {
      mixerRef.current.timeScale = animationSpeed;
    }
  }, [animationSpeed]);

  // ✅ Expose replay() method
  useImperativeHandle(ref, () => ({
    replay: () => {
      if (actionRef.current && mixerRef.current) {
        actionRef.current.reset();
        actionRef.current.play();
      }
    },
  }));

  // 🔹 Touch controls (pinch zoom + rotate)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        if (touches.length === 2 && cameraRef.current) {
          const [t1, t2] = touches;
          const dx = t1.pageX - t2.pageX;
          const dy = t1.pageY - t2.pageY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (lastTouchDistanceRef.current !== null) {
            const delta = distance - lastTouchDistanceRef.current;
            cameraRef.current.position.z -= delta * 0.01;
            cameraRef.current.position.z = Math.min(
              Math.max(cameraRef.current.position.z, 0.8),
              5
            );
          }
          lastTouchDistanceRef.current = distance;
        } else if (touches.length === 1) {
          rotationYRef.current -= gestureState.dx * 0.005;
        }
      },

      onPanResponderRelease: () => {
        lastTouchDistanceRef.current = null;
      },
    })
  ).current;

  return (
    <>
      {loading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#fdecea",
          }}
        >
          <ActivityIndicator size="large" color="#E64C3C" />
        </View>
      )}
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} {...panResponder.panHandlers} />
    </>
  );
});

export default ModelViewer;
