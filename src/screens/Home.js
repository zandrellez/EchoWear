import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  ActivityIndicator,
  Modal,
  Image,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  StatusBar,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BleManager, State } from 'react-native-ble-plx';
import Constants from "expo-constants";
import { loadTensorflowModel } from 'react-native-fast-tflite';

import useGloveModel from '../components/Model';
import useSpeechToText from '../components/useSpeechToText'; 

const { width } = Dimensions.get("window");
const STATUSBAR_HEIGHT = Platform.OS === "ios" ? Constants.statusBarHeight : StatusBar.currentHeight || 0;

const HEADER_HEIGHT = 60;
const BOTTOM_TAB_HEIGHT = 60;
const manager = new BleManager();
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";

export default function Home() {
  const insets = useSafeAreaInsets();

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [showBluetoothModal, setShowBluetoothModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const { prediction, loading: modelLoading } = useGloveModel();

  // Use our custom speech-to-text hook
  const {
    startRecording,
    stopRecording,
    transcript,
    loading,
    isRecording,
  } = useSpeechToText();

  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [isRecording]);


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

  // BLE scanning
  const handleScanDevices = async () => {
    const btState = await manager.state();
    if (btState !== State.PoweredOn) {
      Alert.alert("Bluetooth is Off", "Please enable Bluetooth to scan for devices.", [{ text: "OK" }]);
      return; 
    }

    setShowBluetoothModal(true);
    setIsScanning(true);
    setDevices([]);

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        setIsScanning(false);
        return;
      }

      if (device && device.serviceUUIDs?.includes(SERVICE_UUID)) {
        setDevices(prev => prev.some(d => d.id === device.id) ? [...prev] : [...prev, device]);
      }
    });

    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);
  };

  const handleConnectToDevice = async (device) => {
    try {
      const connectedDevice = await manager.connectToDevice(device.id);
      await connectedDevice.discoverAllServicesAndCharacteristics();

      setIsConnected(true); 
      setShowBluetoothModal(false);
      setSelectedDevice(connectedDevice);
    } catch (err) {
      console.log("Connection error:", err);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (selectedDevice) {
        await manager.cancelDeviceConnection(selectedDevice.id);
      }
      setSelectedDevice(null);
      setIsConnected(false);
    } catch (err) {
      console.log("Disconnect error:", err);
    }
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
                  <Text style={styles.modalTitle}>Nearby Devices</Text>

                  {isScanning && <ActivityIndicator size="large" color="#E53935" style={{ marginVertical: 20 }} />}

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
                      <TouchableOpacity style={styles.retryButton} onPress={handleScanDevices}>
                        <Text style={styles.retryButtonText}>Scan Again</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Main content */}
            <View style={{flex: 1,}}>
              {/*{{!isConnected ? (
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
                <> */}
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
                          <Text style={styles.deviceConnected}>connected</Text>
                        </View>
                      </View>

                      {/* Ellipsis menu trigger */}
                      <View style={{ position: 'relative' }}>
                        <TouchableOpacity onPress={() => setShowDeviceMenu(!showDeviceMenu)}>
                          <Ionicons name="ellipsis-vertical" size={22} color="#333" />
                        </TouchableOpacity>

                        {showDeviceMenu && (
                          <View style={styles.dropdownMenu}>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => {
                                setShowDeviceMenu(false);
                                handleDisconnect();
                              }}
                            >
                              <Text style={styles.dropdownText}>Disconnect</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Translation Card */}
                    <View style={[styles.translationCard, { flex: 4 }]}>
                      <View style={styles.translationTextContainer}>
                        <Text style={styles.translationText}>FSL to Speech</Text>
                        <Text style={styles.translationPrompt}>
                          {modelLoading
                            ? 'Loading AI Model...'
                            : prediction || 'Waiting for glove input...'}
                        </Text>
                      </View>

                      <TouchableOpacity style={styles.translationPlayButton}>
                        <Ionicons name="play" size={32} color="#E53935" />
                      </TouchableOpacity>
                    </View>


                    {/* Speech to Text Card */}
                    <View style={[styles.speechCard, { flex: 4 }]}>
                      <View style={styles.speechTextContainer}>
                        <Text style={styles.speechTitle}>Speech to Text</Text>

                        <Text style={styles.speechPrompt}>
                          {loading
                            ? 'Transcribing...'
                            : transcript || 'Press the button to start voice recognition'}
                        </Text>
                      </View>

                      <View style={styles.rightColumn}>
                        <TouchableOpacity style={{ marginBottom: 10 }}>
                          <MaterialIcons name="text-fields" size={28} color="gray" />
                        </TouchableOpacity>

                        {!keyboardVisible && (
                          <Animated.View
                            style={{
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#E53935', // Always red
                              borderRadius: 50,
                              padding: 18,
                              transform: [{ scale: scaleAnim }],
                              shadowColor: '#E53935',
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: isRecording ? 0.9 : 0.4,
                              shadowRadius: isRecording ? 20 : 5,
                              elevation: isRecording ? 20 : 5,
                            }}
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
                {/* </> 
              )}*/}
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
  color: '#E53935', // same accent red, but no background
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
    padding: 28,
    width: '80%',
    alignItems: 'center',
    elevation: 6,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: 18,
    backgroundColor: '#E53935',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  messageCard: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 22,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start', // ensures children start at the top
    justifyContent: 'space-between', // space between text and avatar
    minHeight: 250,
    position: 'relative', // optional, for more control
  },
  textLinesContainer: {
    flex: 1,
    marginRight: 16,
    alignItems: 'flex-start', // aligns text lines to the left
    justifyContent: 'flex-start', // aligns text lines to the top
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
    top: 28,     // below the ellipsis
    right: 0,    // align to the right
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
    // flex: 1, // <-- Remove this line
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexShrink: 1, // Optional: allows text to shrink if needed
  },
  translationText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 6,
    textAlign: 'left', // <-- changed from right
    fontWeight: 'bold',
  },
  translationPrompt: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 18,
    textAlign: 'left', // <-- changed from right
    fontStyle: 'italic',
    // fontWeight: 'bold',
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
    alignItems: 'flex-start', // <-- changed from flex-end
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
  micButton: {
    backgroundColor: '#E53935',
    borderRadius: 32,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  textInput: {
    fontSize: 20,
    borderBottomWidth: 1,
    borderColor: "#ccc",
    paddingVertical: 4,
    marginBottom: 20,
  },
  rightColumn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    alignItems: "center",
  },
});