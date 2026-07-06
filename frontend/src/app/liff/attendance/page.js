'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import styles from './liff.module.css';

function AttendanceContent() {
  const searchParams = useSearchParams();
  const [cups, setCups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attendances, setAttendances] = useState({});

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh"; // Fallback for dev
        await liff.init({ liffId });
        
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);

        // Fetch cups from backend based on query params
        const month = searchParams.get('month');
        const dows = searchParams.get('dows') || searchParams.get('dow'); // API supports dows
        
        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        if (baseUrl.endsWith('/api')) {
          baseUrl = baseUrl.slice(0, -4);
        }
        let url = `${baseUrl}/api/cups`;
        const params = new URLSearchParams();
        if (month) params.append('month', month);
        if (dows) params.append('dows', dows);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch cups');
        const data = await res.json();
        
        setCups(data);
        
        // Initialize attendances state
        const initialAtt = {};
        data.forEach(cup => {
          const key = cup.isoDate + '|' + cup.title;
          initialAtt[key] = {
            dateStr: cup.isoDate,
            shortTitle: cup.title.substring(0, 40),
            timeStr: cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/) ? cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/)[1] : '',
            status: 'pending' // Default
          };
        });
        setAttendances(initialAtt);

      } catch (err) {
        console.error('LIFF init or fetch error', err);
        setError('エラーが発生しました: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    initLiff();
  }, [searchParams]);

  const handleStatusChange = (key, status) => {
    setAttendances(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        status
      }
    }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        attendances: Object.values(attendances).filter(a => a.status !== 'pending')
      };

      let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }

      const res = await fetch(`${baseUrl}/api/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save');
      setSuccess(true);
      
      // Close LIFF app after a short delay
      setTimeout(async () => {
        try {
          const liff = (await import('@line/liff')).default;
          liff.closeWindow();
        } catch(e) {}
      }, 2000);

    } catch (err) {
      console.error(err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.centerState} style={{color: '#888'}}>読み込み中...</div>;
  if (error) return <div className={styles.centerState} style={{color: '#e74c3c'}}>{error}</div>;
  if (success) return (
    <div className={styles.centerState}>
      <div className={styles.successIcon}>🎉</div>
      <h2 className={styles.successTitle}>保存が完了しました！</h2>
      <p className={styles.successText}>この画面は自動的に閉じます。</p>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        {profile?.pictureUrl && (
          <img src={profile.pictureUrl} alt="profile" className={styles.profileImg} />
        )}
        <h1 className={styles.title}>
          出欠の一括登録
        </h1>
      </div>

      <p className={styles.instruction}>
        参加・不参加を選択して、一番下の「保存する」ボタンを押してください。
      </p>

      {cups.length === 0 ? (
        <div className={styles.emptyState}>該当する大会が見つかりませんでした。</div>
      ) : (
        <div className={styles.cupList}>
          {cups.map((cup, i) => {
            const timeMatch = cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/);
            const timeStr = timeMatch ? timeMatch[1] : '';
            const pParts = cup.isoDate.split('-');
            const mDate = pParts.length >= 3 ? `${parseInt(pParts[1], 10)}月${parseInt(pParts[2], 10)}日` : cup.isoDate;
            const key = cup.isoDate + '|' + cup.title;
            const currentStatus = attendances[key]?.status || 'pending';

            return (
              <div key={i} className={styles.cupCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.date}>{mDate}</span>
                </div>
                <div className={styles.time}>{timeStr}</div>
                <div className={styles.cupTitle}>🏆 {cup.title}</div>

                <div className={styles.buttonGroup}>
                  <button
                    onClick={() => handleStatusChange(key, 'present')}
                    className={`${styles.statusBtn} ${currentStatus === 'present' ? styles.activePresent : ''}`}
                  >
                    参加
                  </button>
                  <button
                    onClick={() => handleStatusChange(key, 'absent')}
                    className={`${styles.statusBtn} ${currentStatus === 'absent' ? styles.activeAbsent : ''}`}
                  >
                    不参加
                  </button>
                  <button
                    onClick={() => handleStatusChange(key, 'pending')}
                    className={`${styles.statusBtn} ${currentStatus === 'pending' ? styles.activePending : ''}`}
                  >
                    未定
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cups.length > 0 && (
        <div className={styles.bottomBar}>
          <div className={styles.bottomBarInner}>
            <button
              onClick={handleSave}
              disabled={saving}
              className={styles.saveBtn}
            >
              {saving ? (
                <div className={styles.spinner}></div>
              ) : (
                "一括で保存する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className={styles.centerState} style={{color: '#888'}}>読み込み中...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}
