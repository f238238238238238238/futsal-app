// -------------------------------------------------------------
// Futsal Sensor Unified Firmware
// Target: Seeed Studio XIAO nRF52840 Sense
// Hardware: Internal IMU (LSM6DS3) + Internal QSPI Flash (2MB)
// -------------------------------------------------------------
#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <Wire.h>
#include <Adafruit_SPIFlash.h>
#include <SdFat.h>

#define DEVICE_NAME "Futsal_Sensor" // 1つだけの場合は共通の名前でOKです

// IMU Initialization (I2C)
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// On-board QSPI Flash settings
Adafruit_FlashTransport_QSPI flashTransport;
Adafruit_SPIFlash flash(&flashTransport);
FatFileSystem fatfs;
bool flashAvailable = false;

// BLE Service & Characteristics
BLEService futsalService("19b10000-e8f2-537e-4f6c-d104768a1214");
// 送信用 (データストリームや推論結果、ファイルデータ送信用)
BLEStringCharacteristic dataCharacteristic("19b10001-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify, 256);
// 受信用 (モード切り替え命令受信用)
BLEStringCharacteristic commandCharacteristic("19b10002-e8f2-537e-4f6c-d104768a1214", BLEWrite | BLERead | BLENotify, 64);

// Operating Modes
enum SystemMode {
  MODE_IDLE = 0,
  MODE_DATA_COLLECTION = 1,
  MODE_AI_TEST = 2,
  MODE_PRODUCTION = 3,
  MODE_SYNC = 4
};
SystemMode currentMode = MODE_IDLE;

// Timing variables
unsigned long lastSampleTime = 0;
const int sampleIntervalMs = 20; // 50Hz for Edge Impulse

// File objects
File32 rawDataFile;
File32 eventFile;

void setup() {
  Serial.begin(115200);

  // 1. Initialize IMU
  if (myIMU.begin() != 0) {
    Serial.println("Device error: IMU initialization failed");
  } else {
    Serial.println("IMU initialized successfully");
  }

  // 2. Initialize Internal QSPI Flash
  if (!flash.begin()) {
    Serial.println("Flash initialization failed!");
    flashAvailable = false;
  } else {
    if (!fatfs.begin(&flash)) {
      Serial.println("Failed to mount filesystem. Formatting...");
      FatFormatter fatFormatter;
      fatFormatter.format(&flash);
      if (!fatfs.begin(&flash)) {
        Serial.println("Format failed!");
        flashAvailable = false;
      } else {
        Serial.println("Format success and mounted.");
        flashAvailable = true;
      }
    } else {
      Serial.println("Flash initialized and mounted.");
      flashAvailable = true;
    }
  }

  // 3. Initialize BLE
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
      switch (currentMode) {
        case MODE_DATA_COLLECTION:
          runDataCollection(currentMillis);
          break;
        case MODE_AI_TEST:
          runAITest(currentMillis);
          break;
        case MODE_PRODUCTION:
          runProduction(currentMillis);
          break;
        case MODE_SYNC:
          // Sync is blocking, runs inside handleCommand
          break;
        case MODE_IDLE:
        default:
          delay(10);
          break;
      }
    }
    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
    currentMode = MODE_IDLE; 
    closeFiles();
  } else {
    // BLE切断時でも本番モード中はロギングを継続
    if (currentMode == MODE_PRODUCTION) {
      runProduction(millis());
    } else {
      delay(10);
    }
  }
}

