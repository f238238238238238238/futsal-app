'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayers, createPlayer, updatePlayer, deletePlayer, uploadFile, getImageUrl } from '@/lib/api';
import styles from '../admin.module.css';

const POSITIONS = ['ゴレイロ', 'フィクソ', 'アラ', 'ピヴォ'];
const emptyForm = { name: '', email: '', password: 'player123', jersey_number: '', position: '', dominant_foot: '右', birth_date: '', height: '', weight: '', catchphrase: '', season_goal: '', salary: 0, stat_offense: 50, stat_defense: 50, stat_kick: 50, stat_speed: 50, stat_technique: 50, stat_stamina: 50, photo_url: '' };

export default function AdminPlayersPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const fetchPlayers = () => {
    getPlayers()
      .then(data => setPlayers(data.users || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlayers(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (p) => {
    setForm({
      name: p.name, email: p.email, password: '', jersey_number: p.jersey_number || '',
      position: p.position || '', dominant_foot: p.dominant_foot || '右',
      birth_date: p.birth_date || '', height: p.height || '', weight: p.weight || '',
      catchphrase: p.catchphrase || '', season_goal: p.season_goal || '',
      salary: p.salary || 0,
      stat_offense: p.stat_offense ?? 50, stat_defense: p.stat_defense ?? 50, stat_kick: p.stat_kick ?? 50,
      stat_speed: p.stat_speed ?? 50, stat_technique: p.stat_technique ?? 50, stat_stamina: p.stat_stamina ?? 50,
      photo_url: p.photo_url || ''
    });
    setEditingId(p.user_id);
    setShowModal(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const res = await uploadFile(file);
      setForm(prev => ({ ...prev, photo_url: res.url }));
      setMsg('画像をアップロードしました');
    } catch (err) {
      setMsg(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updatePlayer(editingId, form);
        setMsg('選手情報を更新しました');
      } else {
        await createPlayer(form);
        setMsg('選手を登録しました');
      }
      setShowModal(false);
      fetchPlayers();
    } catch (err) { setMsg(err.message); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`${name}を削除してもよろしいですか？`)) return;
    try {
      await deletePlayer(id);
      setMsg('削除しました');
      fetchPlayers();
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
          <h1 className={styles.adminTitle}>選手管理</h1>
        </div>
      </div>

      <div className={styles.topBar}>
        <span>{players.length} 名の選手</span>
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
                  <th>#</th>
                  <th>名前</th>
                  <th>ポジション</th>
                  <th>利き足</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {players.map(p => (
                  <tr key={p.user_id}>
                    <td style={{ fontWeight: 800 }}>{p.jersey_number || '-'}</td>
                    <td>{p.name}</td>
                    <td>{p.position || '-'}</td>
                    <td>{p.dominant_foot || '-'}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.editBtn} onClick={() => openEdit(p)}>編集</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(p.user_id, p.name)}>削除</button>
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
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingId ? '選手編集' : '新規選手登録'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>名前</label>
                  <input className={styles.formInput} required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>背番号</label>
                  <input type="number" className={styles.formInput} value={form.jersey_number} onChange={e => setForm({...form, jersey_number: e.target.value})} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>写真 (アップロード)</label>
                  <input type="file" accept="image/*" className={styles.formInput} onChange={handleFileChange} />
                  {form.photo_url && (
                    <div style={{ marginTop: '12px' }}>
                      <img src={getImageUrl(form.photo_url)} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%' }} />
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>ポジション</label>
                  <select className={`${styles.formInput} ${styles.formSelect}`} value={form.position} onChange={e => setForm({...form, position: e.target.value})}>
                    <option value="">選択</option>
                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>利き足</label>
                  <select className={`${styles.formInput} ${styles.formSelect}`} value={form.dominant_foot} onChange={e => setForm({...form, dominant_foot: e.target.value})}>
                    <option value="右">右</option>
                    <option value="左">左</option>
                    <option value="両方">両方</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>生年月日</label>
                  <input type="date" className={styles.formInput} value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>身長 (cm)</label>
                  <input type="number" className={styles.formInput} value={form.height} onChange={e => setForm({...form, height: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>体重 (kg)</label>
                  <input type="number" className={styles.formInput} value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>キャッチコピー</label>
                <input className={styles.formInput} value={form.catchphrase} onChange={e => setForm({...form, catchphrase: e.target.value})} />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>年俸 (円)</label>
                  <input type="number" className={styles.formInput} value={form.salary} onChange={e => setForm({...form, salary: parseInt(e.target.value, 10) || 0})} />
                </div>
              </div>
              
              <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-gold)' }}>能力ステータス (0〜100)</h3>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>オフェンス</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_offense} onChange={e => setForm({...form, stat_offense: parseInt(e.target.value, 10) || 0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>ディフェンス</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_defense} onChange={e => setForm({...form, stat_defense: parseInt(e.target.value, 10) || 0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>キック</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_kick} onChange={e => setForm({...form, stat_kick: parseInt(e.target.value, 10) || 0})} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>スピード</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_speed} onChange={e => setForm({...form, stat_speed: parseInt(e.target.value, 10) || 0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>テクニック</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_technique} onChange={e => setForm({...form, stat_technique: parseInt(e.target.value, 10) || 0})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>スタミナ</label>
                  <input type="number" min="0" max="100" className={styles.formInput} value={form.stat_stamina} onChange={e => setForm({...form, stat_stamina: parseInt(e.target.value, 10) || 0})} />
                </div>
              </div>

              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
                <button type="submit" className={styles.saveBtn}>{editingId ? '更新' : '登録'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
