'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import styles from '../page.module.css';

function LineRegisterHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tempToken = searchParams.get('token');
  
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [dominantFoot, setDominantFoot] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tempToken) {
      router.push('/login?error=invalid_token');
    } else {
      // Decode JWT slightly to extract name if possible, or we just let them type it.
      // We don't have a secure jwt decode on client by default without a library, so we just ask them to enter it.
    }
  }, [tempToken, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/auth/line/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          name,
          position,
          dominant_foot: dominantFoot,
          birth_date: birthDate,
          height,
          weight
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '登録に失敗しました');

      localStorage.setItem('token', data.token);
      window.location.href = '/mypage';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginCard}>
      <div className={styles.loginHeader}>
        <span className={styles.loginIcon}>📝</span>
        <h1 className={styles.loginTitle}>プロフィール登録</h1>
        <p className={styles.loginSubtitle}>LINE連携が完了しました。<br/>基本情報を入力して登録を完了してください。</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {error && <div className={styles.errorMsg}><span>⚠</span> {error}</div>}

        <div className={styles.formGroup}>
          <label className={styles.label}>お名前 *</label>
          <input type="text" className={styles.input} value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>ポジション</label>
          <select className={styles.input} value={position} onChange={e => setPosition(e.target.value)}>
            <option value="">未設定</option>
            <option value="GK">GK (ゴレイロ)</option>
            <option value="Fixo">Fixo (フィクソ)</option>
            <option value="Ala L">Ala L (左アラ)</option>
            <option value="Ala R">Ala R (右アラ)</option>
            <option value="Pivo">Pivo (ピヴォ)</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>利き足</label>
          <select className={styles.input} value={dominantFoot} onChange={e => setDominantFoot(e.target.value)}>
            <option value="">未設定</option>
            <option value="右">右</option>
            <option value="左">左</option>
            <option value="両足">両足</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>生年月日</label>
          <input type="date" className={styles.input} value={birthDate} onChange={e => setBirthDate(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>身長 (cm)</label>
          <input type="number" step="0.1" className={styles.input} value={height} onChange={e => setHeight(e.target.value)} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>体重 (kg)</label>
          <input type="number" step="0.1" className={styles.input} value={weight} onChange={e => setWeight(e.target.value)} />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? <span className={styles.btnSpinner} /> : '登録を完了する'}
        </button>
      </form>
    </div>
  );
}

export default function LineRegisterPage() {
  return (
    <div className={styles.page}>
      <div className={styles.loginContainer}>
        <Suspense fallback={<p>Loading...</p>}>
          <LineRegisterHandler />
        </Suspense>
      </div>
    </div>
  );
}
