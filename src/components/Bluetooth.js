import { BleManager } from '@react-native-ble-plx';
import { useEffect, useState } from 'react';

const manager = new BleManager();

export function useGloveConnection() {
  const [device, setDevice] = useState(null);
  const [sensorData, setSensorData] = useState([]);

  useEffect(() => {
    manager.startDeviceScan(null, null, (error, scannedDevice) => {
      if (error) return;

      if (scannedDevice.name === 'EchoWear') {
        manager.stopDeviceScan();
        scannedDevice.connect().then((connectedDevice) => {
          setDevice(connectedDevice);
          // Subscribe to characteristic for sensor readings
        });
      }
    });

    return () => manager.destroy();
  }, []);

  return { device, sensorData };
}
