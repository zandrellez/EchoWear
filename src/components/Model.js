// hooks/useGloveModel.js
import { useState, useEffect, useRef } from 'react';
import { loadTensorflowModel } from 'react-native-fast-tflite';
import labelMap from '../../assets/models/labels.json'; 

export default function useGloveModel() {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState('Loading model...');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        const loadedModel = await loadTensorflowModel(
          require('../../assets/models/model.tflite')
        );
        console.log('✅ Model loaded successfully');
        setModel(loadedModel);
        setLoading(false);
      } catch (error) {
        console.error('❌ Error loading model:', error);
        setPrediction('Error loading model');
        setLoading(false);
      }
    };

    loadModel();
  }, []);

  useEffect(() => {
    if (!model) return;

    const featureCount = 9; 
    const timesteps = 10; 
    
    const runPrediction = () => {
      try {
        // 🧤 Simulated glove input — replace this with real sensor data later
        const input = new Float32Array(1 * timesteps * featureCount).map(
          () => Math.random()
        );

        const output = model.runSync([input]);
        const predictionTensor = output[0];
        const maxIndex = predictionTensor.indexOf(Math.max(...predictionTensor));
        const predictedLabel = labelMap[maxIndex] || 'Unknown';

        setPrediction(predictedLabel);
      } catch (err) {
        console.error('Error running model:', err);
      }
    };

    intervalRef.current = setInterval(runPrediction, 2000);

    return () => {
      clearInterval(intervalRef.current);
    };
  }, [model]);

  return { prediction, loading, modelReady: !!model };
}
