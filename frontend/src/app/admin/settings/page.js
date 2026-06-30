'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, updateSetting } from '@/lib/api';
import styles from '../admin.module.css';

export default function AdminSettingsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [heroImages, setHeroImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchSettings = async () => {
    try {
      const data = await getSettings();
      if (data.settings && data.settings.hero_images) {
        try {
          setHeroImages(JSON.parse(data.settings.hero_images));
        } catch(e) { setHeroImages([]); }
      } else if (data.settings && data.settings.hero_image_base64) {
        setHeroImages([data.settings.hero_image_base64]);
      } else if (data.settings && data.settings.hero_image_url) {
        setHeroImages([data.settings.hero_image_url]);
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
      setHeroImages(prev => [...prev, event.target.result]);
    };
    reader.readAsDataURL(file);
    e.target.value = null;
  };

  const handleRemoveImage = (index) => {
    setHeroImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateSetting('hero_images', JSON.stringify(heroImages));
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
                <label className={styles.formLabel}>ホーム画面スライド画像 (複数選択可)</label>
                <input 
                  type="file" 
                  accept="image/*"
                  className={styles.formInput} 
                  onChange={handleFileChange} 
                />
                <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {heroImages.map((img, index) => (
                    <div key={index} style={{ position: 'relative', width: '150px', height: '100px' }}>
                      <img src={img} alt={`Slide ${index+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
                      <button 
                        type="button" 
                        onClick={() => handleRemoveImage(index)}
                        style={{ position: 'absolute', top: '4px', right: '4px', background: 'var(--color-red)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-light-400)', marginTop: '0.5rem' }}>
                  画像を追加・削除して保存すると、TOPページで画像が数秒おきにスライド切り替えされるようになります。
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
