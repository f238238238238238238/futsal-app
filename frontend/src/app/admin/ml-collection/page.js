'use client';
import { useState, useRef } from 'react';
import styles from './page.module.css';

export default function MLCollection() {
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [configChar, setConfigChar] = useState(null);
  
  const [recording, setRecording] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('Pass_Inside');
  const [dataRows, setDataRows] = useState([]);
  
  const dataRowsRef = useRef([]);

  const labels = [
    'Pass_Inside',
    'Pass_Toe',
    'Shoot_Instep',
    'Trap_Control',
    'Sprint_Dash',
    'Walk_Idle'
  ];

  const connectBLE = async () => {
    try {
      if (!navigator.bluetooth) {
        alert("Web Bluetoothに対応していません。");
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'FUMINTUS_Sensor' }],
        optionalServices: ['19b10000-e8f2-537e-4f6c-d104768a1214']
      });

      device.addEventListener('gattserverdisconnected', () => setConnected(false));
      setDevice(device);

      const server = await device.gatt.connect();
      setConnected(true);

      const service = await server.getPrimaryService('19b10000-e8f2-537e-4f6c-d104768a1214');
      const characteristic = await service.getCharacteristic('19b10001-e8f2-537e-4f6c-d104768a1214');
      const confCharacteristic = await service.getCharacteristic('19b10002-e8f2-537e-4f6c-d104768a1214');

      setConfigChar(confCharacteristic);
      
      // ストリーミングモード(M:1)に変更
      const encoder = new TextEncoder();
      await confCharacteristic.writeValue(encoder.encode("M:1"));

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      
    } catch (error) {
      console.error(error);
      alert('エラー: ' + error.message);
    }
  };

  const disconnectBLE = async () => {
    if (configChar) {
      try {
        // 通常モード(M:0)に戻す
        const encoder = new TextEncoder();
        await configChar.writeValue(encoder.encode("M:0"));
      } catch(e) {}
    }
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    setConnected(false);
  };

  const handleNotifications = (event) => {
    if (!recording) return; // 録画中のみデータを保存
    
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const msg = decoder.decode(value);
    
    // "D:ax,ay,az,gx,gy,gz" の形式
    if (msg.startsWith('D:')) {
      const values = msg.substring(2); // "D:" を削除
      const timestamp = Date.now();
      const row = `${timestamp},${values},${currentLabel}`;
      
      // useRefを使って高速に配列に追加
      dataRowsRef.current.push(row);
      
      // 画面表示用に1秒に数回だけstateを更新
      if (dataRowsRef.current.length % 20 === 0) {
        setDataRows([...dataRowsRef.current]);
      }
    }
  };

  const toggleRecording = () => {
    if (!recording) {
      setRecording(true);
      alert(`${currentLabel} の録画を開始します。終わったらストップを押してください。`);
    } else {
      setRecording(false);
      setDataRows([...dataRowsRef.current]);
    }
  };

  const clearData = () => {
    if(confirm("集めたデータをすべて消去しますか？")) {
      dataRowsRef.current = [];
      setDataRows([]);
    }
  };

  const downloadCSV = () => {
    if (dataRowsRef.current.length === 0) {
      alert("データがありません！");
      return;
    }
    
    const header = "timestamp,accel_x,accel_y,accel_z,gyro_x,gyro_y,gyro_z,label\n";
    const csvContent = header + dataRowsRef.current.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sensor_ml_data_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>🧠 AI学習データ収集ツール</h2>
        {!connected ? (
          <button className={styles.btnConnect} onClick={connectBLE}>
            Bluetoothで接続 (ストリーミング開始)
          </button>
        ) : (
          <button className={styles.btnDisconnect} onClick={disconnectBLE}>
            🟢 接続中 (切断して通常モードへ)
          </button>
        )}
      </header>
      
      <div className={styles.mainContent}>
        <div className={styles.controlsSection}>
          <h3>1. 動作ラベルを選択</h3>
          <div className={styles.labelGrid}>
            {labels.map(lbl => (
              <button 
                key={lbl} 
                className={currentLabel === lbl ? styles.labelBtnActive : styles.labelBtn}
                onClick={() => setCurrentLabel(lbl)}
                disabled={recording}
              >
                {lbl}
              </button>
            ))}
          </div>

          <h3>2. 録画コントロール</h3>
          <button 
            className={recording ? styles.btnStop : styles.btnRecord} 
            onClick={toggleRecording}
            disabled={!connected}
          >
            {recording ? '⏹ 録画ストップ' : '⏺ 録画スタート'}
          </button>
          
          {recording && <div className={styles.recordingIndicator}>🔴 録画中... {currentLabel} をひたすら繰り返してください！</div>}
        </div>

        <div className={styles.dataSection}>
          <h3>3. データエクスポート</h3>
          <div className={styles.stats}>
            <p>収集済みのデータ行数: <strong>{dataRowsRef.current.length}</strong> 件</p>
            <p>※1秒間に約50件増えます</p>
          </div>
          
          <div className={styles.actionButtons}>
            <button className={styles.btnDownload} onClick={downloadCSV} disabled={dataRowsRef.current.length === 0 || recording}>
              💾 CSVダウンロード
            </button>
            <button className={styles.btnClear} onClick={clearData} disabled={recording}>
              🗑 データクリア
            </button>
          </div>
          
          <div className={styles.preview}>
            <h4>データプレビュー (最新5件)</h4>
            <div className={styles.codeBlock}>
              {dataRowsRef.current.slice(-5).map((row, i) => (
                <div key={i}>{row}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
