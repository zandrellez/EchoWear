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

        // Validate row
        if (arr.length < features || arr.some(v => isNaN(v))) {
          console.log('⚠️ Ignored invalid row:', arr);
          return;
        }

        // Keep only first `features` values
        arr = arr.slice(0, features);

        bufferRef.current.push(arr);

        if (bufferRef.current.length > timesteps) bufferRef.current.shift();

        if (bufferRef.current.length === timesteps) {
          const dataCopy = [...bufferRef.current];
          console.log('📊 Final 60x11 frame ready');
  console.log('📏 Rows:', dataCopy.length);
  console.log('📏 Columns each row:', dataCopy[0].length);
          

          // Flatten for TFLite
          const flatInput = new Float32Array(timesteps * features);
          for (let i = 0; i < timesteps; i++) {
            for (let j = 0; j < features; j++) {
              flatInput[i * features + j] = dataCopy[i][j];
            }
          }

          {/*console.log('📊 GloveData ready:', dataCopy);*/}

            console.log('📦 Flattened input length:', flatInput.length); // should be 660

setGloveData(flatInput);
          // Optional callback to run your model
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

