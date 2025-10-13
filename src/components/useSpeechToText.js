import { Audio } from 'expo-av';
import React, { useState } from 'react';
import { Alert } from 'react-native';

const ASSEMBLY_API_KEY = "75181ba65a4948499efb9e49ec310f4d";

export default function useSpeechToText() {
  const [recording, setRecording] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  // Start recording
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission required", "Please allow microphone access.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  // Stop recording and send to AssemblyAI
  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert("Error", "Failed to get recording file URI.");
        return;
      }

      await sendToAssemblyAI(uri);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  // Upload + transcribe with AssemblyAI
  const sendToAssemblyAI = async (uri) => {
    try {
      setLoading(true);
      setTranscript('');

      // Convert file to blob
      const fileBlob = await (await fetch(uri)).blob();

      // Upload the audio to AssemblyAI
      const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
        method: "POST",
        headers: {
          authorization: ASSEMBLY_API_KEY,
        },
        body: fileBlob,
      });

      const uploadData = await uploadRes.json();
      const uploadUrl = uploadData.upload_url;

      // Request transcription
      const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "POST",
        headers: {
          authorization: ASSEMBLY_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({ audio_url: uploadUrl }),
      });

      const data = await transcriptRes.json();

      // Poll for transcription completion
      let transcriptData;
      do {
        await new Promise((res) => setTimeout(res, 3000));
        const checkRes = await fetch(
          `https://api.assemblyai.com/v2/transcript/${data.id}`,
          { headers: { authorization: ASSEMBLY_API_KEY } }
        );
        transcriptData = await checkRes.json();
      } while (transcriptData.status !== "completed");

      setTranscript(transcriptData.text);
    } catch (err) {
      console.error("Transcription failed", err);
      Alert.alert("Transcription failed", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return {
    startRecording,
    stopRecording,
    transcript,
    loading,
    recording,
  };
}
