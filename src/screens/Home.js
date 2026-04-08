import React, { useState, useEffect, useRef } from 'react';
import { 
  ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated, ActivityIndicator, Modal, Image, TextInput, Alert, PermissionsAndroid, Platform, Dimensions, StatusBar, FlatList, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Easing
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Constants from "expo-constants";
import useGloveModel from '../components/Model';
import { useTextToSpeech } from '../components/useTextToSpeech';
import useSpeechToText from '../components/useSpeechToText'; 
import { useBluetooth } from '../components/useBluetooth'; 

const STATUSBAR_HEIGHT = Platform.OS === "ios" ? Constants.statusBarHeight : StatusBar.currentHeight || 0;
const BOTTOM_TAB_HEIGHT = 60;

export default function Home() {
  
  const [displayedText, setDisplayedText] = useState('');
  const typingTimerRef = useRef(null);

  const {
    isConnected, isScanning, devices, gloveData,
    scanDevices, connectToDevice, disconnect,
  } = useBluetooth(30, 11, handleIncomingGloveData);

  const [bypassConnection, setBypassConnection] = useState(false);
  const showMainContent = isConnected || bypassConnection;
  const handleIncomingGloveData = (data) => {
    console.log("New Glove Data Received:", data);
  };

  const {
    startVAD, stopRecording,
    transcript, loading, isRecording, isVADListening, 
  } = useSpeechToText();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isTyping, setIsTyping] = useState(false); 

  const [manualText, setManualText] = useState(''); 

  const { speak, stop, isSpeaking } = useTextToSpeech();
  
  // Pass null to prevent the TFLite model crash on string data
  const { prediction, confidence, loading: modelLoading, modelReady } = useGloveModel(null);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  // --- NEW AI STATES ---
  const [isAiThinking, setIsAiThinking] = useState(false);
  const currentTextRef = useRef('');
  const isTranslatedRef = useRef(false);

  // Keep a ref synced so the timer always grabs the latest text
  useEffect(() => {
    currentTextRef.current = displayedText;
  }, [displayedText]);

  // --- GEMINI AI FUNCTION ---
  const fixTextWithAI = async (messyText) => {
    setIsAiThinking(true);
    const apiKey = 'AIzaSyBCKW1RgmkYTH9fPV_eauyejYeSQtaPvZs'; // <--- Put your actual Gemini Key here
    
    const prompt = `I am building an FSL (Filipino Sign Language) translator glove. The sensors are noisy. The input below is a raw sequence of spelled letters, spaces, and full words (like "Sorry" or "No"). 
    - Some letters might be accidentally recognized as full words due to sensor noise. 
    - The grammar might be literal FSL syntax (e.g., "ME LATE" or "HELP YOU").
    Your job is to read this messy sequence, fix the typos, interpret the context, and translate it into a clean, natural English sentence or word. 
    Reply ONLY with the final corrected text. No quotes, no explanations. 
    Raw input: "${messyText}"`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates.length > 0) {
        const cleanText = data.candidates[0].content.parts[0].text.trim();
        console.log("🧠 AI Fixed Text:", cleanText);
        
        setDisplayedText(cleanText); 
        isTranslatedRef.current = true; // <--- ADD THIS: Tell the app the translation is finished!
        
        if (cleanText !== messyText) {
          speak(cleanText);            
        }
      } else {
        console.log("⚠️ AI returned empty/blocked data:", data);
      }

    } catch (error) {
      console.log("❌ AI Error:", error);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Pulse animation for Speech-to-Text
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isRecording]);

  // ==========================================
  // UPDATED AI AUTOCORRECT LOGIC
  // ==========================================
  useEffect(() => {
    if (!gloveData || gloveData === 'null' || gloveData === 'Waiting for data...') return;

    // 1. Handle CLEAR 
    if (gloveData === '*' || gloveData === 'CLEAR') {
      setDisplayedText('');
      isTranslatedRef.current = false;
      stop(); 
      return;
    }

    // 2. Handle DELETE
    if (gloveData === 'DELETE') {
      setDisplayedText(prev => prev.slice(0, -1));
      isTranslatedRef.current = false;
      return;
    }

    // 3. Handle Spelling, Spaces, & Dynamic Signs
    const dynamicSigns = ["Sorry", "No", "Know", "Wait", "Late", "Never", "Bye", "Absent", "Yesterday", "Later", "J", "Z"];
    
    if (isTranslatedRef.current) {
      // IF AI JUST FINISHED, WIPE THE SCREEN AND START THE NEW WORD!
      const newText = gloveData === ' ' ? '' : gloveData;
      setDisplayedText(newText);
      isTranslatedRef.current = false; // Reset the flag
    } else {
      // OTHERWISE, KEEP APPENDING LETTERS NORMALLY
      if (gloveData === ' ') {
        setDisplayedText(prev => prev + ' ');
      } else if (dynamicSigns.includes(gloveData)) {
        setDisplayedText(prev => (prev ? prev + " " + gloveData : gloveData));
      } else {
        setDisplayedText(prev => prev + gloveData);
      }
    }

    // --- AI TRIGGER TIMER ---
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    
    typingTimerRef.current = setTimeout(() => {
      // Only send to AI if there is text AND it hasn't already been translated
      if (currentTextRef.current.trim().length > 0 && !isTranslatedRef.current) {
        console.log("⏱️ User paused! Sending to AI:", currentTextRef.current);
        fixTextWithAI(currentTextRef.current);
      }
    }, 2500); // Increased to 2.5 seconds to give you more breathing room to spell!

  }, [gloveData]);

  // ==========================================
  const handleTextToggle = () => {
    if (isTyping) {
      if (manualText.trim().length > 0) {
        setDisplayedText(manualText.trim());
      }
    }
    setIsTyping((prev) => !prev);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleScanDevices = async () => {
    const canScan = await scanDevices();
    if (canScan) {
      setShowBluetoothModal(true);
    }
  };

  const handleConnectToDevice = (device) => {
    connectToDevice(device);
    setShowBluetoothModal(false);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDeviceMenu(false);
  };

  const handleCloseModal = () => {
    setShowBluetoothModal(false);
  };

  // Helper function to cleanly display what the glove is currently sending
  const getDisplayText = () => {
    if (!isConnected) return "Disconnected";
    if (!gloveData || gloveData === 'null' || gloveData === 'Waiting for data...') {
      return "Start signing...";
    }
    return gloveData;
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
          <View style={{ flex: 1 }}>

            {/* Header */}
            <View style={styles.header}>
              <Image
                source={require("../../assets/echowear.png")}
                style={styles.headerImage}
                resizeMode="contain"
              />
            </View>

            {/* Bluetooth Modal */}
            <Modal visible={showBluetoothModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
              <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Nearby Devices</Text>
                    {isScanning && <ActivityIndicator size="small" color="#E53935" style={{ marginLeft: 8 }} />}
                  </View>

                  {/* Device List */}
                  {devices.length > 0 ? (
                    <FlatList
                      style={{ maxHeight: 250, width: '100%' }}
                      data={devices}
                      keyExtractor={(item) => String(item.id)}
                      contentContainerStyle={{ paddingVertical: 10 }}
                      renderItem={({ item }) => (
                        <View style={styles.deviceItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.deviceName}>{item.name || 'Unnamed Device'}</Text>
                            <Text style={styles.deviceId}>{item.id}</Text>
                          </View>
                          <TouchableOpacity onPress={() => handleConnectToDevice(item)}>
                            <Text style={styles.connectLink}>Connect</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  ) : !isScanning && (
                    <View style={{ alignItems: 'center', marginVertical: 20 }}>
                      <Text style={{ color: '#777', marginBottom: 10 }}>No devices found</Text>
                    </View>
                  )}

                  {/* Footer */}
                  <View style={styles.modalFooter}>
                    {!isScanning && devices.length === 0 && (
                      <TouchableOpacity style={[styles.retryButton, { marginRight: 10 }]} onPress={handleScanDevices}>
                        <Text style={styles.retryButtonText}>Scan Again</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                      <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* Main content */}
            <View style={{flex: 1,}}>
              {!showMainContent ? (
                <>
                  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity onPress={handleScanDevices}
                      style={[styles.connectButton, isConnecting && styles.connectingButton]}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : null}
                      <Text style={styles.connectButtonText}>
                        {isConnecting ? 'Connecting...' : 'Connect to device'}
                      </Text>
                    </TouchableOpacity>

                    {/* Bypass connection option for demo purposes
                    <TouchableOpacity 
                      onPress={() => setBypassConnection(true)}
                      style={{ alignSelf: 'center', marginBottom: 20 }}
                    >
                      <Text style={{ color: '#888', textDecorationLine: 'underline' }}>
                        Bypass connection (Demo Mode)
                      </Text>
                    </TouchableOpacity>
                     */}  

                    <View style={[styles.messageCard, { flex: 4 }]}>
                      <View style={styles.textLinesContainer}>
                        <View style={styles.shortTextLine} />
                        <View style={styles.longTextLine} />
                        <View style={styles.mediumTextLine} />
                      </View>
                      <View style={styles.avatarPlaceholder} />
                    </View>
                    <View style={[styles.messageCard, { flex: 4 }]}>
                      <View style={styles.textLinesContainer}>
                        <View style={styles.mediumTextLine} />
                        <View style={styles.longTextLine} />
                        <View style={styles.shortTextLine} />
                      </View>
                      <View style={styles.avatarPlaceholder} />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    {/* Device Card */}
                    <View style={[styles.deviceCard, { flex: 1 }]}>
                      <Image source={require('../../assets/glove.png')}
                        style={styles.deviceImage}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceTitle}>
                          <Text style={{ fontWeight: 'bold' }}>
                            {bypassConnection ? "Demo Mode" : "EchoWear Glove"}
                          </Text>{' '}
                        </Text>

                        <View style={styles.deviceStatusRow}>
                          <Ionicons name="battery-half" size={18} color="#333" />
                          <Text style={styles.deviceBattery}>
                            {bypassConnection ? "N/A" : "75%"}
                          </Text>
                          <Text style={[styles.deviceConnected, { color: showMainContent ? '#4CAF50' : '#F57C00' }]}>
                            {bypassConnection ? 'Bypassed' : 'Connected'}
                          </Text>
                        </View>
                      </View>

                      {/* Ellipsis menu and Rotation trigger container */}
                      <View style={{ position: 'relative', flexDirection: 'row', alignItems: 'center' }}>
                        
                        <TouchableOpacity onPress={() => setIsFlipped(!isFlipped)}
                          style={{ marginRight: 15 }} 
                        >
                          <MaterialIcons name={isFlipped ? "screen-rotation" : "stay-primary-portrait"}  size={24} color="#E53935"/>
                        </TouchableOpacity>
                        
                        <TouchableOpacity onPress={() => setShowDeviceMenu(!showDeviceMenu)}>
                          <Ionicons name="ellipsis-vertical" size={22} color="#333" />
                        </TouchableOpacity>                      

                        {showDeviceMenu && (
                          <View style={styles.dropdownMenu}>
                            {isConnected ? (
                              <TouchableOpacity
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setShowDeviceMenu(false);
                                  handleDisconnect();
                                }}
                              >
                                <Text style={styles.dropdownText}>Disconnect</Text>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity
                                style={styles.dropdownItem}
                                onPress={() => {
                                  setShowDeviceMenu(false);
                                  handleScanDevices(); 
                                }}
                              >
                                <Text style={styles.dropdownText}>Reconnect</Text>
                              </TouchableOpacity>
                            )}

                          </View>
                        )}
                      </View>
                    </View>

                    {/* Translation Card */}
                    <View style={[styles.translationCard, { flex: 4 }, isFlipped && { transform: [{ rotate: '180deg' }] }]}>
                      <View style={styles.translationTextContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={styles.translationText}>FSL to Speech</Text>
                        </View>
                        
                        {/* Wrap the display text in a ScrollView */}
                        <ScrollView 
                          style={{ width: '100%', maxHeight: '80%' }} 
                          contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-start' }}
                          showsVerticalScrollIndicator={true}
                        >
                          <Text style={[styles.translationPrompt, { fontSize: 32, marginTop: 10, color: isAiThinking ? '#ffbaba' : '#fff' }]}>
                            {isAiThinking 
                              ? "✨ Translating..." 
                              : (displayedText || "Start spelling...")}
                          </Text>
                        </ScrollView>
                      </View>
                      
                      {/* Replay Button remains at the bottom right */}
                      <TouchableOpacity
                        style={styles.translationPlayButton}
                        onPress={() => {
                          if (isRecording) {
                            Alert.alert('Microphone Active', 'Please wait for the other person to finish speaking.');
                            return;
                          }
                          if (displayedText) {
                            speak(displayedText); 
                          }
                        }}
                        disabled={isSpeaking || isRecording} 
                      >
                        <Ionicons name="volume-high" size={32} color={isRecording ? "#ccc" : "#E53935"} />
                      </TouchableOpacity>
                    </View>


                    {/* Speech to Text Card */}
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      onPress={() => {
                        if (isSpeaking) {
                          Alert.alert('Translating', 'Please wait...');
                          return;
                        }
                        isVADListening ? stopRecording() : startVAD();
                      }}
                      style={[styles.speechCard, { flex: 4 }, isVADListening && styles.activeSpeechCard]}
                    >
                      <View style={styles.speechTextContainer}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={styles.speechTitle}>Speech to Text</Text>
                          
                          {isVADListening && (
                            <View style={styles.recordingIndicator}>
                              <Animated.View style={[styles.redDot, { opacity: scaleAnim }]} />
                              <Text style={styles.liveText}>Speaking</Text>
                            </View>
                          )}
                        </View>

                        {isTyping ? (
                          <TextInput
                            style={styles.textInput}
                            placeholder="Type your text here..."
                            value={manualText}
                            onChangeText={setManualText}
                            autoFocus
                            multiline
                          />
                        ) : (
                          <Text style={styles.speechPrompt}>
                            {loading
                              ? 'Transcribing...'
                              : isVADListening 
                                ? 'Listening for voice...'
                                : transcript || 'Tap mic to start'}
                          </Text>
                        )}
                      </View>

                      <View style={styles.rightColumn}>
                        <TouchableOpacity onPress={handleTextToggle} style={{ marginBottom: 10 }}>
                          <MaterialIcons
                            name="text-fields"
                            size={28}
                            color={isTyping ? '#E53935' : 'gray'}
                          />
                        </TouchableOpacity>

                        {!keyboardVisible && !isTyping && (
                          <Animated.View
                            style={[
                              styles.micButtonAnimated,
                              {
                                transform: [{ scale: scaleAnim }],
                                shadowOpacity: isVADListening ? 0.9 : 0.3,
                                backgroundColor: isVADListening ? '#E53935' : '#888',
                                elevation: isVADListening ? 12 : 4,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={() => {
                                if (isSpeaking) {
                                  Alert.alert('Translating', 'Please wait until the translation finishes speaking.');
                                  return;
                                }
                                isVADListening ? stopRecording() : startVAD();
                              }}
                              disabled={loading || isSpeaking} 
                            >
                              <Ionicons
                                name={isVADListening ? 'stop' : 'mic'}
                                size={32}
                                color="white"
                              />
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </View>              
                </> 
              )}

            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff", paddingTop: STATUSBAR_HEIGHT },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: BOTTOM_TAB_HEIGHT },
  header: { height: 60, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eee", elevation: 3 },
  headerImage: { width: 160, height: 45 },
  deviceItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 12, paddingHorizontal: 4 },
  deviceName: { fontSize: 16, fontWeight: '500', color: '#222' },
  deviceId: { fontSize: 12, color: '#888', marginTop: 2 },
  connectLink: { fontSize: 14, fontWeight: '600', color: '#E53935' },
  retryButton: { backgroundColor: '#E53935', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  retryButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  connectButton: { backgroundColor: '#E53935', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 25, paddingHorizontal: 20, borderRadius: 8, marginBottom: 20 },
  connectingButton: { backgroundColor: '#c62828' },
  connectButtonText: { color: 'white', fontSize: 19, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: 'white', borderRadius: 16, paddingVertical: 24, paddingHorizontal: 24, width: '80%', alignItems: 'stretch', elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', marginBottom: 12 },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', width: '100%', marginTop: 16 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#E53935' },
  modalText: { fontSize: 16, color: '#333', textAlign: 'center' },
  closeButton: { backgroundColor: 'white', borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10 },
  closeButtonText: { color: '#E53935', fontWeight: 'bold', fontSize: 14 },
  messageCard: { backgroundColor: '#f0f0f0', borderRadius: 12, padding: 22, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 250, position: 'relative' },
  textLinesContainer: { flex: 1, marginRight: 16, alignItems: 'flex-start', justifyContent: 'flex-start' },
  shortTextLine: { backgroundColor: '#d0d0d0', height: 14, borderRadius: 4, marginBottom: 15, width: '50%' },
  mediumTextLine: { backgroundColor: '#d0d0d0', height: 14, borderRadius: 4, marginBottom: 15, width: '75%' },
  longTextLine: { backgroundColor: '#d0d0d0', height: 14, borderRadius: 4, marginBottom: 15, width: '90%' },
  deviceCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: "#fff", marginHorizontal: 15, marginVertical: 8, borderRadius: 12, padding: 16, elevation: 3, flexShrink: 1 },
  deviceImage: { width: 50, height: 50 },
  deviceTitle: { fontSize: 18, marginBottom: 6 },
  deviceStatusRow: { flexDirection: 'row', alignItems: 'center' },
  deviceBattery: { marginLeft: 6, marginRight: 10, color: '#333', fontWeight: '500' },
  deviceConnected: { color: '#E53935', fontWeight: '500' },
  dropdownMenu: { position: "absolute", top: 28, right: 0, backgroundColor: "white", borderRadius: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4, minWidth: 140, zIndex: 100 },
  dropdownItem: { paddingVertical: 10, paddingHorizontal: 14 },
  dropdownText: { fontSize: 16, color: "#E53935", fontWeight: "500" },
  translationCard: { backgroundColor: "#E53935", marginHorizontal: 15, marginVertical: 8, borderRadius: 12, padding: 16, elevation: 3, position: "relative", alignItems: 'flex-start' },
  translationTextContainer: { alignItems: 'flex-start', justifyContent: 'flex-start', flexShrink: 1, width: '100%' },
  translationText: { color: 'white', fontSize: 18, textAlign: 'left', fontWeight: 'bold' },
  translationPrompt: { color: '#fff', fontSize: 24, marginBottom: 4, textAlign: 'left', fontStyle: 'italic' },
  accuracyText: { color: '#fff', fontSize: 14, opacity: 0.9, fontWeight: '500', marginBottom: 14 },
  translationPlayButton: { position: 'absolute', right: 20, bottom: 20, backgroundColor: 'white', borderRadius: 32, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  speechCard: { backgroundColor: "#fff", marginHorizontal: 15, marginTop: 8, marginBottom: 15, borderRadius: 12, padding: 16, elevation: 3, position: "relative", alignItems: 'flex-start' },
  activeSpeechCard: { borderColor: '#E53935', borderWidth: 1 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', marginLeft: 10, backgroundColor: '#FFEBEE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935', marginRight: 6 },
  liveText: { fontSize: 10, fontWeight: 'bold', color: '#E53935' },
  speechTextContainer: { flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start' },
  speechTitle: { color: '#E53935', fontWeight: 'bold', fontSize: 20, marginBottom: 8 },
  speechPrompt: { color: '#888', fontSize: 24, marginBottom: 18 },
  micButtonAnimated: { backgroundColor: '#E53935', borderRadius: 32, width: 60, height: 60, justifyContent: 'center', alignItems: 'center', shadowColor: '#E53935' },
  textInput: { fontSize: 24, borderBottomWidth: 1, borderColor: "#ddd", color: "#333", paddingVertical: 6, marginBottom: 16, width: "100%" },
  rightColumn: { position: "absolute", right: 16, bottom: 16, alignItems: "center" }
});