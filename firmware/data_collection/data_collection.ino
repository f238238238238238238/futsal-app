#include <ArduinoBLE.h>
#include "LSM6DS3.h"
#include "Wire.h"

// IMUオブジェクトの初期化 (XIAO BLE Senseの内蔵IMU: LSM6DS3TR-C)
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// BLEサービスとキャラクタリスティックの定義
BLEService futsalService("19b10000-e8f2-537e-4f6c-d104768a1214");
BLEStringCharacteristic sensorCharacteristic("19b10001-e8f2-537e-4f6c-d104768a1214", BLERead | BLENotify, 64);
BLEStringCharacteristic configCharacteristic("19b10002-e8f2-537e-4f6c-d104768a1214", BLEWrite | BLERead | BLENotify, 64);

// キック検知用の変数
float kickThresholdG = 4.0; // キックと判定するしきい値
unsigned long lastKickTime = 0;
int debounceTimeMs = 500; // キック後の不感時間

// 動作モード (0: 通常の判定モード, 1: AI学習用生データストリーミングモード)
int operationMode = 0;
unsigned long lastStreamTime = 0;

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
  futsalService.addCharacteristic(configCharacteristic);
  BLE.addService(futsalService);
  
  // 初期設定値を送信可能な状態にしておく
  String initConfig = "K:" + String(kickThresholdG) + ",S:" + String(stepThresholdG);
  configCharacteristic.writeValue(initConfig);
  
  // スマホからの接続待ちを開始
  BLE.advertise();
  Serial.println("BLE Advertising... Open 'LightBlue' or 'nRF Connect' app on your smartphone.");
}

void loop() {
  // BLEの接続状態を裏で処理しておく（スマホを繋ぎたい時のため）
  BLEDevice central = BLE.central();
  
  // スマホから設定値の変更要求が来ているかチェック
  if (central && central.connected()) {
    if (configCharacteristic.written()) {
      String newConfig = configCharacteristic.value();
      Serial.print("【CONFIG RECEIVED】: ");
      Serial.println(newConfig);
      
      // "K:4.0,S:2.5" のような文字列を分解して設定
      int kIndex = newConfig.indexOf("K:");
      int sIndex = newConfig.indexOf(",S:");
      int mIndex = newConfig.indexOf("M:");
      
      if (kIndex != -1 && sIndex != -1) {
        String kVal = newConfig.substring(kIndex + 2, sIndex);
        String sVal = newConfig.substring(sIndex + 3);
        
        kickThresholdG = kVal.toFloat();
        stepThresholdG = sVal.toFloat();
        
        Serial.print("New Kick Threshold: "); Serial.println(kickThresholdG);
        Serial.print("New Step Threshold: "); Serial.println(stepThresholdG);
      }
      
      // モード切り替えの受信 ("M:1" など)
      if (mIndex != -1) {
        operationMode = newConfig.substring(mIndex + 2).toInt();
        Serial.print("Switched Operation Mode to: "); Serial.println(operationMode);
      }
    }
  }

  // ----- 動作モード1: AI学習用の生データストリーミング ----- //
  if (operationMode == 1) {
    if (millis() - lastStreamTime >= 20) { // 50Hz (20msに1回)
      lastStreamTime = millis();
      
      float ax = myIMU.readFloatAccelX();
      float ay = myIMU.readFloatAccelY();
      float az = myIMU.readFloatAccelZ();
      float gx = myIMU.readFloatGyroX();
      float gy = myIMU.readFloatGyroY();
      float gz = myIMU.readFloatGyroZ();
      
      // JSONだと文字数が多すぎるため、CSV形式の短い文字列で送信する
      // 例: "D:0.12,-0.98,1.02,12.5,-3.2,0.1"
      if (central && central.connected()) {
        String streamData = "D:" + String(ax,2) + "," + String(ay,2) + "," + String(az,2) + "," 
                                 + String(gx,1) + "," + String(gy,1) + "," + String(gz,1);
        sensorCharacteristic.writeValue(streamData);
      }
    }
    delay(5);
    return; // 通常の判定処理は行わずループの先頭に戻る
  }

  // ----- 動作モード0: 通常のセンサー判定処理 ----- //
  
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
