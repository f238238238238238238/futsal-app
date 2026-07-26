// -------------------------------------------------------------
// Futsal Sensor Firmware (ML Data Collection ONLY Version)
// Target: Seeed Studio XIAO nRF52840 Sense
// Hardware: Internal IMU (LSM6DS3) + ArduinoBLE
// -------------------------------------------------------------
#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <Wire.h>

#define DEVICE_NAME "Futsal_Sensor"

// IMU Initialization (I2C)
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// BLE Service & Characteristics
BLEService futsalService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLEStringCharacteristic dataCharacteristic("19b10001-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify, 256);
BLEStringCharacteristic commandCharacteristic("19b10002-e8f2-537e-4f6c-d104768a1214", BLEWrite | BLERead | BLENotify, 64);

// Operating Modes
enum SystemMode {
  MODE_IDLE = 0,
  MODE_DATA_COLLECTION = 1
};
SystemMode currentMode = MODE_IDLE;

// Timing variables
unsigned long lastSampleTime = 0;
const int sampleIntervalMs = 20; // 50Hz for Edge Impulse

void setup() {
  Serial.begin(115200);

  // 1. Initialize IMU
  if (myIMU.begin() != 0) {
    Serial.println("Device error: IMU initialization failed");
  } else {
    Serial.println("IMU initialized successfully");
  }

  // 2. Initialize BLE
  if (!BLE.begin()) {
    Serial.println("starting BLE failed!");
    while (1);
  }

  BLE.setLocalName(DEVICE_NAME);
  BLE.setAdvertisedService(futsalService);
  futsalService.addCharacteristic(dataCharacteristic);
  futsalService.addCharacteristic(commandCharacteristic);
  BLE.addService(futsalService);
  
  commandCharacteristic.writeValue("MODE_IDLE");

  BLE.advertise();
  Serial.println("BLE Peripheral Device started, waiting for connections...");
}

void loop() {
  BLEDevice central = BLE.central();

  if (central) {
    Serial.print("Connected to central: ");
    Serial.println(central.address());

    while (central.connected()) {
      if (commandCharacteristic.written()) {
        String cmd = commandCharacteristic.value();
        handleCommand(cmd);
      }

      unsigned long currentMillis = millis();
      if (currentMode == MODE_DATA_COLLECTION) {
        runDataCollection(currentMillis);
      } else {
        delay(10);
      }
    }
    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
    currentMode = MODE_IDLE; 
  } else {
    delay(10);
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  Serial.println("Received Command: " + cmd);

  if (cmd == "START_COLLECTION") {
    currentMode = MODE_DATA_COLLECTION;
    Serial.println("Mode switched to: DATA_COLLECTION");
  } else if (cmd == "MODE_IDLE") {
    currentMode = MODE_IDLE;
    Serial.println("Mode switched to: IDLE");
  } else {
    // Other modes disabled for this ML collection version
    currentMode = MODE_IDLE;
  }
}

// -------------------------------------------------------------
// モード 1: データ収集 (Webへのリアルタイムストリーミング)
// -------------------------------------------------------------
void runDataCollection(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= sampleIntervalMs) {
    lastSampleTime = currentMillis;

    float ax = myIMU.readFloatAccelX();
    float ay = myIMU.readFloatAccelY();
    float az = myIMU.readFloatAccelZ();
    float gx = myIMU.readFloatGyroX();
    float gy = myIMU.readFloatGyroY();
    float gz = myIMU.readFloatGyroZ();

    String payload = String(currentMillis) + "," + String(ax) + "," + String(ay) + "," + String(az) + "," + String(gx) + "," + String(gy) + "," + String(gz);
    dataCharacteristic.writeValue(payload);
  }
}
