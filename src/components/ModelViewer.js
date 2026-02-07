import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { PanResponder, View, ActivityIndicator } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { Asset } from "expo-asset";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const ModelViewer = forwardRef(function ModelViewer(
  // FIX 1: Adjusted defaults
  // y: -1.3 lowers the model so the camera looks at the chest/face
  // x: 0 keeps it centered
  { source, animationName, animationSpeed = 1, rotationSpeed = 0, offset = { x: 0, y: -1.3 } },
  ref
) {
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const currentActionRef = useRef();
  const cameraRef = useRef();
  
  const [loading, setLoading] = useState(true);
  const [glContextCreated, setGlContextCreated] = useState(false);

  // ... inside ModelViewer.js

  const onContextCreate = async (gl) => {
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); 

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // --- CAMERA FIXES ---
    const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
    
    // 1. ZOOM: Closer (1.3 is good for upper body, 2.0 is full body)
    // 2. HEIGHT: Move camera UP to 1.4 (Chest height)
    camera.position.set(0, 1.0, 2.2);

    // 3. LOOK: Force camera to look at the chest/neck area (0, 1.3, 0)
    camera.lookAt(0, 1.0, 0); 
    
    cameraRef.current = camera;

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
    frontLight.position.set(0, 2, 5);
    scene.add(frontLight);

    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (mixerRef.current) mixerRef.current.update(delta);
      if (modelRef.current && rotationSpeed !== 0) modelRef.current.rotation.y += rotationSpeed;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();

    setGlContextCreated(true);
  };

  useEffect(() => {
    if (!glContextCreated) return;
    if (!source) { setLoading(false); return; }

    const loadModel = async () => {
      setLoading(true);
      try {
        if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
            mixerRef.current = null;
            actionsRef.current = {};
        }

        const asset = Asset.fromModule(source);
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;

        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => loader.load(uri, resolve, undefined, reject));

        const model = gltf.scene;
        
        // FIX 3: Fixed Scaling
        // 1.7 scale is usually good for upper body focus in this view
        model.scale.set(1.7, 1.7, 1.7);
        model.position.set(0, 0, 0);
        
        // Apply Offsets
        model.position.y += offset.y;
        if(offset.x) model.position.x += offset.x;

        sceneRef.current.add(model);
        modelRef.current = model;

        if (gltf.animations && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(model);
            mixerRef.current = mixer;
            const actions = {};
            gltf.animations.forEach((clip) => { actions[clip.name] = mixer.clipAction(clip); });
            actionsRef.current = actions;
        }
      } catch (e) {
        console.error("Error loading model:", e);
      } finally {
        setLoading(false);
      }
    };
    loadModel();
  }, [source, glContextCreated]);

  useEffect(() => {
    if (!mixerRef.current || !actionsRef.current || !animationName) return;
    const newAction = actionsRef.current[animationName];
    if (newAction) {
        if (currentActionRef.current && currentActionRef.current !== newAction) currentActionRef.current.stop();
        newAction.reset().setLoop(THREE.LoopOnce, 1);
        newAction.clampWhenFinished = true;
        newAction.play();
        currentActionRef.current = newAction;
    } else {
        const all = Object.values(actionsRef.current);
        if(all.length > 0 && !currentActionRef.current) {
            all[0].reset().play();
            currentActionRef.current = all[0];
        }
    }
  }, [animationName, loading]);

  useEffect(() => { if (mixerRef.current) mixerRef.current.timeScale = animationSpeed; }, [animationSpeed]);

  useImperativeHandle(ref, () => ({
    replay: () => {
      if (currentActionRef.current) {
        currentActionRef.current.reset().play();
      }
    },
  }));

  const lastTouchDistanceRef = useRef(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2 && cameraRef.current) {
           // Pinch Zoom
           const [t1, t2] = touches;
           const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
           if (lastTouchDistanceRef.current !== null) {
              // Zoom sensitivity
              const delta = (dist - lastTouchDistanceRef.current) * 0.005; 
              cameraRef.current.position.z -= delta;
           }
           lastTouchDistanceRef.current = dist;
        } else if (touches.length === 1 && modelRef.current) {
           // Rotate
           modelRef.current.rotation.y += gestureState.dx * 0.005;
        }
      },
      onPanResponderRelease: () => { lastTouchDistanceRef.current = null; },
    })
  ).current;

  return (
    <View style={{flex: 1}}>
      {loading && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 10 }}>
          <ActivityIndicator size="large" color="#E64C3C" />
        </View>
      )}
      <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} {...panResponder.panHandlers} />
    </View>
  );
});

export default ModelViewer;