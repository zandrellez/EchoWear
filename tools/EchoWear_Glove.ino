#include <Wire.h>

#include <MPU6050.h>

#include <ArduinoBLE.h>



// FLEX SENSOR PINS

#define FLEX_THUMB  A0

#define FLEX_INDEX  A1

#define FLEX_MIDDLE A2

#define FLEX_RING   A3

#define FLEX_PINKY  A4



MPU6050 mpu;



// FLEX calibration arrays

int flexMin[5] = {1023, 1023, 1023, 1023, 1023};

int flexMax[5] = {0, 0, 0, 0, 0};



BLEService gloveService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");

BLECharacteristic dataChar(

  "beb5483e-36e1-4688-b7f5-ea07361b26a8",

  BLERead | BLENotify,

  120

);



const int flexPins[5] = {FLEX_THUMB, FLEX_INDEX, FLEX_MIDDLE, FLEX_RING, FLEX_PINKY};



// MPU normalization ranges (example ranges, adjust if needed)

const float ACC_RANGE = 17000.0;  

const float GYR_RANGE = 17000.0;  



// Control reading frequency

const unsigned long READ_INTERVAL = 100; // milliseconds (~10 Hz)

unsigned long lastReadTime = 0;



void setup() {

  Serial.begin(115200);

  Wire.begin(11, 12);

  delay(1000);



  Serial.println("=== EchoWear Glove BLE ===");



  // --- MPU INIT ---

  mpu.initialize();

  if (!mpu.testConnection()) {

    Serial.println("MPU6050 FAILED");

    while (1);

  }

  Serial.println("MPU6050 OK");



  // --- FLEX CALIBRATION ---

  Serial.println("Calibrating flex sensors for 5 seconds...");

  unsigned long start = millis();

  while (millis() - start < 5000) {

    for (int i = 0; i < 5; i++) {

      int val = analogRead(flexPins[i]);

      flexMin[i] = min(flexMin[i], val);

      flexMax[i] = max(flexMax[i], val);

    }

    delay(50);

  }

  Serial.println("Calibration done!");

  for (int i = 0; i < 5; i++) {

    Serial.print("Sensor "); Serial.print(i);

    Serial.print(": Min="); Serial.print(flexMin[i]);

    Serial.print(" Max="); Serial.println(flexMax[i]);

  }



  // --- BLE INIT ---

  if (!BLE.begin()) {

    Serial.println("BLE FAIL");

    while (1);

  }



  BLE.setLocalName("EchoWear-Glove");

  BLE.setAdvertisedService(gloveService);



  gloveService.addCharacteristic(dataChar);

  BLE.addService(gloveService);



  dataChar.writeValue("READY");

  BLE.advertise();

  Serial.println("BLE Advertising...");

}



void loop() {

  BLEDevice central = BLE.central();



  if (central && central.connected()) {

    unsigned long currentTime = millis();

    if (currentTime - lastReadTime >= READ_INTERVAL) {

      sendData();

      lastReadTime = currentTime;

    }

  }

}



void sendData() {

  // --- FLEX SENSOR READ (normalized 1-50) ---

  int flexMapped[5];

  for (int i = 0; i < 5; i++) {

    int raw = analogRead(flexPins[i]);

    flexMapped[i] = map(raw, flexMin[i], flexMax[i], 1, 50); // 1–50

    flexMapped[i] = constrain(flexMapped[i], 1, 50);

  }



  // --- MPU READ (still normalized -1 to 1) ---

  int16_t ax, ay, az, gx, gy, gz;

  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);



  float axN = constrain((float)ax / ACC_RANGE, -1.0, 1.0);

  float ayN = constrain((float)ay / ACC_RANGE, -1.0, 1.0);

  float azN = constrain((float)az / ACC_RANGE, -1.0, 1.0);

  float gxN = constrain((float)gx / GYR_RANGE, -1.0, 1.0);

  float gyN = constrain((float)gy / GYR_RANGE, -1.0, 1.0);

  float gzN = constrain((float)gz / GYR_RANGE, -1.0, 1.0);



  // --- FORMAT DATA PACKET ---

  char packet[128];

  sprintf(packet,

          "%d,%d,%d,%d,%d,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f",

          flexMapped[0], flexMapped[1], flexMapped[2], flexMapped[3], flexMapped[4],

          axN, ayN, azN, gxN, gyN, gzN

  );



  // --- SEND VIA BLE ---

  dataChar.writeValue(packet);



  // Debug

  Serial.println(packet);

}