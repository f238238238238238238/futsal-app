#include <ArduinoBLE.h>
#include <Arduino_LSM6DS3.h>

// BLE Service & Characteristics
BLEService sensorService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLEStringCharacteristic aiCharacteristic("19b10003-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify, 64);

void setup() {
  Serial.begin(115200);
  
  if (!IMU.begin()) {
    Serial.println("Failed to initialize IMU!");
    while (1);
  }

  if (!BLE.begin()) {
    Serial.println("starting BLE failed!");
    while (1);
  }

  BLE.setLocalName("FUMINTUS_Sensor");
  BLE.setAdvertisedService(sensorService);
  sensorService.addCharacteristic(aiCharacteristic);
  BLE.addService(sensorService);
  BLE.advertise();
  
  Serial.println("AI Test Firmware Ready.");
}

void loop() {
  BLEDevice central = BLE.central();

  // TODO: Edge Impulse 推論用コードをここに実装する
  // 例:
  // if (motion_detected) {
  //    String result = "Pass_Inside (0.98)";
  //    aiCharacteristic.writeValue(result);
  // }
  
  delay(10);
}
