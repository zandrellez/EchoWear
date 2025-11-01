// useTextToSpeech.js
import { useState } from 'react';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';

export const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = (text) => {
    if (!text || !text.trim()) {
      Alert.alert('Enter text', 'Please provide text to speak.');
      return;
    }

    Speech.speak(text, {
      language: 'en-US',
      pitch: 1.0,
      rate: 1.0,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: (err) => {
        console.error('Speech error:', err);
        setIsSpeaking(false);
      },
    });
  };

  const stop = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  return { speak, stop, isSpeaking };
};
