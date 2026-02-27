// ../components/Model.js
import { useState, useEffect } from 'react';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import labels from '../../assets/algorithm/labels.json';

// labels.json is a flat ordered array:
// ["0","1","2","3","4","5","6","7","8","9","A","B",...,"Z"]
// labels[predIndex] directly returns the gesture name.

export default function useGloveModel(gloveData) {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState('Loading model...');
  const [modelReady, setModelReady] = useState(false);

  // --- Load TFLite Model ---
  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await loadTensorflowModel(
          require('../../assets/algorithm/echowear_model.tflite')
        );
        console.log('Model loaded. Classes:', labels.length);
        setModel(loadedModel);
        setPrediction('Model loaded, waiting for data...');
        setModelReady(true);
      } catch (err) {
        console.error('Model load error:', err);
        setPrediction('Error loading model');
      }
    };
    loadModel();
  }, []);

  // --- Run Inference on each new BLE data frame ---
  useEffect(() => {
    if (!model || !gloveData) return;

    const runPrediction = async () => {
      try {
        // 1. Run inference - try array format, fallback to object format
        let output;
        try {
          output = await model.run([gloveData]);
        } catch (runErr) {
          console.warn('Array format failed, trying object format:', runErr.message);
          output = await model.run({ input: gloveData });
        }

        // 2. Unwrap output shape: [scores] or [[scores]] -> flat scores array
        let scores = output;
        if (Array.isArray(scores) && scores.length === 1) {
          scores = scores[0];
          if (Array.isArray(scores) && scores.length === 1) {
            scores = scores[0];
          }
        }
        const scoresArray = Array.isArray(scores) ? scores : Array.from(scores || []);

        if (!scoresArray || scoresArray.length === 0) {
          console.warn('Empty model output');
          return;
        }

        // 3. Guard against NaN / Infinity
        const hasInvalid = scoresArray.some((v) => !isFinite(v));
        if (hasInvalid) {
          console.warn('Model returned NaN/Inf - check input normalization');
          setPrediction('Model error: invalid output');
          return;
        }

        // 4. Get the class with highest confidence
        const maxVal = Math.max(...scoresArray);
        const predIndex = scoresArray.indexOf(maxVal);

        if (predIndex < 0 || predIndex >= labels.length) {
          console.warn('predIndex out of bounds:', predIndex, '(labels:', labels.length + ')');
          setPrediction('Model error: label mismatch');
          return;
        }

        // 5. Apply confidence threshold
        //    Lowered from 0.50 to 0.40 to account for real-world sensor noise
        if (maxVal >= 0.40) {
          const gesture = labels[predIndex]; // FIX: labels is now an array, this works correctly
          setPrediction(gesture);
          console.log('Predicted: "' + gesture + '" (' + (maxVal * 100).toFixed(1) + '%)');
        } else {
          setPrediction('Scanning...');
          console.log('Low confidence: ' + (maxVal * 100).toFixed(1) + '% -> index ' + predIndex);
        }
      } catch (err) {
        console.error('Prediction error:', err.message);
        setPrediction('Model error: ' + (err.message || 'unknown'));
      }
    };

    runPrediction();
  }, [gloveData, model]);

  return { prediction, modelReady };
}