'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, updateSetting } from '@/lib/api';
import styles from '../admin.module.css';

export default function AdminSettingsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [heroImage, setHeroImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data.settings && data.settings.hero_image_base64) {
        setHeroImage(data.settings.hero_image_base64);
      } else if (data.settings && data.settings.hero_image_url) {
        setHeroImage(data.settings.hero_image_url);
      }
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setHeroImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSetting('hero_image_base64', heroImage);
      setMsg('設定を保存しました');
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
          <h1 className={styles.adminTitle}>サイト設定</h1>
        </div>
      </div>

      {msg && <div className="container"><div className={styles.successMsg}>{msg}</div></div>}

      <div className="container" style={{ marginTop: '2rem' }}>
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : (
          <div className={styles.modal} style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 className={styles.modalTitle}>トップページ設定</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>待ち受け画像 (ファイルアップロード)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  className={styles.formInput} 
                  onChange={handleFileChange} 
                />
                {heroImage && (
                  <div style={{ marginTop: '1rem' }}>
                    <img src={heroImage} alt="Hero Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} />
                  </div>
                )}
                <p style={{ fontSize: '0.8rem', color: 'var(--color-light-400)', marginTop: '0.5rem' }}>
                  画像を選択して保存すると、TOPページの背景がその画像に切り替わります。
                </p>
              </div>
              <div className={styles.modalActions} style={{ justifyContent: 'flex-start' }}>
                <button type="submit" className={styles.saveBtn}>設定を保存</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
