import React, { useEffect, useState } from "react";
import { SafeAreaView, Text, Button, StyleSheet } from "react-native";
import { loadTensorflowModel } from "react-native-fast-tflite";

export default function App() {
  const [model, setModel] = useState(null);
  const [output, setOutput] = useState(null);

  useEffect(() => {
    async function loadModel() {
      try {
        // ✅ Load MobileNetV2 example model (bundled asset, not via HTTP)
        const loadedModel = await loadTensorflowModel(
          require("./assets/models/1.tflite")
        );
        setModel(loadedModel);
        console.log("✅ Model loaded successfully.");
      } catch (error) {
        console.error("❌ Failed to load model:", error);
      }
    }
    loadModel();
  }, []);

  const runInference = async () => {
    if (!model) {
      console.warn("Model not loaded yet");
      return;
    }

    try {
      // ✅ Input shape is [1, 224, 224, 3]
      const inputSize = 224 * 224 * 3;
      const input = new Float32Array(inputSize).fill(0.5); // dummy normalized image data

      // ✅ IMPORTANT: wrap input in an array (RN Fast TFLite expects array of inputs)
      const result = await model.run([input]);

      console.log("✅ Model output:", result);
      setOutput(result);
    } catch (err) {
      console.error("❌ Inference error:", err);
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>🧠 Fast TFLite Demo</Text>
      <Button title="Run Inference" onPress={runInference} />
      {output && (
        <Text style={styles.output}>
          Output length: {Array.isArray(output) ? output.length : "?"}
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 20 },
  output: { marginTop: 20, fontSize: 16 },
});