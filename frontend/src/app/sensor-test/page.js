'use client';
import { useState } from 'react';
import styles from './page.module.css';

export default function SensorTest() {
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [kickData, setKickData] = useState(0);
  const [sprintData, setSprintData] = useState(0);
  const [loadData, setLoadData] = useState(0);
  const [log, setLog] = useState([]);
  
  // Settings state
  const [configChar, setConfigChar] = useState(null);
  const [kickThreshold, setKickThreshold] = useState(4.0);
  const [stepThreshold, setStepThreshold] = useState(2.5);

  const connectBLE = async () => {
    try {
      if (!navigator.bluetooth) {
        alert("お使いのブラウザはWeb Bluetoothに対応していません。Chrome、Edge等の対応ブラウザを使用してください。");
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
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      
      // Read initial config
      const confValue = await confCharacteristic.readValue();
      const decoder = new TextDecoder('utf-8');
      const confStr = decoder.decode(confValue);
      // Expected format: K:4.00,S:2.50
      if(confStr.includes('K:') && confStr.includes(',S:')) {
         const k = parseFloat(confStr.split('K:')[1].split(',S:')[0]);
         const s = parseFloat(confStr.split(',S:')[1]);
         setKickThreshold(k);
         setStepThreshold(s);
      }
      
      addLog('🟢 センサーに接続しました！');
    } catch (error) {
      console.error(error);
      addLog('❌ エラー: ' + error.message);
    }
  };

  const handleNotifications = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const msg = decoder.decode(value);
    
    try {
      const data = JSON.parse(msg);
      if (data.t === 'kick') {
        setKickData(data.v);
        addLog(`⚽ KICK DETECTED: ${data.v}G`);
      } else if (data.t === 'sprint') {
        setSprintData(data.v);
        addLog(`🏃‍♂️ SPRINT COMPLETED: ${data.v}G`);
      } else if (data.t === 'load') {
        setLoadData(prev => prev + data.v);
        addLog(`🔋 LOAD UPDATE: +${data.v.toFixed(1)}`);
      }
    } catch (e) {
      addLog('Raw: ' + msg);
    }
  };

  const addLog = (msg) => {
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 15));
  };

  const updateConfig = async () => {
    if (!configChar) return;
    try {
      const configStr = `K:${kickThreshold.toFixed(1)},S:${stepThreshold.toFixed(1)}`;
      const encoder = new TextEncoder();
      await configChar.writeValue(encoder.encode(configStr));
      addLog(`⚙️ 設定変更: ${configStr}`);
      alert("設定をマイコンに送信しました！");
    } catch(err) {
      addLog(`❌ 設定送信エラー: ${err.message}`);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>📱 センサー検証ダッシュボード</h2>
        <button className={connected ? styles.btnActive : styles.btn} onClick={connectBLE} disabled={connected}>
          {connected ? '🟢 接続済み' : 'Bluetoothで接続'}
        </button>
      </header>
      
      <div className={styles.dashboard}>
        <div className={styles.card}>
          <div className={styles.icon}>⚽</div>
          <div className={styles.label}>キック力 (Peak G)</div>
          <div className={styles.value}>{kickData.toFixed(1)}<span className={styles.unit}>G</span></div>
        </div>
        
        <div className={styles.card}>
          <div className={styles.icon}>🏃‍♂️</div>
          <div className={styles.label}>スプリント強度 (Max G)</div>
          <div className={styles.value}>{sprintData.toFixed(1)}<span className={styles.unit}>G</span></div>
        </div>
        
        <div className={styles.card}>
          <div className={styles.icon}>🔋</div>
          <div className={styles.label}>スタミナ消費 (PlayerLoad)</div>
          <div className={styles.value}>{loadData.toFixed(0)}</div>
        </div>
      </div>

      <div className={styles.configSection}>
        <h3>⚙️ センサーしきい値設定</h3>
        <p className={styles.configDesc}>A君はキックが弱い、などの個人差に合わせて現場で調整できます。</p>
        
        <div className={styles.configControl}>
          <label>⚽ キック判定G ({kickThreshold.toFixed(1)}G)</label>
          <input type="range" min="1.0" max="25.0" step="0.5" value={kickThreshold} onChange={(e) => setKickThreshold(parseFloat(e.target.value))} />
        </div>
        
        <div className={styles.configControl}>
          <label>🏃‍♂️ スプリント判定G ({stepThreshold.toFixed(1)}G)</label>
          <input type="range" min="1.0" max="10.0" step="0.5" value={stepThreshold} onChange={(e) => setStepThreshold(parseFloat(e.target.value))} />
        </div>
        
        <button className={styles.btnSync} onClick={updateConfig} disabled={!connected}>
          {connected ? '変更をマイコンへ送信' : '接続してください'}
        </button>
      </div>

      <div className={styles.logs}>
        <h3>📜 リアルタイムログ</h3>
        <div className={styles.logList}>
          {log.length === 0 ? <p className={styles.emptyLog}>データ待機中...</p> : log.map((l, i) => <div key={i} className={styles.logItem}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
