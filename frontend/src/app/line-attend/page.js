"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

function LineAttendContent() {
  const searchParams = useSearchParams();
  const luid = searchParams.get('luid');
  const targetMonth = searchParams.get('month') || '';
  const targetDows = searchParams.get('dows') || '';

  const [cups, setCups] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  // Local state for toggled attendance
  const [attendances, setAttendances] = useState({}); 

  const [requiresLinking, setRequiresLinking] = useState(false);
  const [unlinkedUsers, setUnlinkedUsers] = useState([]);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!luid) {
      setError("LINEのユーザー情報が取得できません。LINEアプリから開き直してください。");
      setLoading(false);
      return;
    }

    fetchCups();
  }, [luid, targetMonth, targetDows]);

  const fetchCups = async () => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const cleanApiUrl = apiUrl.endsWith('/api') ? apiUrl.replace(/\/api$/, '') : apiUrl;
      const res = await fetch(`${cleanApiUrl}/api/line/cups?luid=${luid}&targetMonth=${targetMonth}&targetDows=${targetDows}`);
      
      const data = await res.json();

      if (res.ok && data.requiresLinking) {
        setRequiresLinking(true);
        setUnlinkedUsers(data.unlinkedUsers || []);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "大会情報の取得に失敗しました");
      }
      
      setRequiresLinking(false);
      setUser(data.user);
      setCups(data.cups);
      
      // init attendances
      const atts = {};
      data.cups.forEach(c => {
        atts[c.isoDate] = c.myStatus || 'absent';
      });
      setAttendances(atts);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (userId) => {
    setLinking(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const cleanApiUrl = apiUrl.endsWith('/api') ? apiUrl.replace(/\/api$/, '') : apiUrl;
      const res = await fetch(`${cleanApiUrl}/api/line/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ luid, userId })
      });
      
      if (!res.ok) throw new Error("紐付けに失敗しました");
      
      await fetchCups();
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  };

  const toggleStatus = (isoDate) => {
    setAttendances(prev => ({
      ...prev,
      [isoDate]: prev[isoDate] === 'present' ? 'absent' : 'present'
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setError(null);
    try {
      const payload = {
        luid,
        attendances: cups.map(c => ({
          isoDate: c.isoDate,
          title: c.title,
          status: attendances[c.isoDate]
        }))
      };

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const cleanApiUrl = apiUrl.endsWith('/api') ? apiUrl.replace(/\/api$/, '') : apiUrl;
      const res = await fetch(`${cleanApiUrl}/api/line/batch_attend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        throw new Error("一括保存に失敗しました");
      }
      
      const data = await res.json();
      let msg = '出欠の保存が完了しました！LINEの画面を閉じてください。';
      if (data.confirmedCount > 0) {
        msg += `\n（${data.confirmedCount}件の大会が新しく開催確定しました🎉）`;
      }
      setSuccessMsg(msg);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loader}></div>
        <p>大会情報を読み込んでいます...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>
          <strong>エラー:</strong> {error}
        </div>
      </div>
    );
  }

  if (requiresLinking) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 className={styles.headerTitle}>LINEアカウントの連携</h2>
          <p className={styles.headerSubtitle}>あなたはどの選手ですか？名前を選択してください。</p>
        </header>
        
        <div className={styles.list}>
          {unlinkedUsers.length === 0 ? (
            <p className={styles.empty}>連携可能な選手がいません。管理者に連絡してください。</p>
          ) : (
            unlinkedUsers.map(u => (
              <div key={u.user_id} className={styles.card}>
                <div className={styles.cardInfo}>
                  <div className={styles.title}>{u.name}</div>
                </div>
                <button 
                  className={styles.saveBtn} 
                  style={{ width: 'auto', padding: '8px 16px', margin: '0' }}
                  onClick={() => handleLink(u.user_id)}
                  disabled={linking}
                >
                  {linking ? '処理中...' : 'これを選択'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.headerTitle}>出欠一括登録</h2>
        <p className={styles.headerSubtitle}>こんにちは、{user?.name}さん！</p>
      </header>
      
      <div className={styles.list}>
        {cups.length === 0 ? (
          <p className={styles.empty}>予定されている大会がありません。</p>
        ) : (
          cups.map(cup => {
            const isPresent = attendances[cup.isoDate] === 'present';
            return (
              <div key={cup.isoDate} className={`${styles.card} ${isPresent ? styles.presentCard : ''}`}>
                <div className={styles.cardInfo}>
                  <div className={styles.date}>{cup.dateText}</div>
                  <div className={styles.title}>{cup.title}</div>
                  {cup.availability !== '情報なし' && (
                    <span className={`${styles.availability} ${
                      cup.availability.includes('空き') ? styles.availGreen :
                      cup.availability.includes('残り') ? styles.availOrange : styles.availRed
                    }`}>
                      {cup.availability}
                    </span>
                  )}
                </div>
                <button 
                  className={`${styles.toggleBtn} ${isPresent ? styles.presentBtn : styles.absentBtn}`}
                  onClick={() => toggleStatus(cup.isoDate)}
                >
                  {isPresent ? '参加(〇)' : '不参加(✕)'}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        {successMsg && (
          <div className={styles.successAlert}>
            {successMsg.split('\n').map((line, i) => <p key={i}>{line}</p>)}
          </div>
        )}
        <button 
          className={styles.saveBtn} 
          onClick={handleSave} 
          disabled={saving || cups.length === 0}
        >
          {saving ? '保存中...' : 'まとめて保存'}
        </button>
      </div>
    </div>
  );
}

export default function LineAttend() {
  return (
    <Suspense fallback={<div style={{padding: '20px', textAlign: 'center'}}>Loading...</div>}>
      <LineAttendContent />
    </Suspense>
  );
}
