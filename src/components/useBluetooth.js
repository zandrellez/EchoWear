// ../components/useBluetooth.js
import { BleManager, State } from 'react-native-ble-plx';
import { useState, useEffect, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const manager = new BleManager();
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Lowercase
const CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Lowercase

export function useBluetooth(timesteps = 30, features = 11, onData) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [gloveData, setGloveData] = useState(null);

  const bufferRef = useRef([]);
  const connectedDeviceIdRef = useRef(null);
  const frameCounterRef = useRef(0);

  async function requestBluetoothPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } else {
      return true;
    }
  }

  const scanDevices = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert('Bluetooth permission needed', 'Please grant Bluetooth access.');
      return false;
    }

    const btState = await manager.state();
    if (btState !== State.PoweredOn) {
      Alert.alert('Bluetooth is Off', 'Please enable Bluetooth to scan.', [{ text: 'OK' }]);
      return false;
    }

    setIsScanning(true);
    setDevices([]);

    // Ensure UUID is explicitly lowercase for the native bridge
    const targetUUID = SERVICE_UUID.toLowerCase();
    console.log('🔍 Scanning for devices advertising service:', targetUUID);

    // Resilience: Keep track of the timeout so we can clear it gracefully
    const scanTimeout = setTimeout(() => {
      console.log('⏰ Scan timed out.');
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);

    manager.startDeviceScan([targetUUID], { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('❌ Scan error:', error);
        clearTimeout(scanTimeout);
        setIsScanning(false);
        return;
      }

      if (device) {
        console.log(`📡 Found device: ${device.name || 'Unnamed'} (${device.id})`);

        setDevices((prev) => {
            // Prevent unnecessary state re-renders if the device is already in the list
            if (prev.some((d) => d.id === device.id)) return prev;
            return [...prev, device];
        });

        clearTimeout(scanTimeout);
        manager.stopDeviceScan();
        setIsScanning(false);
      }
    });

    return true;
  };

  const connectToDevice = async (device) => {
    try {
      const connectedDevice = await manager.connectToDevice(device.id);
      connectedDeviceIdRef.current = connectedDevice.id;

      await connectedDevice.discoverAllServicesAndCharacteristics();
      await connectedDevice.requestMTU(512);
      console.log('🔧 MTU requested: 512 bytes');

      manager.onDeviceDisconnected(device.id, (error, disconnectedDevice) => {
        console.log(`🔌 Device physically disconnected: ${disconnectedDevice.id}`);
        setIsConnected(false);
        setSelectedDevice(null);
        connectedDeviceIdRef.current = null;
        setGloveData(null); // Reset prediction on disconnect
        bufferRef.current = [];
      });

      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        // Inside useBluetooth.js -> connectToDevice -> monitorCharacteristicForService
        (error, characteristic) => {
          if (error) return console.log('Monitor error:', error);
          if (!characteristic?.value) return;

          try {
            // 1. Decode base64
            const rawStr = Buffer.from(characteristic.value, 'base64').toString('utf8').trim();
            console.log('Parsed BLE Data:', rawStr);

            let detectedValue = "";

            // 2. Flexible Parsing: Check if it contains a colon, otherwise use raw string
            if (rawStr.includes(':')) {
              detectedValue = rawStr.split(':')[1].trim(); 
            } else {
              detectedValue = rawStr; // Handles the current "A", "B", "1" format
            }
            
            // 3. Update state and trigger callback
            setGloveData(detectedValue);
            if (onData) onData(detectedValue);

          } catch (err) {
            console.log('❌ BLE parse error:', err);
          }
        }
      );

      setIsConnected(true);
      setSelectedDevice(connectedDevice);
    } catch (err) {
      console.log('Connection error:', err);
    }
  };

  const disconnect = async () => {
    try {
      if (connectedDeviceIdRef.current) {
        console.log('🔌 Manually disconnecting from device...');
        await manager.cancelDeviceConnection(connectedDeviceIdRef.current);
      }

      setSelectedDevice(null);
      setIsConnected(false);
      setGloveData('Waiting for data...');
      bufferRef.current = [];
      console.log('✅ Disconnected successfully.');
    } catch (err) {
      console.log('❌ Disconnect error:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (connectedDeviceIdRef.current) {
        console.log('🧹 Cleanup: Severing active connection before unmount.');
        manager.cancelDeviceConnection(connectedDeviceIdRef.current).catch(console.error);
      }
    };
  }, []);

  return {
    isConnected,
    selectedDevice,
    isScanning,
    devices,
    gloveData,
    scanDevices,
    connectToDevice,
    disconnect,
  };
}