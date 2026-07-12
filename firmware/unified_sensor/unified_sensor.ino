// -------------------------------------------------------------
// Futsal Sensor Unified Firmware
// Target: Seeed Studio XIAO nRF52840 Sense
// -------------------------------------------------------------
#include <ArduinoBLE.h>
#include <LSM6DS3.h>
#include <Wire.h>
#include <SPI.h>
#include <SD.h>

// TODO: 後でEdge Impulseからエクスポートしたライブラリをここにインクルードする
// #include <FUTSAL_AI_inferencing.h>

// IMU Initialization (I2C)
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// SD Card settings
const int chipSelect = 2; // SDカードのCSピン（ハードウェア構成に応じて変更してください）
bool sdAvailable = false;

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

File rawDataFile;
File eventFile;

void setup() {
  Serial.begin(115200);
  // while (!Serial); // 本番ではコメントアウト（PC接続なしで動かすため）

  // 1. Initialize IMU
  if (myIMU.begin() != 0) {
    Serial.println("Device error: IMU initialization failed");
  } else {
    Serial.println("IMU initialized successfully");
  }

  // 2. Initialize SD Card
  if (!SD.begin(chipSelect)) {
    Serial.println("Card failed, or not present");
    sdAvailable = false;
  } else {
    Serial.println("SD card initialized.");
    sdAvailable = true;
  }

  // 3. Initialize BLE
  if (!BLE.begin()) {
    Serial.println("starting BLE failed!");
    while (1);
  }

  BLE.setLocalName("FUMINTUS_Sensor");
  BLE.setAdvertisedService(futsalService);
  futsalService.addCharacteristic(dataCharacteristic);
  futsalService.addCharacteristic(commandCharacteristic);
  BLE.addService(futsalService);
  
  // Set initial value
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
      // Check for incoming commands (Mode switching)
      if (commandCharacteristic.written()) {
        String cmd = commandCharacteristic.value();
        handleCommand(cmd);
      }

      unsigned long currentMillis = millis();
      
      // Execute logic based on mode
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
          // Sync runs once upon receiving the command, then returns to IDLE
          break;
        case MODE_IDLE:
        default:
          delay(10);
          break;
      }
    }
    Serial.print("Disconnected from central: ");
    Serial.println(central.address());
    currentMode = MODE_IDLE; // Disconnect時にIDLEに戻す
    closeFiles();
  } else {
    // BLEに接続されていない場合でも、本番モード中ならロギングを継続する
    if (currentMode == MODE_PRODUCTION) {
      runProduction(millis());
    } else {
      delay(10);
    }
  }
}

