#include <SPI.h>
#include <SD.h>
#include "LSM6DS3.h"
#include "Wire.h"

// ---------------------------------------------------------
// XIAO nRF52840 Sense ハードウェアテスト・プログラム
// ---------------------------------------------------------

// --- 1. IMUセンサーの設定 ---
// XIAO内蔵のLSM6DS3センサー
LSM6DS3 myIMU(I2C_MODE, 0x6A);

// --- 2. SDカードの設定 ---
// 秋月電子SDカードDIP化キットのCSピン (デフォルトはD2に配線)
const int chipSelect = 2;

// --- 3. バッテリーの設定 ---
// nRF52840のバッテリー電圧測定ピン
#define PIN_VBAT P0_31

void setup() {
  // パソコンのシリアルモニタが開くまで待機（最大5秒）
  Serial.begin(115200);
  int waitTime = 5000;
  while (!Serial && waitTime > 0) {
    delay(10);
    waitTime -= 10;
  }
  
  Serial.println("\n\n=======================================");
  Serial.println("  XIAO nRF52840 Sense ハードウェアテスト");
  Serial.println("=======================================\n");

  bool isAllOk = true;

  // ---------------------------------------------------------
  // [テスト 1] センサー (IMU) の動作確認
  // ---------------------------------------------------------
  Serial.print("[TEST 1] IMUセンサー (LSM6DS3) ... ");
  if (myIMU.begin() != 0) {
    Serial.println("❌ 失敗 (FAILED)");
    Serial.println("    -> IMUが応答しません。熱で壊れたか、基板不良の可能性があります。");
    isAllOk = false;
  } else {
    Serial.println("✅ 成功 (OK)");
    float ax = myIMU.readFloatAccelX();
    float ay = myIMU.readFloatAccelY();
    float az = myIMU.readFloatAccelZ();
    Serial.print("    -> 加速度データ: X=");
    Serial.print(ax);
    Serial.print(", Y=");
    Serial.print(ay);
    Serial.print(", Z=");
    Serial.println(az);
  }

  Serial.println("");

  // ---------------------------------------------------------
  // [テスト 2] バッテリー電圧の確認
  // ---------------------------------------------------------
  Serial.print("[TEST 2] バッテリー (Battery) ... ");
  // VBATの解像度設定
  analogReference(AR_INTERNAL2V4); // 2.4V reference
  analogReadResolution(12); // 12-bit
  
  int vbat_raw = analogRead(PIN_VBAT);
  // XIAOの電圧分圧回路 (1M / 510K) に基づく計算
  float vbat_voltage = vbat_raw * 2.4 / 4096.0 * (1510.0 / 510.0);
  
  if (vbat_voltage < 1.0) {
    Serial.println("⚠️ 未接続 または 残量ゼロ (NOT CONNECTED)");
    Serial.println("    -> バッテリーがハンダ付けされていないか、USBからのみ給電されています。");
  } else {
    Serial.println("✅ 接続確認 (OK)");
    Serial.print("    -> 現在の電圧: ");
    Serial.print(vbat_voltage);
    Serial.println(" V (満充電は約 4.1V〜4.2V)");
  }

  Serial.println("");

  // ---------------------------------------------------------
  // [テスト 3] マイクロSDカードの動作確認
  // ---------------------------------------------------------
  Serial.print("[TEST 3] マイクロSDカード (SD Card) ... ");
  if (!SD.begin(chipSelect)) {
    Serial.println("❌ 失敗 (FAILED)");
    Serial.println("    -> SDカードが見つからないか、配線が間違っています。");
    Serial.println("    -> チェック項目:");
    Serial.println("       1. SDカードはカチッと刺さっていますか？");
    Serial.println("       2. D2/D8/D9/D10/3V3/GND のハンダ付けがショートしていませんか？");
    Serial.println("       3. SDカードのフォーマットは FAT32 または exFAT ですか？");
    isAllOk = false;
  } else {
    Serial.println("✅ 認識成功 (OK)");
    
    // 書き込みテスト
    Serial.print("    -> ファイル書き込みテスト ... ");
    File testFile = SD.open("test.txt", FILE_WRITE);
    if (testFile) {
      testFile.println("XIAO SD Card Test OK!");
      testFile.close();
      Serial.println("✅ 成功");
    } else {
      Serial.println("❌ 失敗 (ファイルが開けません)");
      isAllOk = false;
    }
  }

  Serial.println("\n=======================================");
  if (isAllOk) {
    Serial.println(" 🎉 すべてのテストに合格しました！ 🎉");
    Serial.println("     はんだ付けは大成功です。自信を持って");
    Serial.println("     本番のプログラムを書き込んでください！");
  } else {
    Serial.println(" ⚠️ エラーが発生しました ⚠️");
    Serial.println("     エラーメッセージを参考にして、");
    Serial.println("     配線やSDカードを確認してください。");
  }
  Serial.println("=======================================\n");
}

void loop() {
  // IMUから連続してデータを取得して表示（シリアルプロッタ用）
  if (myIMU.begin() == 0) {
    float ax = myIMU.readFloatAccelX();
    float ay = myIMU.readFloatAccelY();
    float az = myIMU.readFloatAccelZ();
    
    float gx = myIMU.readFloatGyroX();
    float gy = myIMU.readFloatGyroY();
    float gz = myIMU.readFloatGyroZ();

    // カンマ区切りで出力すると、Arduino IDEの「シリアルプロッタ」で波形が見れます
    Serial.print("AccelX:"); Serial.print(ax); Serial.print(",");
    Serial.print("AccelY:"); Serial.print(ay); Serial.print(",");
    Serial.print("AccelZ:"); Serial.print(az); Serial.print(",");
    Serial.print("GyroX:"); Serial.print(gx); Serial.print(",");
    Serial.print("GyroY:"); Serial.print(gy); Serial.print(",");
    Serial.print("GyroZ:"); Serial.println(gz);
  }
  
  delay(50); // 1秒間に約20回のペースで更新
}
