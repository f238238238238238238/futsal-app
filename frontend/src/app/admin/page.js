import Link from 'next/link';
import styles from './page.module.css';

export default function AdminPortal() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>⚙️ FUMINTUS Admin Portal</h2>
        <p>センサーの開発・テスト用ポータル</p>
      </header>

      <div className={styles.grid}>
        <Link href="/sensor-test" className={styles.card}>
          <div className={styles.icon}>📊</div>
          <h3>基本的なセンサーテスト</h3>
          <p>キック力やスプリント、運動量をしきい値ベースでテストするダッシュボードです。</p>
        </Link>
        
        <Link href="/admin/ml-collection" className={styles.card}>
          <div className={styles.icon}>🧠</div>
          <h3>AI学習データ収集</h3>
          <p>AI（Edge Impulse等）に学習させるための、パスやシュートの生波形データをCSVで収集します。</p>
        </Link>
        
        <Link href="/admin/ml-test" className={styles.card}>
          <div className={styles.icon}>🤖</div>
          <h3>AI推論テスト (答え合わせ)</h3>
          <p>学習済みのAIモデルを組み込んだマイコンから、判定結果をリアルタイムに受信してテストします。</p>
        </Link>
      </div>
    </div>
  );
}
