'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPlayer, updatePlayer } from '@/lib/api';
import styles from '../admin/admin.module.css';

export default function MyPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!authLoading && user) {
      getPlayer(user.userId)
        .then(data => {
          setProfile(data);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    } else if (!authLoading && !user) {
      window.location.href = '/login';
    }
  }, [user, authLoading]);

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      await updatePlayer(user.userId, profile);
      setSuccessMsg('プロフィールを更新しました。');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || '更新に失敗しました');
    }
  };

  if (authLoading || loading) return <div className={styles.adminPage}><div className={styles.loading}><div className={styles.spinner} /></div></div>;
  if (!profile) return <div className={styles.adminPage}><p className={styles.empty}>エラーが発生しました: {error}</p></div>;

  return (
    <div className={styles.adminPage}>
      <div className={styles.adminHeader}>
        <div className={styles.adminHeaderBg} />
        <div className={styles.adminHeaderInner}>
          <h1 className={styles.adminTitle}>MY PAGE</h1>
          <p style={{color: 'var(--color-primary-400)'}}>プロフィール設定</p>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
        {successMsg && <div className={styles.successMsg}>{successMsg}</div>}
        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.modal} style={{ margin: '0', maxWidth: '100%' }}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>お名前 *</label>
                <input className={styles.formInput} required value={profile.name || ''} onChange={e => handleChange('name', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>背番号</label>
                <input type="number" className={styles.formInput} value={profile.jersey_number || ''} onChange={e => handleChange('jersey_number', parseInt(e.target.value)||'')} />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>ポジション</label>
                <select className={`${styles.formInput} ${styles.formSelect}`} value={profile.position || ''} onChange={e => handleChange('position', e.target.value)}>
                  <option value="">未設定</option>
                  <option value="GK">GK</option>
                  <option value="Fixo">Fixo</option>
                  <option value="Ala L">Ala L</option>
                  <option value="Ala R">Ala R</option>
                  <option value="Pivo">Pivo</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>利き足</label>
                <select className={`${styles.formInput} ${styles.formSelect}`} value={profile.dominant_foot || ''} onChange={e => handleChange('dominant_foot', e.target.value)}>
                  <option value="">未設定</option>
                  <option value="右">右</option>
                  <option value="左">左</option>
                  <option value="両足">両足</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>生年月日</label>
                <input type="date" className={styles.formInput} value={profile.birth_date ? profile.birth_date.substring(0,10) : ''} onChange={e => handleChange('birth_date', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>身長 (cm)</label>
                <input type="number" step="0.1" className={styles.formInput} value={profile.height || ''} onChange={e => handleChange('height', e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>体重 (kg)</label>
                <input type="number" step="0.1" className={styles.formInput} value={profile.weight || ''} onChange={e => handleChange('weight', e.target.value)} />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>写真URL</label>
              <input type="url" className={styles.formInput} value={profile.photo_url || ''} onChange={e => handleChange('photo_url', e.target.value)} placeholder="https://..." />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>キャッチフレーズ</label>
              <input className={styles.formInput} value={profile.catchphrase || ''} onChange={e => handleChange('catchphrase', e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>フットサルを始めたきっかけ</label>
              <textarea className={`${styles.formInput} ${styles.formTextarea}`} value={profile.reason_started || ''} onChange={e => handleChange('reason_started', e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>趣味</label>
              <input className={styles.formInput} value={profile.hobby || ''} onChange={e => handleChange('hobby', e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>今季の目標</label>
              <input className={styles.formInput} value={profile.season_goal || ''} onChange={e => handleChange('season_goal', e.target.value)} />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>好きなシューズ</label>
              <input className={styles.formInput} value={profile.favorite_shoes || ''} onChange={e => handleChange('favorite_shoes', e.target.value)} />
            </div>

            <div className={styles.modalActions}>
              <button type="submit" className={styles.saveBtn}>保存する</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
