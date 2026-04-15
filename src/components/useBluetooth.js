import { BleManager, State } from 'react-native-ble-plx';
import { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const manager = new BleManager();

// Supported BLE service/characteristic pairs.
// - EchoWear Custom: your original custom UUIDs
// - Nordic UART (NUS): used by your Arduino sketch (notify on 6e400003-...)
const PROFILES = [
  {
    name: 'EchoWear Custom',
    serviceUuid: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    characteristicUuid: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  },
  {
    name: 'Nordic UART (NUS)',
    serviceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    characteristicUuid: '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // TX (notify)
  },
];

const SCAN_DURATION_MS = 10000;

const normalizeUuid = (uuid) => String(uuid || '').toLowerCase();
const getDeviceLabel = (device) => device?.name || device?.localName || '';
const formatBleError = (err) => ({
  code: err?.errorCode ?? err?.code ?? null,
  message: err?.message ? String(err.message) : String(err),
});

const timeoutError = (ms, stage) => {
  const err = new Error(`${stage} timed out after ${ms}ms`);
  err.code = 'TIMEOUT';
  err.errorCode = 'TIMEOUT';
  return err;
};

const withTimeout = async (promise, ms, stage) => {
  let timeoutId = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(timeoutError(ms, stage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    // Location can be denied and BLE can still work on Android 12+, so don't block on it.
    return (
      granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
      granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  // Android 6–11: BLE scanning typically requires location permission (and location services ON).
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export function useBluetooth(timesteps = 60, features = 11, onData) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState([]);

  // Optional: kept for backward-compat if you ever re-enable numeric CSV -> model input.
  const [gloveData, setGloveData] = useState(null);

  // Output-only mode (your Arduino sends tokens like "B", "Good Morning", "CMD:DELETE", " ").
  const [outputText, setOutputText] = useState('');
  const [signedText, setSignedText] = useState('');

  const bufferRef = useRef([]);
  const scanTimeoutRef = useRef(null);
  const monitorSubsRef = useRef([]);
  const firstPacketTimeoutRef = useRef(null);

  const lastTextPacketRef = useRef('');
  const lastTextPacketAtRef = useRef(0);

  const stopScan = () => {
    try {
      manager.stopDeviceScan();
    } catch {}
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsScanning(false);
  };

  const stopMonitoring = () => {
    try {
      for (const sub of monitorSubsRef.current) sub?.remove?.();
    } catch {}
    monitorSubsRef.current = [];

    if (firstPacketTimeoutRef.current) {
      clearTimeout(firstPacketTimeoutRef.current);
      firstPacketTimeoutRef.current = null;
    }

    lastTextPacketRef.current = '';
    lastTextPacketAtRef.current = 0;
  };

  const uuidLooksValid = (uuid) => {
    const u = normalizeUuid(uuid);
    return (
      /^[0-9a-f]{4}$/.test(u) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u)
    );
  };

  const findMatchingProfile = async (connectedDevice) => {
    const services = await connectedDevice.services();

    for (const profile of PROFILES) {
      const service = services.find(
        (s) => normalizeUuid(s.uuid) === normalizeUuid(profile.serviceUuid)
      );
      if (!service) continue;

      const characteristics = await connectedDevice.characteristicsForService(service.uuid);
      const characteristic = characteristics.find(
        (c) => normalizeUuid(c.uuid) === normalizeUuid(profile.characteristicUuid)
      );
      if (!characteristic) continue;

      return {
        profileName: profile.name,
        serviceUuid: service.uuid,
        characteristicUuid: characteristic.uuid,
        services,
        characteristics,
      };
    }

    return { services };
  };

  const applyOutputToken = (token) => {
    const rawToken = String(token ?? '').replace(/\r?\n/g, '');

    // Preserve a single SPACE token (Arduino can send " " for space).
    const normalizedToken =
      rawToken.trim() === '' && rawToken.includes(' ') ? ' ' : rawToken.trim();

    if (!normalizedToken) return;

    // De-dupe identical notifications arriving back-to-back.
    const now = Date.now();
    if (normalizedToken === lastTextPacketRef.current && now - lastTextPacketAtRef.current < 800) {
      return;
    }
    lastTextPacketRef.current = normalizedToken;
    lastTextPacketAtRef.current = now;

    const upperToken = normalizedToken.toUpperCase();
    const command = upperToken.startsWith('CMD:') ? upperToken.slice(4) : null;

    setSignedText((prev) => {
      const current = String(prev || '');

      if (command === 'CLEAR' || upperToken === 'CLEAR') {
        setOutputText('');
        return '';
      }

      if (command === 'DELETE' || upperToken === 'DELETE') {
        // Backspace exactly 1 character (letter/number/space).
        setOutputText('');
        return current.slice(0, Math.max(0, current.length - 1));
      }

      setOutputText(normalizedToken);

      // Keep simple "space" aliases too.
      if (normalizedToken === ' ' || normalizedToken === '*' || normalizedToken === '_') {
        return current.endsWith(' ') || current.length === 0 ? current : `${current} `;
      }

      const isSingleChar = /^[A-Za-z0-9]$/.test(normalizedToken);
      if (isSingleChar) return `${current}${normalizedToken}`;

      // Words/phrases: add a space separator.
      if (!current) return normalizedToken;
      return current.endsWith(' ') ? `${current}${normalizedToken}` : `${current} ${normalizedToken}`;
    });
  };

  const scanDevices = async () => {
    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      Alert.alert('Bluetooth permission needed', 'Please grant Bluetooth access.');
      return false;
    }

    const btState = await manager.state();
    if (btState !== State.PoweredOn) {
      Alert.alert('Bluetooth is Off', 'Please enable Bluetooth to scan for devices.', [
        { text: 'OK' },
      ]);
      return false;
    }

    stopScan();
    setIsScanning(true);
    setDevices([]);

    // Many Arduino/ESP32 BLE sketches do not include their service UUID in the advertising packet.
    // If we scan with a UUID filter, the device can appear "missing". Scan broadly.
    scanTimeoutRef.current = setTimeout(stopScan, SCAN_DURATION_MS);

    manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
      if (error) {
        console.log('Scan error:', formatBleError(error));
        stopScan();
        return;
      }
      if (!device) return;

      const label = getDeviceLabel(device);
      const advertisedUuids = (device.serviceUUIDs || []).map(normalizeUuid);
      const advertisesKnownService = PROFILES.some((p) =>
        advertisedUuids.includes(normalizeUuid(p.serviceUuid))
      );

      // Reduce noise: show devices with a name/localName OR devices that advertise a known service.
      if (!label && !advertisesKnownService) return;

      setDevices((prev) => (prev.some((d) => d.id === device.id) ? prev : [...prev, device]));
    });

    return true;
  };

  const connectToDevice = async (device) => {
    try {
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert('Bluetooth permission needed', 'Please grant Bluetooth access.');
        return { ok: false, reason: 'permission' };
      }

      stopScan();
      stopMonitoring();

      console.log('Connecting to:', {
        id: device?.id,
        name: device?.name,
        localName: device?.localName,
      });

      let connectedDevice = null;
      let lastError = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          try {
            await manager.cancelDeviceConnection(device.id);
          } catch {}

          await withTimeout(new Promise((r) => setTimeout(r, 250)), 1000, 'pre-connect delay');

          const autoConnect = attempt === 2;
          const connectTimeoutMs = attempt === 2 ? 30000 : 15000;

          connectedDevice = await withTimeout(
            manager.connectToDevice(device.id, { autoConnect }),
            connectTimeoutMs,
            `connect (autoConnect=${autoConnect})`
          );

          await withTimeout(new Promise((r) => setTimeout(r, 300)), 1000, 'post-connect delay');
          await withTimeout(
            connectedDevice.discoverAllServicesAndCharacteristics(),
            20000,
            'discover services'
          );
          break;
        } catch (err) {
          lastError = err;
          console.log(`Connect attempt ${attempt} failed:`, formatBleError(err));
          try {
            await manager.cancelDeviceConnection(device.id);
          } catch {}
          connectedDevice = null;
        }
      }

      if (!connectedDevice) {
        const errInfo = formatBleError(lastError);
        Alert.alert(
          'Connection failed',
          `Could not connect to this device.\n\n${errInfo.code ? `Code: ${errInfo.code}\n` : ''}${errInfo.message || ''}`.trim()
        );
        return { ok: false, reason: 'connect_error', error: errInfo };
      }

      try {
        await connectedDevice.requestMTU(512);
      } catch {}

      const match = await withTimeout(findMatchingProfile(connectedDevice), 15000, 'match profile');
      if (!match?.serviceUuid || !match?.characteristicUuid) {
        const expected = PROFILES.map((p) => `${p.name}:\n${p.serviceUuid}`).join('\n\n');
        const available = (match?.services || [])
          .map((s) => s.uuid)
          .filter(uuidLooksValid)
          .join('\n');

        Alert.alert(
          'Wrong BLE service',
          `Expected one of:\n\n${expected}\n\nAvailable:\n${available || '(none)'}`
        );
        try {
          await manager.cancelDeviceConnection(connectedDevice.id);
        } catch {}
        return { ok: false, reason: 'wrong_service' };
      }

      // Monitor all notifiable characteristics on the matched service.
      const serviceCharacteristics =
        match.characteristics ||
        (await connectedDevice.characteristicsForService(match.serviceUuid));

      const notifiable = serviceCharacteristics.filter(
        (c) => c?.isNotifiable || c?.isIndicatable
      );

      const monitorList = [
        serviceCharacteristics.find(
          (c) => normalizeUuid(c.uuid) === normalizeUuid(match.characteristicUuid)
        ),
        ...notifiable,
      ].filter(Boolean);

      const uniqueByUuid = new Map();
      for (const c of monitorList) uniqueByUuid.set(normalizeUuid(c.uuid), c);
      const characteristicsToMonitor = [...uniqueByUuid.values()];

      firstPacketTimeoutRef.current = setTimeout(() => {
        Alert.alert(
          'No output received',
          `Connected via ${match.profileName}, but no notifications were received yet.\n\nYour Arduino code only notifies when a sign is detected (e.g. "Output: B"). Try making a sign.\n\nNUS notify characteristic:\n${PROFILES.find((p) => p.name === 'Nordic UART (NUS)')?.characteristicUuid}`
        );
      }, 45000);

      const handlePacket = (base64Value) => {
        const rawStr = Buffer.from(base64Value, 'base64').toString('utf8');
        const noNewlines = rawStr.replace(/\r?\n/g, '');
        if (!noNewlines) return;

        const tokenText =
          noNewlines.trim() === '' && noNewlines.includes(' ') ? ' ' : noNewlines.trim();
        if (!tokenText) return;

        // Output-only mode (text tokens). Keep numeric CSV fallback if ever needed.
        const parts = tokenText.split(',');
        const values = parts.map((x) => parseFloat(x.trim()));
        const looksLikeNumericCsv =
          parts.length >= features && values.every((v) => Number.isFinite(v));

        if (!looksLikeNumericCsv) {
          applyOutputToken(tokenText);
          return;
        }

        const normalizedRow = values.slice(0, features).map((val, index) => {
          if (index < 5) return (val - 1) / (50 - 1);
          return (val + 1) / 2;
        });

        bufferRef.current.push(normalizedRow);
        if (bufferRef.current.length > timesteps) bufferRef.current.shift();

        if (bufferRef.current.length === timesteps) {
          const dataCopy = [...bufferRef.current];
          const flatInput = new Float32Array(timesteps * features);
          for (let i = 0; i < timesteps; i++) {
            for (let j = 0; j < features; j++) {
              flatInput[i * features + j] = dataCopy[i][j];
            }
          }
          setGloveData(flatInput);
          if (onData) onData(flatInput);
        }
      };

      for (const c of characteristicsToMonitor) {
        const sub = connectedDevice.monitorCharacteristicForService(
          match.serviceUuid,
          c.uuid,
          (error, characteristic) => {
            if (error) return console.log('Monitor error:', formatBleError(error));
            if (!characteristic?.value) return;
            handlePacket(characteristic.value);
          }
        );
        monitorSubsRef.current.push(sub);
      }

      setIsConnected(true);
      setSelectedDevice(connectedDevice);
      console.log('Connected profile:', match.profileName);
      return { ok: true, profile: match.profileName };
    } catch (err) {
      const errInfo = formatBleError(err);
      console.log('Connection error:', errInfo);
      Alert.alert(
        'Connection failed',
        `${errInfo.code ? `Code: ${errInfo.code}\n` : ''}${errInfo.message || ''}`.trim()
      );
      return { ok: false, reason: 'unknown', error: errInfo };
    }
  };

  const disconnect = async () => {
    try {
      stopScan();
      stopMonitoring();
      if (selectedDevice) await manager.cancelDeviceConnection(selectedDevice.id);
    } catch (err) {
      console.log('Disconnect error:', err);
    } finally {
      setSelectedDevice(null);
      setIsConnected(false);
      setGloveData('Waiting for data...');
      setOutputText('');
      setSignedText('');
      bufferRef.current = [];
    }
  };

  useEffect(() => {
    return () => {
      stopScan();
      stopMonitoring();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isConnected,
    selectedDevice,
    isScanning,
    devices,
    gloveData,
    outputText,
    signedText,
    scanDevices,
    connectToDevice,
    disconnect,
  };
}

