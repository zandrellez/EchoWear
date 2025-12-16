// ../components/Model.js
{/*import { useState, useEffect } from 'react';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import labels from '../../assets/models/labels.json';

export default function useGloveModel(gloveData) {
const [model, setModel] = useState(null);
const [prediction, setPrediction] = useState('Loading model...');
const [modelReady, setModelReady] = useState(false);

useEffect(() => {
const loadModel = async () => {
try {
const loadedModel = await loadTensorflowModel(
require('../../assets/models/gesture_model.tflite')
);
setModel(loadedModel);
setPrediction('Model loaded, waiting for data...');
setModelReady(true);
} catch (err) {
console.error('❌ Model load error:', err);
setPrediction('Error loading model');
}
};
loadModel();
}, []);

useEffect(() => {
  if (!model || !gloveData) return;

  if (!(gloveData instanceof Float32Array)) {
    console.log('❌ gloveData is NOT Float32Array:', typeof gloveData);
    return;
  }

  try {
    console.log('📦 Running model with Float32Array...');

    // Run TFLite model
    const rawOutput = model.run([gloveData]);

    // Fast TFLite may wrap output in _data
    const output = rawOutput?._data || rawOutput;

    if (!output) {
      console.log('❌ Output is null or invalid:', rawOutput);
      return;
    }

    console.log('📤 Output:', output);
    console.log('🔢 Output length:', output.length);

    // Prediction index
    const max = Math.max(...output);
    const predIndex = output.indexOf(max);

    console.log('🏆 Max value:', max, 'at index', predIndex);
    setPrediction(labels[predIndex]);

  } catch (err) {
    console.error('❌ Prediction error:', err);
  }
}, [gloveData, model]);


return { prediction, modelReady };
}
*/}
// MOCK MODEL FOR DEMO — Sequential gestures, stops at last gesture
import { useState, useEffect, useRef } from 'react';

export default function useGloveModel(gloveData) {
  const [prediction, setPrediction] = useState("Loading model...");
  const [modelReady, setModelReady] = useState(false);

  // Gesture sequence (no shuffle)
  const gestures = [
    "E", "C", "H", "O", "W", "E", "A", "R", "4",
    "Tall", "Later", "Yesterday", "Tall", "Dimple", "Later"
  ];

  // Sequence index
  const indexRef = useRef(0);

  // Store the last frame to detect motion
  const lastFrameRef = useRef(null);

  // Timestamp of last update to avoid too-rapid changes
  const lastUpdateRef = useRef(0);
  const MIN_INTERVAL = 10000; // 3 seconds minimum between updates

  // Fake model load
  useEffect(() => {
    setTimeout(() => {
      setPrediction("Model loaded, waiting for data...");
      setModelReady(true);
    }, 1500);
  }, []);

  // Detect motion from BLE and update prediction sequentially
  useEffect(() => {
    if (!modelReady || !gloveData) return;

    if (!lastFrameRef.current) {
      lastFrameRef.current = gloveData;
      return;
    }

    // Detect movement by comparing frames
    let diff = 0;
    for (let i = 0; i < gloveData.length; i++) {
      diff += Math.abs(gloveData[i] - lastFrameRef.current[i]);
    }

    // Update the saved frame
    lastFrameRef.current = gloveData;

    // If diff is too small, no motion → no gesture change
    if (diff < 10) return;

    // Prevent updates that are too fast
    if (Date.now() - lastUpdateRef.current < MIN_INTERVAL) return;
    lastUpdateRef.current = Date.now();

    // Sequential prediction
    if (indexRef.current < gestures.length) {
      const gesture = gestures[indexRef.current];
      setPrediction(gesture);
      console.log("🎭 MOCK PREDICTION:", gesture);

      // Move to next gesture, stop at the last one
      indexRef.current += 1;
    }

  }, [gloveData, modelReady]);

  return { prediction, modelReady };
}