void handleCommand(String cmd) {
  cmd.trim();
  Serial.println("Received Command: " + cmd);
  
  closeFiles();

  if (cmd == "START_COLLECTION") {
    currentMode = MODE_DATA_COLLECTION;
    Serial.println("Mode switched to: DATA_COLLECTION");
  } else if (cmd == "START_AI_TEST") {
    currentMode = MODE_AI_TEST;
    Serial.println("Mode switched to: AI_TEST");
  } else if (cmd == "START_PRODUCTION") {
    currentMode = MODE_PRODUCTION;
    Serial.println("Mode switched to: PRODUCTION");
    if (flashAvailable) {
      rawDataFile = fatfs.open("raw_match.csv", FILE_WRITE);
      eventFile = fatfs.open("events.csv", FILE_WRITE);
    }
  } else if (cmd == "SYNC_EVENTS") {
    currentMode = MODE_SYNC;
    runSyncFile("events.csv");
    currentMode = MODE_IDLE;
  } else if (cmd == "SYNC_RAW") {
    currentMode = MODE_SYNC;
    runSyncFile("raw_match.csv");
    currentMode = MODE_IDLE;
  } else if (cmd == "DELETE_ALL") {
    if (flashAvailable) {
      fatfs.remove("events.csv");
      fatfs.remove("raw_match.csv");
      Serial.println("All data deleted.");
      dataCharacteristic.writeValue("DELETE_OK");
    }
  } else {
    currentMode = MODE_IDLE;
    Serial.println("Mode switched to: IDLE");
  }
}

void closeFiles() {
  if (rawDataFile) rawDataFile.close();
  if (eventFile) eventFile.close();
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

// -------------------------------------------------------------
// モード 2: AI推論テスト (リアルタイム判定結果送信)
// -------------------------------------------------------------
void runAITest(unsigned long currentMillis) {
  static unsigned long lastTestTime = 0;
  if (currentMillis - lastTestTime >= 1000) {
    lastTestTime = currentMillis;
    String dummyResult = "Pass_Inside,0.98";
    dataCharacteristic.writeValue(dummyResult);
  }
}

// -------------------------------------------------------------
// モード 3: 本番環境 (デュアルレコーディング to QSPI Flash)
// -------------------------------------------------------------
void runProduction(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= sampleIntervalMs) {
    lastSampleTime = currentMillis;

    float ax = myIMU.readFloatAccelX();
    float ay = myIMU.readFloatAccelY();
    float az = myIMU.readFloatAccelZ();
    float gx = myIMU.readFloatGyroX();
    float gy = myIMU.readFloatGyroY();
    float gz = myIMU.readFloatGyroZ();

    // 1. 生波形データをフラッシュに記録（学習用）
    if (flashAvailable && rawDataFile) {
      String rawRow = String(currentMillis) + "," + String(ax) + "," + String(ay) + "," + String(az) + "," + String(gx) + "," + String(gy) + "," + String(gz);
      rawDataFile.println(rawRow);
    }

    // 2. (ダミー実装) キック検知テスト
    static unsigned long lastEventTime = 0;
    if (currentMillis - lastEventTime >= 3000) {
      lastEventTime = currentMillis;
      String detectedLabel = "Pass_Inside"; 
      float power = abs(ax) + abs(ay) + abs(az); 

      if (flashAvailable && eventFile) {
        String eventRow = String(currentMillis) + "," + detectedLabel + "," + String(power);
        eventFile.println(eventRow);
        eventFile.flush(); 
      }
    }
  }
}

// -------------------------------------------------------------
// モード 4: データ同期 (バルク転送)
// -------------------------------------------------------------
void runSyncFile(String filename) {
  if (!flashAvailable) {
    dataCharacteristic.writeValue("SYNC_ERROR: NO_FLASH");
    return;
  }
  
  File32 fileToSync = fatfs.open(filename.c_str(), FILE_READ);
  if (!fileToSync) {
    dataCharacteristic.writeValue("SYNC_ERROR: NO_FILE");
    return;
  }

  dataCharacteristic.writeValue("SYNC_START_" + filename);
  delay(200);

  // ファイルを少しずつ読み込んでBLEで送信
  char buffer[64];
  int bytesRead = 0;
  String line = "";

  while (fileToSync.available()) {
    char c = fileToSync.read();
    if (c == '\n') {
      line.trim();
      if (line.length() > 0) {
        dataCharacteristic.writeValue(line);
        delay(15); // BLEのパケットロスを防ぐ
      }
      line = "";
    } else {
      line += c;
    }
  }
  // 送り残し対応
  line.trim();
  if (line.length() > 0) {
    dataCharacteristic.writeValue(line);
  }

  fileToSync.close();
  delay(200);
  dataCharacteristic.writeValue("SYNC_END_" + filename);
}
