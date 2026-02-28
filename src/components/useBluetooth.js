// ../components/useBluetooth.js
import { BleManager, State } from 'react-native-ble-plx';
import { useState, useEffect, useRef } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const manager = new BleManager();
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export function useBluetooth(timesteps = 60, features = 11, onData) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [gloveData, setGloveData] = useState(null);

  const bufferRef = useRef([]);

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
      Alert.alert('Bluetooth is Off', 'Please enable Bluetooth to scan for devices.', [{ text: 'OK' }]);
      return false;
    }

    setIsScanning(true);
    setDevices([]);

    console.log('🔍 Scanning for devices advertising service:', SERVICE_UUID);

    const scanTimeout = setTimeout(() => {
      console.log('⏰ Scan timed out.');
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 5000);

    manager.startDeviceScan([SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.log('❌ Scan error:', error);
        clearTimeout(scanTimeout);
        manager.stopDeviceScan();
        setIsScanning(false);
        return;
      }

      if (!device) return;

      if (device.serviceUUIDs?.includes(SERVICE_UUID)) {
        console.log(`📡 Found device advertising ${SERVICE_UUID}: ${device.name || 'Unnamed'} (${device.id})`);

        setDevices((prev) =>
          prev.some((d) => d.id === device.id) ? prev : [...prev, device]
        );

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
      await connectedDevice.discoverAllServicesAndCharacteristics();
      await connectedDevice.requestMTU(512);
      console.log('🔧 MTU requested: 512 bytes');

      connectedDevice.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) return console.log('Monitor error:', error);
          if (!characteristic?.value) return;

          try {
            const rawStr = Buffer.from(characteristic.value, 'base64').toString('utf8');
            let arr = rawStr.split(',').map(x => parseFloat(x.trim()));

            // 1. Validate row matches the expected 11 features (5 flex + 6 MPU)
            if (arr.length < features || arr.some(v => isNaN(v))) {
              console.log('⚠️ Ignored invalid row:', arr);
              return;
            }

            // 2. APPLY NORMALIZATION (must match Colab training)
            // Arduino now sends RAW flex values (0-100 range, same as training CSVs)
            // Training used: flex → val/99 (global MinMax), MPU → (val+1)/2
            // 2. APPLY NORMALIZATION (must match Colab training)
            const normalizedRow = arr.slice(0, 11).map((val) => {
              return Number(val);
            });

            // ADD THIS TEMPORARY LOG:
            console.log("Live Sensor Data:", normalizedRow);

            // 3. Update the sliding window buffer
            bufferRef.current.push(normalizedRow);

            if (bufferRef.current.length > timesteps) {
              bufferRef.current.shift();
            }

            // 4. Once we have a full window (60 frames @ 10Hz = 6s), send to Model
            console.log('Buffer:', bufferRef.current.length, '/', timesteps);
            if (bufferRef.current.length >= timesteps) {
              const dataCopy = [...bufferRef.current];

              // Flatten for TFLite (60 * 11 = 660 floats)
              const flatInput = new Float32Array(timesteps * features);
              for (let i = 0; i < timesteps; i++) {
                for (let j = 0; j < features; j++) {
                  flatInput[i * features + j] = dataCopy[i][j];
                }
              }

              console.log('📦 Processed 660 values (Normalized)');

              // Defensive check: ensure flattened input contains only finite numbers
              const hasInvalidFlat = Array.from(flatInput).some(v => !isFinite(v));
              if (hasInvalidFlat) {
                console.warn('❌ Flattened input contains invalid numbers (NaN/Inf). Sample:', Array.from(flatInput).slice(0, 20));
                // still set to allow debugging in model, but avoid crashing
              }

              // Sanity log: confirm length
              if (flatInput.length !== timesteps * features) {
                console.warn('❌ Unexpected flattened length:', flatInput.length, 'expected', timesteps * features);
              }

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
      if (selectedDevice) {
        console.log('🔌 Disconnecting from device:', selectedDevice.name || selectedDevice.id);
        await manager.cancelDeviceConnection(selectedDevice.id);

        const isStillConnected = await manager.isDeviceConnected(selectedDevice.id);
        if (isStillConnected) {
          console.log('⚠️ Device still connected, forcing disconnect.');
          await manager.cancelDeviceConnection(selectedDevice.id);
        }
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
      manager.destroy();
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

