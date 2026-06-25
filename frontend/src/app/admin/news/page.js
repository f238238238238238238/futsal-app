'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getNewsList, createNews, updateNews, deleteNews } from '@/lib/api';
import styles from '../admin.module.css';

const CATEGORIES = ['公式戦', '練習', 'イベント', 'お知らせ'];
const emptyForm = { title: '', content: '', category: 'お知らせ', image_url: '' };

export default function AdminNewsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState('');

  const fetchNews = () => {
    getNewsList()
      .then(data => setNews(data.news || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNews(); }, []);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowModal(true); };
  const openEdit = (n) => {
    setForm({ title: n.title, content: n.content || '', category: n.category || 'お知らせ', image_url: n.image_url || '' });
    setEditingId(n.news_id || n.id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateNews(editingId, form);
        setMsg('ニュースを更新しました');
      } else {
        await createNews(form);
        setMsg('ニュースを作成しました');
      }
      setShowModal(false);
      fetchNews();
    } catch (err) { setMsg(err.message); }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    try {
      await deleteNews(id);
      setMsg('削除しました');
      fetchNews();
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
          <h1 className={styles.adminTitle}>ニュース管理</h1>
        </div>
      </div>

      <div className={styles.topBar}>
        <span>{news.length} 件のニュース</span>
        <button className={styles.addBtn} onClick={openCreate}>+ 新規作成</button>
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
                  <th>タイトル</th>
                  <th>カテゴリ</th>
                  <th>作成日</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {news.map(n => (
                  <tr key={n.news_id || n.id}>
                    <td>{n.title}</td>
                    <td>{n.category || '-'}</td>
                    <td>{new Date(n.created_at).toLocaleDateString('ja-JP')}</td>
                    <td>
                      <div className={styles.actionBtns}>
                        <button className={styles.editBtn} onClick={() => openEdit(n)}>編集</button>
                        <button className={styles.deleteBtn} onClick={() => handleDelete(n.news_id || n.id, n.title)}>削除</button>
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
            <h2 className={styles.modalTitle}>{editingId ? 'ニュース編集' : '新規ニュース作成'}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>タイトル</label>
                <input className={styles.formInput} required value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>カテゴリ</label>
                <select className={`${styles.formInput} ${styles.formSelect}`} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>本文 (HTML対応)</label>
                <textarea className={`${styles.formInput} ${styles.formTextarea}`} rows="10" value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="ニュース本文を入力（HTMLタグ使用可）" />
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>キャンセル</button>
                <button type="submit" className={styles.saveBtn}>{editingId ? '更新' : '作成'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
