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

      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      
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

      <div className={styles.logs}>
        <h3>📜 リアルタイムログ</h3>
        <div className={styles.logList}>
          {log.length === 0 ? <p className={styles.emptyLog}>データ待機中...</p> : log.map((l, i) => <div key={i} className={styles.logItem}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}
