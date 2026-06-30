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
    summary_text: '', mom_user_id: '', duration_m: 40, duration_s: 0, statsMap: {}, events: []
  };
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    Promise.all([getMatches(), getPlayers()])
      .then(([m, p]) => {
        setMatches(m.matches || m || []);
        const fetchedPlayers = p.users || p || [];
        setPlayers(fetchedPlayers);
        
        const initialStats = {};
        fetchedPlayers.forEach(player => {
          initialStats[player.user_id] = { attended: false, is_starter: false, goals: 0, assists: 0, saves: 0, position: '' };
        });
        setForm(prev => ({ ...prev, statsMap: initialStats }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    const initialStats = {};
    players.forEach(p => {
      initialStats[p.user_id] = { attended: false, is_starter: false, goals: 0, assists: 0, saves: 0, position: '' };
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
        initialStats[p.user_id] = { attended: false, is_starter: false, goals: 0, assists: 0, saves: 0, position: '' };
      });
      // Merge saved stats
      (match.stats || []).forEach(st => {
        if (initialStats[st.user_id]) {
          initialStats[st.user_id] = {
            attended: true,
            is_starter: st.is_starter === 1,
            goals: st.goals || 0,
            assists: st.assists || 0,
            saves: st.saves || 0,
            position: st.position || ''
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
        duration_m: Math.floor((match.duration_seconds || 2400) / 60),
        duration_s: (match.duration_seconds || 2400) % 60,
        statsMap: initialStats,
        events: (match.events || []).map(ev => ({
          ...ev,
          minute_m: Math.floor((ev.minute || 0) / 60),
          minute_s: (ev.minute || 0) % 60
        }))
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

  const addEvent = () => {
    setForm(prev => ({ ...prev, events: [...prev.events, { minute: 0, minute_m: 0, minute_s: 0, event_type: 'sub_in', user_id: '', position: 'Fixo' }] }));
  };
  const updateEvent = (index, field, value) => {
    setForm(prev => {
      const newEvents = [...prev.events];
      newEvents[index] = { ...newEvents[index], [field]: value };
      
      // ゴールが選択されたら、直後にアシストの入力欄を自動追加
      if (field === 'event_type' && value === 'goal') {
        const goalEvent = newEvents[index];
        const assistEvent = {
          minute: goalEvent.minute,
          minute_m: goalEvent.minute_m,
          minute_s: goalEvent.minute_s,
          event_type: 'assist',
          user_id: '',
          position: ''
        };
        newEvents.splice(index + 1, 0, assistEvent);
      }
      
      return { ...prev, events: newEvents };
    });
  };
  const removeEvent = (index) => {
    setForm(prev => ({ ...prev, events: prev.events.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Transform statsMap to stats array
      const stats = Object.entries(form.statsMap)
        .filter(([_, stat]) => stat.attended)
        .map(([userId, stat]) => ({
          user_id: parseInt(userId, 10),
          is_starter: stat.is_starter,
          goals: stat.goals,
          assists: stat.assists,
          saves: stat.saves,
          position: stat.position
        }));

      // Prepare events
      const events = form.events.map(ev => ({
        ...ev,
        minute: (parseInt(ev.minute_m, 10) || 0) * 60 + (parseInt(ev.minute_s, 10) || 0)
      }));

      const payload = { 
        ...form, 
        duration_seconds: (parseInt(form.duration_m, 10) || 0) * 60 + (parseInt(form.duration_s, 10) || 0),
        stats, 
        events 
      };
      
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={styles.addBtn} onClick={openCreate}>+ 新規登録</button>
          <Link href="/admin/matches/live" className={styles.addBtn} style={{ background: 'var(--color-gold)', color: 'var(--color-black)', textDecoration: 'none' }}>
            + リアルタイム試合登録
          </Link>
        </div>
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

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>試合終了時間 (分)</label>
                  <input type="number" min="0" className={styles.formInput} value={form.duration_m} onChange={e => setForm({...form, duration_m: parseInt(e.target.value)||0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>試合終了時間 (秒)</label>
                  <input type="number" min="0" max="59" className={styles.formInput} value={form.duration_s} onChange={e => setForm({...form, duration_s: parseInt(e.target.value)||0})} />
                </div>
              </div>
              
              <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-dark-600)', paddingBottom: '0.5rem' }}>出場選手・成績</h3>
              <div className={styles.tableWrap} style={{ marginBottom: '1.5rem' }}>
                <table className={styles.table} style={{ fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>出場</th>
                      <th style={{ width: '40px', textAlign: 'center' }}>ｽﾀﾒﾝ</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>ポジション</th>
                      <th>選手名</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>ゴール</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>ｱｼｽﾄ</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>セーブ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(p => {
                      const stat = form.statsMap[p.user_id] || { attended: false, is_starter: false, goals: 0, assists: 0, saves: 0, position: '' };
                      return (
                        <tr key={p.user_id} style={{ opacity: stat.attended ? 1 : 0.5 }}>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={stat.attended} onChange={e => handleStatChange(p.user_id, 'attended', e.target.checked)} style={{ transform: 'scale(1.5)' }} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={stat.is_starter} onChange={e => handleStatChange(p.user_id, 'is_starter', e.target.checked)} disabled={!stat.attended} style={{ transform: 'scale(1.2)' }} />
                          </td>
                          <td>
                            <select value={stat.position} onChange={e => handleStatChange(p.user_id, 'position', e.target.value)} disabled={!stat.is_starter} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px' }}>
                              <option value="">(なし)</option>
                              <option value="GK">GK</option>
                              <option value="Fixo">Fixo</option>
                              <option value="Ala L">Ala L</option>
                              <option value="Ala R">Ala R</option>
                              <option value="Pivo">Pivo</option>
                            </select>
                          </td>
                          <td>{p.jersey_number} {p.name}</td>
                          <td>
                            <input type="number" min="0" value={stat.goals} onChange={e => handleStatChange(p.user_id, 'goals', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                          <td>
                            <input type="number" min="0" value={stat.assists} onChange={e => handleStatChange(p.user_id, 'assists', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                          <td>
                            <input type="number" min="0" value={stat.saves} onChange={e => handleStatChange(p.user_id, 'saves', parseInt(e.target.value)||0)} disabled={!stat.attended} style={{ width: '100%', padding: '4px', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-dark-600)', paddingBottom: '0.5rem' }}>交代・ポジション設定</h3>
              <button type="button" onClick={addEvent} className={styles.addBtn} style={{ marginBottom: '1rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>+ タイムライン追加</button>
              {form.events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--color-dark-800)', padding: '8px', borderRadius: '4px' }}>
                  <input type="number" value={ev.minute_m ?? 0} onChange={e => updateEvent(i, 'minute_m', parseInt(e.target.value)||0)} placeholder="分" style={{ width: '50px', padding: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} /> 分
                  <input type="number" value={ev.minute_s ?? 0} onChange={e => updateEvent(i, 'minute_s', parseInt(e.target.value)||0)} max="59" placeholder="秒" style={{ width: '50px', padding: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', textAlign: 'center' }} /> 秒
                  <select value={ev.event_type} onChange={e => updateEvent(i, 'event_type', e.target.value)} style={{ padding: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px' }}>
                    <option value="sub_in">IN (交代出場)</option>
                    <option value="sub_out">OUT (ベンチへ)</option>
                    <option value="position_change">ポジション変更</option>
                    <option value="goal">ゴール</option>
                    <option value="assist">アシスト</option>
                    <option value="save">セーブ</option>
                    <option value="shot">シュート</option>
                    <option value="defense">ディフェンス</option>
                  </select>
                  <select value={ev.user_id} onChange={e => updateEvent(i, 'user_id', e.target.value)} style={{ padding: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px', flex: 1 }}>
                    <option value="">対象選手</option>
                    {players.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
                  </select>
                  <select value={ev.position} onChange={e => updateEvent(i, 'position', e.target.value)} style={{ padding: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '4px' }}>
                    <option value="">(ポジションを選択)</option>
                    <option value="GK">GK</option>
                    <option value="Fixo">Fixo</option>
                    <option value="Ala L">Ala L</option>
                    <option value="Ala R">Ala R</option>
                    <option value="Pivo">Pivo</option>
                  </select>
                  <button type="button" onClick={() => removeEvent(i)} className={styles.deleteBtn} style={{ padding: '4px 8px' }}>✕</button>
                </div>
              ))}

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
