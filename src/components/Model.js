// ../components/Model.js
import { useState, useEffect, useRef } from 'react';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import labels from '../../assets/algorithm/labels.json';

export default function useGloveModel(gloveData) {
  const modelRef = useRef(null);
  const [prediction, setPrediction] = useState('Loading model...');
  const [modelReady, setModelReady] = useState(false);

  const [confidence, setConfidence] = useState(0);

  const predictionBuffer = useRef([]);
  const BUFFER_SIZE = 5;
  const isInferring = useRef(false);

  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await loadTensorflowModel(
          require('../../assets/echo_model.tflite')
        );
        modelRef.current = loadedModel;
        setPrediction('Ready...');
        setModelReady(true);
      } catch (err) {
        setPrediction('Error loading model');
      }
    };
    loadModel();
  }, []);

  useEffect(() => {
    if (!modelRef.current || !gloveData || gloveData.length === 0) return;
    if (isInferring.current) return;

    const runPrediction = async () => {
      if (!modelRef.current || !gloveData || gloveData.length === 0) return;
      isInferring.current = true;
      
      try {
        // 1. Force exactly 330 numbers into a rigid Float32Array
        // This completely bypasses the buggy TFLite shape detector causing the crash
        const inputTensor = new Float32Array(330);
        
        for (let i = 0; i < 330; i++) {
          const val = Number(gloveData[i]);
          inputTensor[i] = isNaN(val) ? 0 : val;
        }
        
        // 2. Feed the rigid array directly into the model
        const output = await modelRef.current.run([inputTensor]);
        
        // 3. Process output and match with labels
        if (output && output.length > 0 && output[0]) {
          const scores = Array.from(output[0]);
          predictionBuffer.current.push(scores);
          
          if (predictionBuffer.current.length > BUFFER_SIZE) {
            predictionBuffer.current.shift();
          }

          const avgScores = scores.map((_, col) =>
            predictionBuffer.current.reduce((sum, row) => sum + row[col], 0) / predictionBuffer.current.length
          );
          
          const maxVal = Math.max(...avgScores);
          const predIndex = avgScores.indexOf(maxVal);

          setConfidence(Math.round(maxVal * 100));
          
          // 70% confidence threshold
          if (maxVal >= 0.70) {
            setPrediction(labels[predIndex] || 'Unknown');
          } else {
            setPrediction('...');
          }
        }
      } catch (err) {
        console.error('❌ [MODEL] Prediction crash:', err.message);
      } finally {
        isInferring.current = false;
      }
    };

    runPrediction();
  }, [gloveData]);

  return { prediction, confidence, modelReady };
}