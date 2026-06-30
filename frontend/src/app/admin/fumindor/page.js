'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getFumindor, createFumindor, deleteFumindor, getPlayers } from '@/lib/api';
import styles from '../admin.module.css';

const emptyForm = { year: new Date().getFullYear(), user_id: '', description: '' };

export default function AdminFumindorPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [awards, setAwards] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    try {
      const [awardsData, playersData] = await Promise.all([
        getFumindor(),
        getPlayers()
      ]);
      setAwards(awardsData.awards || []);
      setPlayers(playersData.users || playersData || []);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setForm(emptyForm); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createFumindor(form);
      setMsg('FUMINDORを登録しました');
      setShowModal(false);
      fetchData();
    } catch (err) { setMsg(err.message); }
  };

  const handleDelete = async (id, year) => {
    if (!confirm(`${year}年度のMVPを削除してもよろしいですか？`)) return;
    try {
      await deleteFumindor(id);
      setMsg('削除しました');
      fetchData();
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
          <h1 className={styles.adminTitle}>FUMINDOR管理</h1>
        </div>
      </div>

      <div className={styles.topBar}>
        <span>{awards.length} 件の記録</span>
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
                  <th>年度</th>
                  <th>選手名</th>
                  <th>ゴール</th>
                  <th>アシスト</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {awards.map(a => (
                  <tr key={a.fumindor_id}>
                    <td style={{ fontWeight: 800 }}>{a.year}</td>
                    <td>{a.name}</td>
                    <td>{a.goals}</td>
                    <td>{a.assists}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(a.fumindor_id, a.year)}>削除</button>
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
            <h2 className={styles.modalTitle}>FUMINDOR登録</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>年度</label>
                  <input type="number" className={styles.formInput} required value={form.year} onChange={e => setForm({...form, year: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>選手</label>
                  <select className={`${styles.formInput} ${styles.formSelect}`} required value={form.user_id} onChange={e => setForm({...form, user_id: e.target.value})}>
                    <option value="">選択してください</option>
                    {players.map(p => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>選出理由・コメント</label>
                <textarea className={styles.formInput} style={{ height: '100px' }} value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
                <button type="submit" className={styles.saveBtn}>登録</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
