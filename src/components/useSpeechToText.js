import { useEffect, useState, useRef } from 'react';
import { Alert } from 'react-native';
import { useAudioRecorder, useAudioRecorderState, AudioModule, RecordingPresets, setAudioModeAsync, } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

const ASSEMBLY_API_KEY = '75181ba65a4948499efb9e49ec310f4d';
const VAD_START_THRESHOLD = -30;
const VAD_KEEP_THRESHOLD = -33;
const NO_VOICE_TIMEOUT_MS = 5000;
const POST_VOICE_SILENCE_MS = 1000;
const VAD_POLL_INTERVAL_MS = 150;
const METER_SMOOTHING_ALPHA = 0.2;

export default function useSpeechToText() {
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder);

  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVADListening, setIsVADListening] = useState(false);

  const vadIntervalRef = useRef(null);
  const startedListeningAtRef = useRef(0);
  const lastVoiceAtRef = useRef(0);
  const hasDetectedVoiceRef = useRef(false);
  const isStoppingRef = useRef(false);
  const hasWarnedMissingMeteringRef = useRef(false);
  const smoothedVolumeRef = useRef(null);

  const clearVADMonitoring = () => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    startedListeningAtRef.current = 0;
    lastVoiceAtRef.current = 0;
    hasDetectedVoiceRef.current = false;
    hasWarnedMissingMeteringRef.current = false;
    smoothedVolumeRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearVADMonitoring();
    };
  }, []);

  const prepareRecorder = async () => {
    const { granted } = await AudioModule.requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Please allow microphone access.');
      return false;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    clearVADMonitoring();
    isStoppingRef.current = false;
    console.log('VAD: preparing microphone...');

    await recorder.prepareToRecordAsync();
    await recorder.record();
    return true;
  };

  // 🎤 Start VAD (Voice Activity Detection)
  const startVAD = async () => {
    try {
      if (isVADListening || recorderState.isRecording || isStoppingRef.current) {
        return;
      }

      const didStart = await prepareRecorder();
      if (!didStart) {
        return;
      }

      setIsVADListening(true);
      console.log('VAD: listening for voice...');

      startedListeningAtRef.current = Date.now();
      lastVoiceAtRef.current = Date.now();
      hasDetectedVoiceRef.current = false;

      vadIntervalRef.current = setInterval(async () => {
        if (isStoppingRef.current) {
          return;
        }

        try {
          const status = await recorder.getStatus();
          if (!status.isRecording) {
            clearVADMonitoring();
            setIsVADListening(false);
            return;
          }

          const rawVolume = status.metering ?? -100;
          const now = Date.now();
          const prevSmoothed = smoothedVolumeRef.current;
          const smoothedVolume =
            prevSmoothed == null
              ? rawVolume
              : prevSmoothed + (rawVolume - prevSmoothed) * METER_SMOOTHING_ALPHA;

          smoothedVolumeRef.current = smoothedVolume;
          console.log('Volume raw:', rawVolume, 'smoothed:', smoothedVolume);

          if (status.metering === undefined && !hasWarnedMissingMeteringRef.current) {
            hasWarnedMissingMeteringRef.current = true;
            console.warn('Recorder metering is unavailable. VAD countdown is using fallback silence values.');
          }

          const speakingNow = hasDetectedVoiceRef.current
            ? smoothedVolume > VAD_KEEP_THRESHOLD
            : smoothedVolume > VAD_START_THRESHOLD;

          if (speakingNow) {
            lastVoiceAtRef.current = now;
            hasDetectedVoiceRef.current = true;
            console.log(
              `VAD: voice detected (${Math.round(smoothedVolume)} dB, keep threshold ${VAD_KEEP_THRESHOLD})`
            );
            return;
          }

          if (!hasDetectedVoiceRef.current) {
            const remainingMs = Math.max(0, NO_VOICE_TIMEOUT_MS - (now - startedListeningAtRef.current));
            console.log(
              `VAD: no voice yet (>${VAD_START_THRESHOLD} dB). Auto stop in ${(remainingMs / 1000).toFixed(1)}s`
            );

            if (remainingMs === 0) {
              console.log('No voice detected in time. Stopping...');
              await stopRecording('No voice detected');
            }
            return;
          }

          const remainingMs = Math.max(0, POST_VOICE_SILENCE_MS - (now - lastVoiceAtRef.current));
          console.log(
            `VAD: silence detected (<${VAD_KEEP_THRESHOLD} dB). Auto stop in ${(remainingMs / 1000).toFixed(1)}s`
          );

          if (remainingMs === 0) {
            console.log('Silence limit reached. Stopping...');
            await stopRecording();
          }
        } catch (err) {
          console.error('VAD monitoring failed', err);
          if (!isStoppingRef.current) {
            await stopRecording();
          }
        }
      }, 150);

    } catch (err) {
      clearVADMonitoring();
      setIsVADListening(false);
      console.error('VAD start failed', err);
    }
  };

  // 🛑 Stop recording
  const stopRecording = async (reason = 'Stopped manually') => {
    if (isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;
    setIsVADListening(false);
    console.log('VAD stop reason:', reason);
    clearVADMonitoring();

    try {
      const currentStatus = await recorder.getStatus();
      if (!currentStatus.isRecording) {
        return;
      }

      await recorder.stop();
      const stoppedStatus = await recorder.getStatus();
      const uri = stoppedStatus.url || stoppedStatus.uri;

      if (uri) {
        const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
        await sendToAssemblyAI(fileUri);
      } else {
        console.warn('Recording stopped without a file URI.');
      }
    } catch (err) {
      console.error('Stop failed', err);
    } finally {
      isStoppingRef.current = false;
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
    startVAD,        // ✅ Exported
    stopRecording,
    transcript,
    loading,
    isRecording: recorderState.isRecording,
    isVADListening,  // ✅ Exported
  };
}
