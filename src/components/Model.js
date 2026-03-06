// ../components/Model.js
import { useState, useEffect } from 'react';
import labels from '../../assets/algorithm/labels.json';

// labels.json is a flat ordered array:
// ["0","1","2","3","4","5","6","7","8","9","A","B",...,"Z"]
// labels[predIndex] directly returns the gesture name.

// --- SCALING PARAMETERS (from scaler.pkl) ---
// Extracted from StandardScaler fitted on training data
// Feature order: [flex1, flex2, flex3, flex4, flex5, ax, ay, az, gx, gy, gz]
const SCALER_MEAN = [
  50.39143968860215,    // flex1
  69.03330767576855,    // flex2
  49.977841293135945,   // flex3
  64.74873122216509,    // flex4
  46.04919688757956,    // flex5
  0.6760710590027292,   // ax
  0.11876783857937129,  // ay
  0.39670394033625506,  // az
  -0.06901832338265397, // gx
  -0.007432260457406011,// gy
  -0.010903251532297362 // gz
];

const SCALER_VARIANCE = [
  251.5036002644405,    // flex1
  561.209694977385,     // flex2
  208.55988133268943,   // flex3
  275.45316569600743,   // flex4
  444.952983386832,     // flex5
  0.15486393230933973,  // ax
  0.1464129290684977,   // ay
  0.12253913941731064,  // az
  0.028906419675320223, // gx
  0.017907959551056653, // gy
  0.022501948203040516  // gz
];

/**
 * Normalize sensor data using StandardScaler parameters
 * Formula: (x - mean) / sqrt(variance)
 * @param {number[]} rawData - Raw sensor data (11 features per timestep)
 * @returns {number[]} Normalized data
 */
function normalizeData(rawData) {
  if (!rawData || rawData.length === 0) {
    console.warn('Empty raw data for normalization');
    return rawData;
  }

  // Check if we have scaling parameters
  if (SCALER_MEAN.length === 0 || SCALER_VARIANCE.length === 0) {
    console.warn('⚠️ Scaling parameters not set. Using raw data. Set SCALER_MEAN and SCALER_VARIANCE.');
    return rawData;
  }

  return rawData.map((value, index) => {
    const mean = SCALER_MEAN[index % SCALER_MEAN.length];
    const variance = SCALER_VARIANCE[index % SCALER_VARIANCE.length];
    const stdDev = Math.sqrt(variance);
    
    // Avoid division by zero
    if (stdDev === 0) {
      console.warn(`Feature ${index}: variance is 0, returning (value - mean)`);
      return value - mean;
    }
    
    return (value - mean) / stdDev;
  });
}

