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
        setGloveData('Waiting for data...');
        bufferRef.current = [];
      });

      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) return console.log('Monitor error:', error);
          if (!characteristic?.value) return;

          try {
            const rawStr = Buffer.from(characteristic.value, 'base64').toString('utf8');
            let arr = rawStr.split(',').map(x => parseFloat(x.trim()));

            if (arr.length < features || arr.some(v => !Number.isFinite(v))) {
              console.warn('⚠️ Rejected corrupted BLE frame:', rawStr);
              return;
            }

            const normalizedRow = arr.slice(0, features).map((val, index) => {
              if (index < 5) {
                // CRITICAL FIX: Arduino is already sending 0.0 to 1.0!
                // Do NOT divide by 100 here anymore. Just pass it through.
                return Math.max(0, Math.min(1, val)); 
              } else {
                // MPU: -1..1 → 0..1 (Assuming training data was scaled this way)
                return Math.max(0, Math.min(1, (val + 1) / 2));
              }
            });

            if (normalizedRow.some(v => !Number.isFinite(v))) return;

            bufferRef.current.push(normalizedRow);
            if (bufferRef.current.length > timesteps) bufferRef.current.shift();

            if (bufferRef.current.length === timesteps) {              
              // 🔴 CRITICAL FIX 1: Throttle UI updates to 4Hz (every 5th frame)
              frameCounterRef.current += 1;
              if (frameCounterRef.current % 5 !== 0) {
                // console.log(`⏳ Skipped frame ${frameCounterRef.current} to prevent UI lag`);
                return;
              }

              const dataCopy = [...bufferRef.current];

              // 🔴 CRITICAL FIX 2: Use a standard Array, NOT Float32Array here!
              // This prevents React/Hermes from destroying the object structure.
              const flatInput = new Array(timesteps * features);          
              
              for (let i = 0; i < timesteps; i++) {
                for (let j = 0; j < features; j++) {
                  flatInput[i * features + j] = dataCopy[i][j];
                }
              }

              if (flatInput.some(v => !Number.isFinite(v) || v === null || v === undefined)) {
                 console.error('❌ Critical Error: flatInput contains NaN! Aborting dispatch.');
                 return;
              }

              // console.log(`📡 [BLE] Throttle open. Sending Frame ${frameCounterRef.current}. Length: ${flatInput.length}`);

              setGloveData(flatInput);
              if (onData) onData(flatInput);
            }
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