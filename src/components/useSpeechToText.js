import { useState } from 'react';
import { Alert } from 'react-native';
import {
  useAudioRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const ASSEMBLY_API_KEY = '75181ba65a4948499efb9e49ec310f4d';

export default function useSpeechToText() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);

  let silenceTimer = null;
  let silenceStart = null;

  // 🎤 Start recording
  const startRecording = async () => {
    try {
      const { granted } = await AudioModule.requestRecordingPermissionsAsync();
      console.log('Mic permission:', granted);
      if (!granted) {
        Alert.alert('Permission required', 'Please allow microphone access.');
        return;
      }

      console.log('Starting recording...');
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      console.log('Recording started');

          // start monitoring for silence
    silenceStart = null;
    const checkSilence = async () => {
      if (!recorderState.isRecording) return;

      const status = await recorder.getStatus();
      const rms = status.metering || 0; // metering: approximate loudness

      // adjust threshold as needed (-60 is very quiet)
      if (rms < -55) {
        if (!silenceStart) silenceStart = Date.now();
        else if (Date.now() - silenceStart > 3000) {
          console.log("Silence detected > 3s, stopping...");
          stopRecording();
          return;
        }
      } else {
        silenceStart = null; // reset if sound detected
      }

      silenceTimer = setTimeout(checkSilence, 500);
    };

    checkSilence();
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording.');
    }
  };

  // 🛑 Stop recording
  const stopRecording = async () => {
    try {
      console.log('Stopping recording...');
      if (silenceTimer) clearTimeout(silenceTimer);
      await recorder.stop();

      // ⏳ Wait a moment for the file to finalize
      await new Promise((res) => setTimeout(res, 500));

      const status = await recorder.getStatus();
      console.log('Recording stopped, status:', status);

      const uri = status.url || status.uri;
      console.log('Raw URI:', uri);
      if (!uri) {
        Alert.alert('Error', 'No recording URI found.');
        return;
      }

      // ✅ Ensure "file://" prefix for FileSystem
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      console.log('Normalized URI:', fileUri);

      await sendToAssemblyAI(fileUri);
    } catch (err) {
      console.error('Failed to stop recording', err);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  // ☁️ Upload + transcribe with AssemblyAI
  const sendToAssemblyAI = async (fileUri) => {
    try {
      setLoading(true);
      setTranscript('');

      console.log('Uploading file to AssemblyAI...');
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (!fileInfo.exists) throw new Error('Recording file not found');
      if (fileInfo.size === 0) throw new Error('Recording file is empty');
      console.log('File size:', fileInfo.size);

      // ✅ Read file as base64
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // ✅ Convert base64 → binary using atob and Uint8Array
      const binaryString = global.atob(fileBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // ✅ Upload binary data directly
      const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          authorization: ASSEMBLY_API_KEY,
          'content-type': 'application/octet-stream',
        },
        body: bytes,
      });

      console.log('Upload status:', uploadRes.status);
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const uploadData = await uploadRes.json();
      const uploadUrl = uploadData.upload_url;
      console.log('File uploaded successfully:', uploadUrl);

      // ✅ Request transcription
      const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          authorization: ASSEMBLY_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ audio_url: uploadUrl }),
      });

      const data = await transcriptRes.json();
      console.log('Transcription request sent, ID:', data.id);

      // ✅ Poll until done
      let transcriptData;
      do {
        await new Promise((res) => setTimeout(res, 3000));
        const checkRes = await fetch(
          `https://api.assemblyai.com/v2/transcript/${data.id}`,
          { headers: { authorization: ASSEMBLY_API_KEY } }
        );
        transcriptData = await checkRes.json();
        console.log('Polling status:', transcriptData.status);
      } while (
        transcriptData.status !== 'completed' &&
        transcriptData.status !== 'error'
      );

      if (transcriptData.status === 'error') {
        throw new Error(transcriptData.error || 'Transcription failed on server');
      }

      console.log('Final transcript:', transcriptData.text);
      setTranscript(transcriptData.text);
    } catch (err) {
      console.error('Transcription failed', err);
      Alert.alert('Transcription failed', err.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return {
    startRecording,
    stopRecording,
    transcript,
    loading,
    isRecording: recorderState.isRecording,
  };
}