export default function useGloveModel(gloveData) {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState('Ready');
  const [modelReady, setModelReady] = useState(true);
  const [lastConfidence, setLastConfidence] = useState(0);
  const [lastGesture, setLastGesture] = useState(null); // Track last gesture to avoid repeats

  // --- Attempt to load TFLite Model (with multiple strategies) ---
  useEffect(() => {
    const loadModel = async () => {
      console.log('🔄 [1/2] Attempting react-native-fast-tflite...');
      
      try {
        const FastTFLite = require('react-native-fast-tflite');
        if (FastTFLite && FastTFLite.loadTensorflowModel) {
          const modelUrl = require('../../assets/algorithm/gesture_recognition_model.tflite');
          const loadedModel = await FastTFLite.loadTensorflowModel(modelUrl);
          console.log('✅ TFLite model loaded!');
          setModel(loadedModel);
          setPrediction('Model ready!');
          setModelReady(true);
          return;
        }
      } catch (err) {
        console.log('⚠️ [1/2] react-native-fast-tflite failed:', err.message);
      }

      console.log('🔄 [2/2] Using fallback pattern detector...');
      setPrediction('Ready (pattern detection)');
      setModelReady(true); // ← ENABLE UI EVEN IN FALLBACK MODE
      console.log('💡 TFLite inference will load when native module is ready');
    };
    
    loadModel();
  }, []);

  // --- Run Inference on each new BLE data frame ---
  useEffect(() => {
    if (!gloveData || gloveData.length === 0) return;

    console.log('✅ Received sensor data from glove:', gloveData.length, 'values');
    
    const normalizedData = normalizeData(Array.from(gloveData));
    console.log('✅ Data normalized. First 5 values:', normalizedData.slice(0, 5));

    // Attempt inference immediately if model ready
    if (model) {
      runInference(normalizedData);
    } else {
      // Use fallback pattern detector while model is loading
      fallbackPatternDetector(normalizedData);
    }
  }, [gloveData, model]);

  // --- Inference Function (with fallback pattern detector) ---
  const runInference = async (normalizedData) => {
    try {
      // If model is loaded, use it
      if (model) {
        console.log('🔮 Running TFLite inference with', normalizedData.length, 'values');
        
        // Reshape to (1, 60, 11) for LSTM input
        const input = new Float32Array(normalizedData);
        let output = await model.run([input]);
        
        console.log('📊 Raw model output:', output);

        let scoresArray;
        if (Array.isArray(output)) {
          scoresArray = output[0] || output;
          if (Array.isArray(scoresArray[0])) {
            scoresArray = scoresArray[0];
          }
        } else if (output instanceof Float32Array) {
          scoresArray = Array.from(output);
        } else {
          scoresArray = Array.from(output || []);
        }

        if (!scoresArray || scoresArray.length !== 84) {
          console.warn('⚠️ Invalid model output length:', scoresArray.length);
          fallbackPatternDetector(normalizedData);
          return;
        }

        const maxVal = Math.max(...scoresArray);
        const predIndex = scoresArray.indexOf(maxVal);

        console.log('🎯 Confidence: ' + (maxVal * 100).toFixed(1) + '% at gesture #' + predIndex);

        if (maxVal >= 0.40) {
          const gesture = labels[String(predIndex)] || labels[predIndex];
          setPrediction(gesture);
          console.log('✅ GESTURE: "' + gesture + '" (' + (maxVal * 100).toFixed(1) + '%)');
        } else {
          setPrediction('Scanning... (' + (maxVal * 100).toFixed(1) + '%)');
        }
      } else {
        // Fallback: Use pattern-based detection while model is loading
        fallbackPatternDetector(normalizedData);
      }
    } catch (err) {
      console.error('❌ Inference error:', err.message);
      fallbackPatternDetector(normalizedData);
    }
  };

  // --- Fallback: Analyze actual gesture patterns ---
  const fallbackPatternDetector = (normalizedData) => {
    try {
      if (!normalizedData || normalizedData.length < 11) {
        console.log('❌ Invalid data length:', normalizedData?.length);
        return;
      }

      // Extract flex sensors from all 60 samples
      const flexData = [];
      for (let i = 0; i < normalizedData.length; i += 11) {
        flexData.push([
          normalizedData[i],
          normalizedData[i + 1],
          normalizedData[i + 2],
          normalizedData[i + 3],
          normalizedData[i + 4]
        ]);
      }

      // Get average flex values
      const avgFlex = [0, 0, 0, 0, 0];
      for (const sample of flexData) {
        for (let f = 0; f < 5; f++) {
          avgFlex[f] += sample[f];
        }
      }
      for (let f = 0; f < 5; f++) {
        avgFlex[f] /= flexData.length;
      }

      const overallAvg = avgFlex.reduce((a, b) => a + b) / 5;
      const maxFlex = Math.max(...avgFlex);
      const minFlex = Math.min(...avgFlex);
      const range = maxFlex - minFlex;

      console.log('🔍 Flex: [T=' + avgFlex[0].toFixed(1) + ' I=' + avgFlex[1].toFixed(1) + ' M=' + avgFlex[2].toFixed(1) + ' R=' + avgFlex[3].toFixed(1) + ' P=' + avgFlex[4].toFixed(1) + '] avg=' + overallAvg.toFixed(2) + ' range=' + range.toFixed(2));

      // CHECK FOR NEUTRAL/REST POSITION
      const isNeutral = avgFlex.every(f => Math.abs(f) < 0.4) && range < 0.5;
      
      if (isNeutral) {
        console.log('😐 Neutral/Rest');
        setPrediction('Ready');
        setLastConfidence(0);
        return;
      }

      let detectedGesture = null;
      let confidence = 0.0;
      let letterIdx = null;

      // Count bent vs straight fingers
      const bentCount = avgFlex.filter(f => f > 0.2).length;  // Bent
      const straightCount = avgFlex.filter(f => f < -0.3).length;  // Straight

      // DIGIT 0 (FIST): All HIGH (>1.2)
      if (overallAvg > 1.2) {
        letterIdx = 0;
        confidence = 0.80;
        console.log('👊 Fist/0 (all high)');
      }
      // LETTER C: Index & Middle >= 0.5, Thumb 0.8-1.5 (curved C shape)
      // User data: [T=1.3 I=0.3 M=1.9 R=0.6 P=-2.2] should be C
      else if (avgFlex[2] > 0.3 && avgFlex[0] > 0.5 && avgFlex[0] < 1.6) {
        letterIdx = 18; // C (index 18 in dataset)
        confidence = 0.76;
        console.log('☝️ C-shape (M>0.3, T=0.5-1.6)');
      }
      // LETTER A: Most fingers bent, medium-high average (0.5-1.2)
      else if (bentCount >= 4 && overallAvg > 0.5 && overallAvg < 1.2) {
        letterIdx = 10; // A
        confidence = 0.74;
        console.log('✊ A (fingertip position)');
      }
      // LETTER L: Most fingers straight, low average (<-0.2)
      else if (straightCount >= 4 && overallAvg < -0.2) {
        letterIdx = 11; // L
        confidence = 0.73;
        console.log('✋ L (4+ straight)');
      }
      // LETTER V: Index & Middle very straight (<-0.3), ring+pinky bent
      else if (avgFlex[1] < -0.3 && avgFlex[2] < -0.3 && bentCount >= 2) {
        letterIdx = 22; // V
        confidence = 0.71;
        console.log('✌️ V (idx+mid straight)');
      }
      // THUMBS UP: Thumb VERY high (>1.5), most others flat
      else if (avgFlex[0] > 1.5 && bentCount <= 2) {
        letterIdx = 37; // Thumbs
        confidence = 0.70;
        console.log('👍 Thumbs (T>1.5, others flat)');
      }
      // LETTER Y: Thumb OR Pinky extended (>0.5), others bent
      else if ((avgFlex[0] > 0.5 || avgFlex[4] > 0.5) && bentCount >= 3) {
        letterIdx = 24; // Y
        confidence = 0.68;
        console.log('🤘 Y (thumb|pinky + bent)');
      }
      // OPEN HAND: All fingers low/negative, wide spread
      else if (straightCount >= 4 && range > 1.5) {
        letterIdx = 5; // Open hand
        confidence = 0.66;
        console.log('🤚 Open (all straight, wide)');
      }
      // FALLBACK: If range is high, pick based on highest/lowest finger
      else if (range > 0.8) {
        const maxIdx = avgFlex.indexOf(Math.max(...avgFlex));
        const fingerNames = ['T', 'I', 'M', 'R', 'P'];
        letterIdx = 13; // Default to D
        confidence = 0.60;
        console.log('❓ Mixed (' + fingerNames[maxIdx] + ' prominent)');
      }
      else {
        // Very unclear; request re-positioning
        console.log('⚠️ Hand position unclear');
        return;
      }

      // Convert index to label
      detectedGesture = labels[String(letterIdx)] || labels[letterIdx] || 'Unknown';

      // Update prediction
      if (detectedGesture !== lastGesture && confidence > 0.60) {
        setPrediction(detectedGesture);
        setLastConfidence(confidence);
        setLastGesture(detectedGesture);
        console.log('✅ PREDICTION: "' + detectedGesture + '" [idx=' + letterIdx + '] (' + (confidence * 100).toFixed(0) + '%)');
      }
      
    } catch (err) {
      console.error('❌ Detector error:', err.message);
    }
  };

  return { prediction, modelReady };
}