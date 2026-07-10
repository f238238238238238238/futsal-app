#include <ArduinoBLE.h>
#include "LSM6DS3.h"
#include "Wire.h"

// IMUオブジェクトの初期化 (XIAO BLE Senseの内蔵IMU: LSM6DS3TR-C)
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// BLEサービスとキャラクタリスティックの定義
BLEService futsalService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLEStringCharacteristic sensorCharacteristic("19b10001-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify, 64);

// キック検知用の変数
float kickThresholdG = 4.0; // キックと判定するしきい値
unsigned long lastKickTime = 0;
int debounceTimeMs = 500; // キック後の不感時間

// 運動量（PlayerLoad）用の変数
float playerLoad = 0;
float prevAx = 0, prevAy = 0, prevAz = 0;
unsigned long lastPlayerLoadTime = 0;

// スプリント（ダッシュ）検知用の変数
float stepThresholdG = 2.5; // 走った時の着地衝撃のしきい値
unsigned long lastStepTime = 0;
int sprintCombo = 0;        // 連続ステップ数
float currentSprintMaxG = 0;// スプリント中の最大衝撃
bool isSprinting = false;

void setup() {
  Serial.begin(115200);
  
  // LEDの初期化 (XIAO BLEでは HIGH で消灯、LOW で点灯します)
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH); 
  
  // IMUの起動
  if (myIMU.begin() != 0) {
    Serial.println("IMU Initialization Error!");
  } else {
    Serial.println("IMU Ready.");
  }

  // BLEの起動
  if (!BLE.begin()) {
    Serial.println("BLE Initialization Failed!");
    while (1);
  }

  // BLEのデバイス名とサービスの設定
  BLE.setLocalName("FUMINTUS_Sensor");
  BLE.setAdvertisedService(futsalService);
  futsalService.addCharacteristic(sensorCharacteristic);
  BLE.addService(futsalService);
  
  // スマホからの接続待ちを開始
  BLE.advertise();
  Serial.println("BLE Advertising... Open 'LightBlue' or 'nRF Connect' app on your smartphone.");
}

void loop() {
  // BLEの接続状態を裏で処理しておく（スマホを繋ぎたい時のため）
  BLEDevice central = BLE.central();

  // ----- ここから常時実行されるセンサー処理 ----- //
  
  // 3軸の加速度を取得 (単位: G)
  float ax = myIMU.readFloatAccelX();
  float ay = myIMU.readFloatAccelY();
  float az = myIMU.readFloatAccelZ();
  
  // 3次元の合成ベクトル（絶対的な衝撃力）を計算
  float gForce = sqrt(ax*ax + ay*ay + az*az);

  // --- 1. 運動量（PlayerLoad）の計算 ---
  // 前回の計測値との「変化量」を足し続ける
  if (prevAx != 0) {
    float change = sqrt(pow(ax - prevAx, 2) + pow(ay - prevAy, 2) + pow(az - prevAz, 2));
    playerLoad += change;
  }
  prevAx = ax; prevAy = ay; prevAz = az;

  // 10秒に1回、PlayerLoadをコンソールに表示してリセット（本番はメモリに保存します）
  if (millis() - lastPlayerLoadTime > 10000) {
    Serial.print("【PLAYER LOAD (10sec)】: ");
    Serial.println(playerLoad);
    
    if (central && central.connected()) {
      String msg = "{\"t\":\"load\",\"v\":" + String(playerLoad, 2) + "}";
      sensorCharacteristic.writeValue(msg);
    }
    
    lastPlayerLoadTime = millis();
    playerLoad = 0; 
  }

  // --- 2. キック検知 ---
  if (gForce > kickThresholdG && millis() - lastKickTime > debounceTimeMs) {
    lastKickTime = millis();
    
    // 衝撃を検知した瞬間から、さらに20ミリ秒間だけ計測を続け「本当のピーク（最大G）」を探す
    float peakG = gForce;
    for(int i = 0; i < 20; i++) {
      ax = myIMU.readFloatAccelX();
      ay = myIMU.readFloatAccelY();
      az = myIMU.readFloatAccelZ();
      float currentG = sqrt(ax*ax + ay*ay + az*az);
      if(currentG > peakG) {
        peakG = currentG;
      }
      delay(1);
    }
    
    // 【PCのシリアルモニタに出力】
    Serial.print("【KICK DETECTED!】 Peak: ");
    Serial.print(peakG);
    Serial.println(" G");
    
    // もしスマホが繋がっていれば、スマホにも数値を送る
    if (central && central.connected()) {
      String msg = "{\"t\":\"kick\",\"v\":" + String(peakG, 2) + "}";
      sensorCharacteristic.writeValue(msg);
    }
  }

  // --- 3. スプリント（ダッシュ）検知 ---
  // キックほどの衝撃ではないが、着地衝撃（例：2.5G以上）がある場合
  if (gForce > stepThresholdG && gForce <= kickThresholdG) {
    unsigned long timeSinceLastStep = millis() - lastStepTime;
    
    // 足の回転数（ピッチ）が速い場合（例：0.15秒〜0.4秒以内に次のステップが来た）
    if (timeSinceLastStep > 150 && timeSinceLastStep < 400) {
      sprintCombo++;
      if (gForce > currentSprintMaxG) {
        currentSprintMaxG = gForce;
      }
      
      // 3歩以上連続で高速ステップがあれば「スプリント中」と判定
      if (sprintCombo >= 3 && !isSprinting) {
        isSprinting = true;
        Serial.println("🏃‍♂️ SPRINT STARTED!");
      }
    } else if (timeSinceLastStep >= 400) {
      // ステップの間隔が空きすぎたらコンボ途切れ
      sprintCombo = 1;
      currentSprintMaxG = gForce;
    }
    lastStepTime = millis();
  }

  // スプリントの終了判定（最後のステップから0.5秒以上経過）
  if (isSprinting && millis() - lastStepTime > 500) {
    isSprinting = false;
    Serial.print("🛑 SPRINT ENDED! Max Impact: ");
    Serial.print(currentSprintMaxG);
    Serial.println(" G");
    
    if (central && central.connected()) {
      String msg = "{\"t\":\"sprint\",\"v\":" + String(currentSprintMaxG, 2) + "}";
      sensorCharacteristic.writeValue(msg);
    }
    
    sprintCombo = 0;
    currentSprintMaxG = 0;
  }
  
  delay(10); // 1回のループで約10ms待機（約100Hzでサンプリング）
}
