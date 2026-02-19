import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { PanResponder, View, ActivityIndicator } from "react-native";
import { GLView } from "expo-gl";
import { Renderer } from "expo-three";
import * as THREE from "three";
import { Asset } from "expo-asset";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// --- CONFIGURATION ---
// Based on your screenshot, the Right Hand bone should be named this:
const HAND_BONE_NAME = "DEF-f_pinky01R"; 
const TRAIL_LENGTH = 0;   // Number of frames the trail lasts
const TRAIL_COLOR = "#E53935"; 

const ModelViewer = forwardRef(function ModelViewer(
  { source, animationName, animationSpeed = 1, rotationSpeed = 0, offset = { x: 0, y: -1.3 } },
  ref
) {
  const sceneRef = useRef(null);
  const modelRef = useRef(null);
  const mixerRef = useRef(null);
  const actionsRef = useRef({});
  const currentActionRef = useRef();
  const cameraRef = useRef();
  const glRef = useRef(null);

  // --- TRAIL REFS ---
  const trailMeshRef = useRef(null);
  const trailPointsRef = useRef([]); 
  const handBoneRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [glContextCreated, setGlContextCreated] = useState(false);

  const onContextCreate = async (gl) => {
    glRef.current = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0x000000, 0); 

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // --- CAMERA SETUP ---
    const camera = new THREE.PerspectiveCamera(75, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 1000);
    camera.position.set(0, 1.0, 2.2); // Zoomed in slightly
    camera.lookAt(0, 1.0, 0);         // Look at chest area
    cameraRef.current = camera;

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
    frontLight.position.set(0, 2, 5);
    scene.add(frontLight);

    // --- TRAIL INITIALIZATION ---
    // 1. Create geometry buffer for trail points
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(TRAIL_LENGTH * 3); // 3 coords per point (x,y,z)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setDrawRange(0, 0);

    // 2. Create material
    const material = new THREE.LineBasicMaterial({
        color: TRAIL_COLOR,
        linewidth: 5, 
        opacity: 0.8,
        transparent: true,
        depthTest: false // Ensures trail is always visible on top
    });

    // 3. Add Line to Scene
    const trailLine = new THREE.Line(geometry, material);
    trailLine.frustumCulled = false; // Prevent line from disappearing
    scene.add(trailLine);
    trailMeshRef.current = trailLine;


    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      
      if (mixerRef.current) mixerRef.current.update(delta);
      if (modelRef.current && rotationSpeed !== 0) modelRef.current.rotation.y += rotationSpeed;

      // --- TRAIL UPDATE LOGIC ---
      if (handBoneRef.current && trailMeshRef.current && currentActionRef.current?.isRunning() && animationSpeed > 0) {
          // Get Hand Position
          const currentPos = new THREE.Vector3();
          handBoneRef.current.getWorldPosition(currentPos);

          // Add to History
          trailPointsRef.current.push(currentPos);
          if (trailPointsRef.current.length > TRAIL_LENGTH) {
              trailPointsRef.current.shift(); // Remove oldest
          }

          // Update Geometry from History
          const positionsArray = trailMeshRef.current.geometry.attributes.position.array;
          let index = 0;
          for (let i = trailPointsRef.current.length - 1; i >= 0; i--) {
              positionsArray[index++] = trailPointsRef.current[i].x;
              positionsArray[index++] = trailPointsRef.current[i].y;
              positionsArray[index++] = trailPointsRef.current[i].z;
          }

          trailMeshRef.current.geometry.setDrawRange(0, trailPointsRef.current.length);
          trailMeshRef.current.geometry.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    animate();

    setGlContextCreated(true);
  };

  // --- LOAD MODEL ---
  useEffect(() => {
    if (!glContextCreated) return;
    if (!source) { setLoading(false); return; }

    const loadModel = async () => {
      setLoading(true);
      try {
        // Cleanup old model & trail
        if (modelRef.current && sceneRef.current) {
            sceneRef.current.remove(modelRef.current);
            mixerRef.current = null;
            actionsRef.current = {};
            
            // Reset Trail
            trailPointsRef.current = [];
            handBoneRef.current = null;
            if(trailMeshRef.current) trailMeshRef.current.geometry.setDrawRange(0,0);
        }

        // Download Asset
        const asset = Asset.fromModule(source);
        await asset.downloadAsync();
        const uri = asset.localUri || asset.uri;

        // Load GLTF
        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => loader.load(uri, resolve, undefined, reject));
        const model = gltf.scene;

        // --- FIND HAND BONE ---
        let foundHand = false;
        model.traverse((child) => {
            if (child.isBone && child.name === HAND_BONE_NAME) {
                handBoneRef.current = child;
                foundHand = true;
                console.log("Found Trail Bone:", child.name);
            }
        });
        if (!foundHand) console.log(`Note: Bone "${HAND_BONE_NAME}" not found. Trail disabled for this model.`);

        // Setup Model transform
        model.scale.set(1.7, 1.7, 1.7);
        model.position.set(0, 0, 0);
        model.position.y += offset.y;
        if(offset.x) model.position.x += offset.x;

        sceneRef.current.add(model);
        modelRef.current = model;

        // Setup Animations
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

  // --- HANDLE ANIMATION CHANGES ---
  useEffect(() => {
    if (!mixerRef.current || !actionsRef.current || !animationName) return;

    // Clear trail on new animation
    trailPointsRef.current = [];
    if(trailMeshRef.current) trailMeshRef.current.geometry.setDrawRange(0,0);

    const newAction = actionsRef.current[animationName];
    if (newAction) {
        if (currentActionRef.current && currentActionRef.current !== newAction) currentActionRef.current.stop();
        newAction.reset().setLoop(THREE.LoopOnce, 1);
        newAction.clampWhenFinished = true;
        newAction.play();
        currentActionRef.current = newAction;
    } else {
        // Fallback: Play first animation found
        const all = Object.values(actionsRef.current);
        if(all.length > 0 && !currentActionRef.current) {
            all[0].reset().play();
            currentActionRef.current = all[0];
        }
    }
  }, [animationName, loading]);

  useEffect(() => { if (mixerRef.current) mixerRef.current.timeScale = animationSpeed; }, [animationSpeed]);

  // --- EXPOSED METHODS ---
  useImperativeHandle(ref, () => ({
    replay: () => {
      // Clear trail on replay
      trailPointsRef.current = [];
      if(trailMeshRef.current) trailMeshRef.current.geometry.setDrawRange(0,0);

      if (currentActionRef.current) {
        currentActionRef.current.reset().play();
      }
    },
    takeSnapshot: async () => {
      if (glRef.current) {
        const gl = glRef.current;
        
        // 1. Calculate a square crop from the center of the screen
        const width = gl.drawingBufferWidth;
        const height = gl.drawingBufferHeight;
        
        // We want the smallest dimension (usually width) to make a square
        const size = Math.min(width, height); 
        
        // Calculate X and Y to center the square
        const x = (width - size) / 2;
        const y = (height - size) / 2;

        const result = await GLView.takeSnapshotAsync(glRef.current, {
          format: 'png',
          quality: 1,
          result: 'file',
          // 2. THIS IS THE MAGIC FIX: Crop to center square!
          rect: {
             x: x,
             y: y,
             width: size,
             height: size
          }
        });
        
        console.log("📸 Cropped Snapshot saved to:", result.uri);
        return result.uri;
      }
    }
  }));

  // --- TOUCH CONTROLS ---
  const lastTouchDistanceRef = useRef(null);
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2 && cameraRef.current) {
           const [t1, t2] = touches;
           const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
           if (lastTouchDistanceRef.current !== null) {
              const delta = (dist - lastTouchDistanceRef.current) * 0.005; 
              cameraRef.current.position.z -= delta;
           }
           lastTouchDistanceRef.current = dist;
        } else if (touches.length === 1 && modelRef.current) {
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