// -------------------------------------------------------------
// コマンド処理
// -------------------------------------------------------------
void handleCommand(String cmd) {
  cmd.trim();
  Serial.println("Received Command: " + cmd);
  
  closeFiles(); // モード切替時にファイルを閉じる

  if (cmd == "START_COLLECTION") {
    currentMode = MODE_DATA_COLLECTION;
    Serial.println("Mode switched to: DATA_COLLECTION");
  } else if (cmd == "START_AI_TEST") {
    currentMode = MODE_AI_TEST;
    Serial.println("Mode switched to: AI_TEST");
  } else if (cmd == "START_PRODUCTION") {
    currentMode = MODE_PRODUCTION;
    Serial.println("Mode switched to: PRODUCTION");
    if (sdAvailable) {
      // 新しいファイルを開く (既存のデータに追記)
      rawDataFile = SD.open("raw_match.csv", FILE_WRITE);
      eventFile = SD.open("events.csv", FILE_WRITE);
    }
  } else if (cmd == "START_SYNC") {
    currentMode = MODE_SYNC;
    Serial.println("Mode switched to: SYNC");
    runSync(); // ファイル内容をBLEで送信
    currentMode = MODE_IDLE; // 同期完了後はIDLEへ
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
// モード 1: データ収集 (AI学習用)
// -------------------------------------------------------------
void runDataCollection(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= sampleIntervalMs) {
    lastSampleTime = currentMillis;

    float ax, ay, az, gx, gy, gz;
    ax = myIMU.readFloatAccelX();
    ay = myIMU.readFloatAccelY();
    az = myIMU.readFloatAccelZ();
    gx = myIMU.readFloatGyroX();
    gy = myIMU.readFloatGyroY();
    gz = myIMU.readFloatGyroZ();

    String payload = String(currentMillis) + "," + String(ax) + "," + String(ay) + "," + String(az) + "," + String(gx) + "," + String(gy) + "," + String(gz);
    
    // BLEで送信
    dataCharacteristic.writeValue(payload);
  }
}

// -------------------------------------------------------------
// モード 2: AI推論テスト
// -------------------------------------------------------------
void runAITest(unsigned long currentMillis) {
  // TODO: ここにEdge Impulseの推論エンジン実行コードを記述
  // 50Hzでセンサー値をバッファに貯め、例えば1秒ごとに推論(run_classifier)を実行する。

  // ダミーのテスト実装（1秒に1回ランダムな結果を返す）
  static unsigned long lastTestTime = 0;
  if (currentMillis - lastTestTime >= 1000) {
    lastTestTime = currentMillis;
    String dummyResult = "Pass_Inside,0.98";
    dataCharacteristic.writeValue(dummyResult);
  }
}

// -------------------------------------------------------------
// モード 3: 本番環境 (デュアルレコーディング)
// -------------------------------------------------------------
void runProduction(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= sampleIntervalMs) {
    lastSampleTime = currentMillis;

    float ax, ay, az, gx, gy, gz;
    ax = myIMU.readFloatAccelX();
    ay = myIMU.readFloatAccelY();
    az = myIMU.readFloatAccelZ();
    gx = myIMU.readFloatGyroX();
    gy = myIMU.readFloatGyroY();
    gz = myIMU.readFloatGyroZ();

    // 1. 生波形データをSDカードに記録（学習用）
    if (sdAvailable && rawDataFile) {
      String rawRow = String(currentMillis) + "," + String(ax) + "," + String(ay) + "," + String(az) + "," + String(gx) + "," + String(gy) + "," + String(gz);
      rawDataFile.println(rawRow);
    }

    // 2. AI推論エンジンにデータを渡す
    // TODO: ここでバッファに詰めて、いっぱいになったら推論を実行

    // 3. (ダミー実装) キックを検知したと仮定して、イベントファイルに記録する
    static unsigned long lastEventTime = 0;
    if (currentMillis - lastEventTime >= 3000) { // 3秒に1回イベント発生(テスト用)
      lastEventTime = currentMillis;
      
      // 実際には推論結果 (run_classifierの戻り値) を判定する
      String detectedLabel = "Pass_Inside"; 
      float power = abs(ax) + abs(ay) + abs(az); // 簡易的なキック力の算出

      if (sdAvailable && eventFile) {
        String eventRow = String(currentMillis) + "," + detectedLabel + "," + String(power);
        eventFile.println(eventRow);
        eventFile.flush(); // 突然の電源断に備えて即座に書き込む
      }
    }
  }
}

// -------------------------------------------------------------
// モード 4: データ同期 (試合会場でのイベント抽出)
// -------------------------------------------------------------
void runSync() {
  if (!sdAvailable) {
    dataCharacteristic.writeValue("SYNC_ERROR: NO_SD");
    return;
  }
  
  eventFile = SD.open("events.csv", FILE_READ);
  if (!eventFile) {
    dataCharacteristic.writeValue("SYNC_ERROR: NO_FILE");
    return;
  }

  dataCharacteristic.writeValue("SYNC_START");
  delay(100);

  // ファイルを1行ずつ読み込んでBLEで送信
  while (eventFile.available()) {
    String line = eventFile.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      dataCharacteristic.writeValue(line);
      delay(20); // BLEのパケットロスを防ぐためのわずかな遅延
    }
  }

  eventFile.close();
  delay(100);
  dataCharacteristic.writeValue("SYNC_END");
}
