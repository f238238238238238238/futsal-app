'use client';
import { useState, useRef } from 'react';
import styles from './page.module.css';
import Link from 'next/link';

export default function MLTest() {
  const [device, setDevice] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [history, setHistory] = useState([]);

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
      // AI推論結果を受け取るためのCharacteristic (19b10003)
      const aiCharacteristic = await service.getCharacteristic('19b10003-e8f2-537e-4f6c-d104768a1214');

      await aiCharacteristic.startNotifications();
      aiCharacteristic.addEventListener('characteristicvaluechanged', handleNotifications);
      
    } catch (error) {
      console.error(error);
      alert('エラー: ' + error.message);
    }
  };

  const disconnectBLE = () => {
    if (device && device.gatt.connected) {
      device.gatt.disconnect();
    }
    setConnected(false);
  };

  const handleNotifications = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const msg = decoder.decode(value);
    
    // msg: "Pass_Inside (0.98)" のような形式を想定
    const timestamp = new Date().toLocaleTimeString();
    
    setLastResult(msg);
    setHistory(prev => [{ time: timestamp, result: msg }, ...prev].slice(0, 10));
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <Link href="/admin" className={styles.backLink}>← ポータルへ戻る</Link>
        </div>
        <h2>🤖 AI推論 答え合わせテスト</h2>
        <p>Edge Impulseで学習させたAIモデル（sensor_node_ai.ino）の判定精度をテストします。</p>
        
        {!connected ? (
          <button className={styles.btnConnect} onClick={connectBLE}>
            テスト用マイコンと接続する
          </button>
        ) : (
          <button className={styles.btnDisconnect} onClick={disconnectBLE}>
            🟢 接続中 (切断)
          </button>
        )}
      </header>
      
      <div className={styles.mainContent}>
        <div className={styles.resultBox}>
          <h3>最新の判定結果</h3>
          <div className={styles.hugeResult}>
            {lastResult ? lastResult : "待機中..."}
          </div>
          {lastResult && <p className={styles.hint}>※AIが自信満々（0.9以上）の時だけ表示されるようにマイコン側で調整しましょう。</p>}
        </div>

        <div className={styles.historyBox}>
          <h3>📜 判定履歴 (直近10件)</h3>
          {history.length === 0 ? (
            <p className={styles.emptyLog}>まだ判定データが届いていません。</p>
          ) : (
            <ul className={styles.historyList}>
              {history.map((item, index) => (
                <li key={index}>
                  <span className={styles.time}>{item.time}</span>
                  <span className={styles.res}>{item.result}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
