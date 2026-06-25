'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getMatches, getMatch, getPlayers, createMatch, updateMatch, deleteMatch } from '@/lib/api';
import styles from '../admin.module.css';

export default function AdminMatchesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState('');
  
  const initialForm = {
    date: '', opponent_name: '', competition_name: '', our_score: 0, opponent_score: 0,
    summary_text: '', mom_user_id: '', statsMap: {}
  };
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    Promise.all([getMatches(), getPlayers()])
      .then(([m, p]) => {
        setMatches(m.matches || m || []);
        const fetchedPlayers = p.users || p || [];
        setPlayers(fetchedPlayers);
        
        // Initialize stats map
        const initialStats = {};
        fetchedPlayers.forEach(player => {
          initialStats[player.user_id] = { attended: false, goals: 0, assists: 0, minutes_played: 0, is_starter: false };
        });
        setForm(prev => ({ ...prev, statsMap: initialStats }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    const initialStats = {};
    players.forEach(p => {
      initialStats[p.user_id] = { attended: false, goals: 0, assists: 0, minutes_played: 0, is_starter: false };
    });
    setForm({ ...initialForm, statsMap: initialStats });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = async (id) => {
    try {
      const match = await getMatch(id);
      const initialStats = {};
      players.forEach(p => {
        initialStats[p.user_id] = { attended: false, goals: 0, assists: 0, minutes_played: 0, is_starter: false };
      });
      // Merge saved stats
      (match.stats || []).forEach(st => {
        if (initialStats[st.user_id]) {
          initialStats[st.user_id] = {
            attended: true,
            goals: st.goals || 0,
            assists: st.assists || 0,
            minutes_played: st.minutes_played || 0,
            is_starter: st.is_starter === 1
          };
        }
      });
      setForm({
        date: match.date.split('T')[0],
        opponent_name: match.opponent_name || '',
        competition_name: match.competition_name || '',
        our_score: match.our_score || 0,
        opponent_score: match.opponent_score || 0,
        summary_text: match.summary_text || '',
        mom_user_id: match.mom_user_id || '',
        statsMap: initialStats
      });
      setEditingId(id);
      setShowModal(true);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('この試合を削除してもよろしいですか？紐付く成績も削除されます。')) return;
    try {
      await deleteMatch(id);
      setMsg('試合を削除しました');
      const m = await getMatches();
      setMatches(m.matches || m || []);
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleStatChange = (userId, field, value) => {
    setForm(prev => ({
      ...prev,
      statsMap: {
        ...prev.statsMap,
        [userId]: {
          ...prev.statsMap[userId],
          [field]: value
        }
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Transform statsMap to stats array
      const stats = Object.entries(form.statsMap)
        .filter(([_, stat]) => stat.attended)
        .map(([userId, stat]) => ({
          user_id: parseInt(userId, 10),
          goals: stat.goals,
          assists: stat.assists,
          minutes_played: stat.minutes_played,
          is_starter: stat.is_starter
        }));

      const payload = { ...form, stats };
      
      if (editingId) {
        await updateMatch(editingId, payload);
        setMsg('試合情報を更新しました');
      } else {
        await createMatch(payload);
        setMsg('試合を登録しました');
      }
      setShowModal(false);
      const m = await getMatches();
      setMatches(m.matches || m || []);
    } catch (err) { setMsg(err.message); }
  };

  if (authLoading) return <div className={styles.adminPage}><div className={styles.loading}><div className={styles.spinner} /></div></div>;
  if (!isAdmin) return <div className={styles.adminPage}><p className={styles.empty}>管理者権限が必要です</p></div>;

  return (
    <div className={styles.adminPage}>
      <div className={styles.adminHeader}>
        <div className={styles.adminHeaderBg} />
        <div className={styles.adminHeaderInner}>
          <Link href="/admin" className={styles.adminBack}>← ADMIN</Link>
          <h1 className={styles.adminTitle}>試合管理</h1>
        </div>
      </div>

      <div className={styles.topBar}>
        <span>{matches.length} 件の試合</span>
        <button className={styles.addBtn} onClick={openCreate}>+ 新規登録</button>
      </div>

      {msg && <div className="container"><div className={styles.successMsg}>{msg}</div></div>}

      <div className="container">
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>日付</th>
                  <th>大会名</th>
                  <th>対戦相手</th>
                  <th>スコア</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={m.match_id || i}>
                    <td>{new Date(m.date).toLocaleDateString('ja-JP')}</td>
                    <td>{m.competition_name || '練習試合'}</td>
                    <td>{m.opponent_name}</td>
                    <td style={{ fontWeight: 700 }}>{m.our_score} - {m.opponent_score}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.editBtn} onClick={() => openEdit(m.match_id)}>編集</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(m.match_id)}>削除</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingId ? '試合編集' : '新規試合登録'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>日付</label>
                  <input type="date" className={styles.formInput} required value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>大会名</label>
                  <input className={styles.formInput} value={form.competition_name} onChange={e => setForm({...form, competition_name: e.target.value})} placeholder="練習試合" />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>対戦相手</label>
                <input className={styles.formInput} required value={form.opponent_name} onChange={e => setForm({...form, opponent_name: e.target.value})} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>自チーム得点</label>
                  <input type="number" min="0" className={styles.formInput} value={form.our_score} onChange={e => setForm({...form, our_score: parseInt(e.target.value)||0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>相手得点</label>
                  <input type="number" min="0" className={styles.formInput} value={form.opponent_score} onChange={e => setForm({...form, opponent_score: parseInt(e.target.value)||0})} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>MOM (Man of the Match)</label>
                <select className={`${styles.formInput} ${styles.formSelect}`} value={form.mom_user_id} onChange={e => setForm({...form, mom_user_id: e.target.value})}>
                  <option value="">選択なし</option>
                  {players.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
                </select>
              </div>
              
              <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-dark-600)', paddingBottom: '0.5rem' }}>出場選手・成績</h3>
              <div className={styles.tableWrap} style={{ marginBottom: '1.5rem' }}>
                <table className={styles.table} style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px', textAlign: 'center' }}>出場</th>
                      <th>選手名</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>ゴール</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>アシスト</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>時間(分)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => {
                      const stat = form.statsMap[p.user_id] || { attended: false, goals: 0, assists: 0, minutes_played: 0 };
                      return (
                        <tr key={p.user_id} style={{ opacity: stat.attended ? 1 : 0.5 }}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={stat.attended} onChange={e => handleStatChange(p.user_id, 'attended', e.target.checked)} style={{ transform: 'scale(1.5)' }} />
                          </td>
                          <td>{p.jersey_number} {p.name}</td>
                          <td>
                            <input type="number" min="0" value={stat.goals} onChange={e => handleStatChange(p.user_id, 'goals', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                          <td>
                            <input type="number" min="0" value={stat.assists} onChange={e => handleStatChange(p.user_id, 'assists', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                          <td>
                            <input type="number" min="0" value={stat.minutes_played} onChange={e => handleStatChange(p.user_id, 'minutes_played', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>サマリー</label>
                <textarea className={`${styles.formInput} ${styles.formTextarea}`} value={form.summary_text} onChange={e => setForm({...form, summary_text: e.target.value})} placeholder="試合の総括コメント" />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
                <button type="submit" className={styles.saveBtn}>{editingId ? '更新する' : '登録する'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
