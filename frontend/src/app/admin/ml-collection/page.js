'use client';
import { useState, useRef } from 'react';
import styles from './page.module.css';

export default function MLCollection() {
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [configChar, setConfigChar] = useState(null);
  
  const [recording, setRecording] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('Pass_Inside');
  const [foot, setFoot] = useState('Right'); // 'Right' or 'Left'
  const [dataRows, setDataRows] = useState([]);
  const [liveData, setLiveData] = useState('');
  
  const dataRowsRef = useRef([]);
  const liveDataCounterRef = useRef(0);

  const labels = [
    { id: 'Pass_Inside', text: 'Pass_Inside (インサイドパス)' },
    { id: 'Pass_Outside', text: 'Pass_Outside (アウトサイドパス)' },
    { id: 'Shoot_Instep', text: 'Shoot_Instep (インステップシュート)' },
    { id: 'Shoot_Toe', text: 'Shoot_Toe (トーキック)' },
    { id: 'Trap_Sole', text: 'Trap_Sole (足裏トラップ)' },
    { id: 'Trap_Inside', text: 'Trap_Inside (インサイドトラップ)' },
    { id: 'Dribble', text: 'Dribble (ドリブル)' },
    { id: 'Dash', text: 'Dash (ダッシュ/スプリント)' },
    { id: 'Jog', text: 'Jog (ジョグ/軽く走る)' },
    { id: 'Walk_Idle', text: 'Walk_Idle (歩く/止まる)' },
    { id: 'Block', text: 'Block (ブロック/足を出して止める)' },
    { id: 'Pass_Cut', text: 'Pass_Cut (パスカット/インターセプト)' }
  ];

  const connectBLE = async () => {
    try {
      if (!navigator.bluetooth) {
        alert("Web Bluetoothに対応していません。");
        return;
      }

      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'Futsal_' }],
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
      
      // ストリーミングモードに変更
      const encoder = new TextEncoder();
      await confCharacteristic.writeValue(encoder.encode("START_COLLECTION"));

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
        // 通常モードに戻す
        const encoder = new TextEncoder();
        await configChar.writeValue(encoder.encode("MODE_IDLE"));
      } catch(e) {}
    }
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    setConnected(false);
  };

  const handleNotifications = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const msg = decoder.decode(value);
    
    // 無関係なメッセージは無視
    if (msg.startsWith('SYNC_') || msg.startsWith('DELETE_')) return;
    
    // ライブプレビュー用の更新（Reactの負荷を下げるために10回に1回だけ更新）
    liveDataCounterRef.current++;
    if (liveDataCounterRef.current % 10 === 0) {
      setLiveData(msg);
    }

    if (!recording) return; // 録画中のみデータを保存
    
    // 現在のファームウェアは "MCU_Millis,ax,ay,az,gx,gy,gz" の形式
    const parts = msg.split(',');
    if (parts.length === 7) {
      const values = parts.slice(1).join(','); // ax,ay,az,gx,gy,gz
      const timestamp = Date.now();
      const finalLabel = `${currentLabel}_${foot}`; // 左右の足を区別する
      const row = `${timestamp},${values},${finalLabel}`;
      
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
    link.setAttribute("download", `ML_${foot}_${currentLabel}_${Date.now()}.csv`);
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className={styles.btnDisconnect} onClick={disconnectBLE}>
              🟢 接続中 (切断して通常モードへ)
            </button>
            <div style={{ background: '#1a1a1a', color: '#32cd32', padding: '10px', borderRadius: '5px', fontSize: '0.85rem', fontFamily: 'monospace', textAlign: 'left' }}>
              📡 <strong>通信テスト（センサーを振ってみてください）:</strong><br/>
              {liveData || "データ待機中..."}
            </div>
          </div>
        )}
      </header>
      
      <div className={styles.mainContent}>
        <div className={styles.controlsSection}>
          <h3 className={styles.sectionTitle}>1. どちらの足のデータ？</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              className={foot === 'Right' ? styles.labelBtnActive : styles.labelBtn}
              onClick={() => setFoot('Right')}
              disabled={recording}
              style={{ flex: 1, padding: '15px' }}
            >
              右足 (Right)
            </button>
            <button 
              className={foot === 'Left' ? styles.labelBtnActive : styles.labelBtn}
              onClick={() => setFoot('Left')}
              disabled={recording}
              style={{ flex: 1, padding: '15px' }}
            >
              左足 (Left)
            </button>
          </div>

          <h3 className={styles.sectionTitle}>2. 動作ラベルを選択</h3>
          <div className={styles.labelGrid}>
            {labels.map(lbl => (
              <button 
                key={lbl.id} 
                className={currentLabel === lbl.id ? styles.labelBtnActive : styles.labelBtn}
                onClick={() => setCurrentLabel(lbl.id)}
                disabled={recording}
              >
                {lbl.text}
              </button>
            ))}
          </div>

          <h3 className={styles.sectionTitle}>3. 録画コントロール</h3>
          <button 
            className={recording ? styles.btnStop : styles.btnRecord} 
            onClick={toggleRecording}
            disabled={!connected}
          >
            {recording ? '⏹ 録画ストップ' : '⏺ 録画スタート'}
          </button>
          
          {recording && <div className={styles.recordingIndicator}>🔴 録画中... {foot}足で {labels.find(l => l.id === currentLabel)?.text} をひたすら繰り返してください！</div>}
        </div>

        <div className={styles.dataSection}>
          <h3 className={styles.sectionTitle}>3. データエクスポート</h3>
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
