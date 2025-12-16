import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  Dimensions,
  StatusBar,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Easing
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Constants from "expo-constants";

import useGloveModel from '../components/Model';
import { useTextToSpeech } from '../components/useTextToSpeech';
import useSpeechToText from '../components/useSpeechToText'; 
import { useBluetooth} from '../components/useBluetooth'; 
import { Buffer } from "buffer";

const { width } = Dimensions.get("window");
const STATUSBAR_HEIGHT = Platform.OS === "ios" ? Constants.statusBarHeight : StatusBar.currentHeight || 0;
const HEADER_HEIGHT = 60;
const BOTTOM_TAB_HEIGHT = 60;

export default function Home() {

  const {
    isConnected,
    selectedDevice,
    isScanning,
    devices,
    gloveData,
    scanDevices,
    connectToDevice,
    disconnect,
  } = useBluetooth();

  const {
    startRecording,
    stopRecording,
    transcript,
    loading,
    isRecording,
  } = useSpeechToText();

  const insets = useSafeAreaInsets();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const { speak, stop, isSpeaking } = useTextToSpeech();
  const { prediction, loading: modelLoading, modelReady } = useGloveModel(gloveData);

  const [isTyping, setIsTyping] = useState(false); 
  const [manualText, setManualText] = useState(''); 
  const [displayedText, setDisplayedText] = useState('');

  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
                  {/* Header */}
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
              {!isConnected ? (
                <>
                  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <TouchableOpacity
                      style={[styles.connectButton, isConnecting && styles.connectingButton]}
                      onPress={handleScanDevices}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : null}
                      <Text style={styles.connectButtonText}>
                        {isConnecting ? 'Connecting...' : 'Connect to device'}
                      </Text>
                    </TouchableOpacity>

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
                      <Image
                        source={require('../../assets/glove.png')}
                        style={styles.deviceImage}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceTitle}>
                          <Text style={{ fontWeight: 'bold' }}>EchoWear Glove</Text>{' '}
                          <Text style={{ fontWeight: 'bold', color: '#E53935' }}></Text>
                        </Text>

                        <View style={styles.deviceStatusRow}>
                          <Ionicons name="battery-half" size={18} color="#333" />
                          <Text style={styles.deviceBattery}>75%</Text>
                          <Text style={[styles.deviceConnected, { color: isConnected ? '#4CAF50' : '#E53935' }]}>
  {isConnected ? 'Connected' : 'Disconnected'}
</Text>

                        </View>
                      </View>

                      {/* Ellipsis menu trigger */}
                      <View style={{ position: 'relative' }}>
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
                                  handleScanDevices(); // reconnect if disconnected
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
                    <View style={[styles.translationCard, { flex: 4 }]}>
                      <View style={styles.translationTextContainer}>
                        <Text style={styles.translationText}>FSL to Speech</Text>
                        <Text style={styles.translationPrompt}>
                          {modelReady ? prediction : 'Loading model...'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.translationPlayButton}
                        onPress={() => {
                          if (prediction && !modelLoading) {
                            speak(prediction);
                          } else {
                            Alert.alert('Nothing to speak', 'No translation available yet.');
                          }
                        }}
                        disabled={isSpeaking}
                      >
                        <Ionicons name="play" size={32} color="#E53935" />
                      </TouchableOpacity>
                    </View>


                    {/* Speech to Text Card */}
                    <View style={[styles.speechCard, { flex: 4 }]}>
                      <View style={styles.speechTextContainer}>
                        <Text style={styles.speechTitle}>Speech to Text</Text>

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
                              : transcript || displayedText || 'Press the button to start voice recognition'}
                          </Text>
                        )}
                      </View>

                      <View style={styles.rightColumn}>
                        {/* Toggle Text Input */}
                        <TouchableOpacity onPress={handleTextToggle} style={{ marginBottom: 10 }}>
                          <MaterialIcons
                            name="text-fields"
                            size={28}
                            color={isTyping ? '#E53935' : 'gray'}
                          />
                        </TouchableOpacity>

                        {/* Mic Button */}
                        {!keyboardVisible && !isTyping && (
                          <Animated.View
                            style={[
                              styles.micButtonAnimated,
                              {
                                transform: [{ scale: scaleAnim }],
                                shadowOpacity: isRecording ? 0.9 : 0.3,
                                shadowRadius: isRecording ? 12 : 6,
                                elevation: isRecording ? 12 : 4,
                              },
                            ]}
                          >
                            <TouchableOpacity
                              onPress={isRecording ? stopRecording : startRecording}
                              disabled={loading}
                            >
                              <Ionicons
                                name={isRecording ? 'stop' : 'mic'}
                                size={32}
                                color="white"
                              />
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </View>
                    </View>


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
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: STATUSBAR_HEIGHT,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: BOTTOM_TAB_HEIGHT,
  },
  header: {
    height: 60,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    elevation: 3,
  },
  headerImage: {
    width: 160,
    height: 45,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
  },
  deviceId: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  connectLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E53935', 
  },
  retryButton: {
    backgroundColor: '#E53935',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectButton: {
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 25,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  connectingButton: {
    backgroundColor: '#c62828',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 19,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    width: '80%',
    alignItems: 'stretch',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E53935',
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  closeButton: {
    backgroundColor: 'white',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  closeButtonText: {
    color: '#E53935',
    fontWeight: 'bold',
    fontSize: 14,
  },
  messageCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 22,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start', 
    justifyContent: 'space-between', 
    minHeight: 250,
    position: 'relative', 
  },
  textLinesContainer: {
    flex: 1,
    marginRight: 16,
    alignItems: 'flex-start', 
    justifyContent: 'flex-start', 
  },
  shortTextLine: {
    backgroundColor: '#d0d0d0',
    height: 14,
    borderRadius: 4,
    marginBottom: 15,
    width: '50%',
  },
  mediumTextLine: {
    backgroundColor: '#d0d0d0',
    height: 14,
    borderRadius: 4,
    marginBottom: 15,
    width: '75%',
  },
  longTextLine: {
    backgroundColor: '#d0d0d0',
    height: 14,
    borderRadius: 4,
    marginBottom: 15,
    width: '90%',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
  flexShrink: 1, 
  },
  deviceImage: {
    width: 50,
    height: 50,
  },
  deviceTitle: {
    fontSize: 18,
    marginBottom: 6,
  },
  deviceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceBattery: {
    marginLeft: 6,
    marginRight: 10,
    color: '#333',
    fontWeight: '500',
  },
  deviceConnected: {
    color: '#E53935',
    fontWeight: '500',
  },
  deviceConnectButton: {
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceConnectButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  dropdownMenu: {
    position: "absolute",
    top: 28,  
    right: 0,   
    backgroundColor: "white",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 140,
    zIndex: 100,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownText: {
    fontSize: 16,
    color: "#E53935",
    fontWeight: "500",
  },
  translationCard: {
    backgroundColor: "#E53935",
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    position: "relative",
    alignItems: 'flex-start'
  },
  translationTextContainer: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexShrink: 1, 
  },
  translationText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'left',
    fontWeight: 'bold',
  },
  translationPrompt: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 18,
    textAlign: 'left',
    fontStyle: 'italic',
  },
  translationPlayButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: 'white',
    borderRadius: 32,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  speechCard: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 15,
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    position: "relative",
    alignItems: 'flex-start'
  },
  speechTextContainer: {
    flex: 1,
    alignItems: 'flex-start', 
    justifyContent: 'flex-start',
  },
  speechTitle: {
    color: '#E53935',
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 8,
  },
  speechPrompt: {
    color: '#888',
    fontSize: 18,
    marginBottom: 18,
  },
  micButtonAnimated: {
    backgroundColor: '#E53935',
    borderRadius: 32,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E53935',
  },

  textInput: {
    fontSize: 18,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    color: "#333",
    paddingVertical: 6,
    marginBottom: 16,
    width: "100%",
  },
  rightColumn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    alignItems: "center",
  },
});