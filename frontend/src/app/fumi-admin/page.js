'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { secretLogin } from '@/lib/api';

export default function LoginPage() {
  const [error, setError] = useState('');
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'admin') {
      router.push('/admin');
      return;
    }

    async function doLogin() {
      try {
        const data = await secretLogin();
        localStorage.setItem('token', data.token);
        window.location.href = '/admin';
      } catch (err) {
        setError(err.message || 'ログインに失敗しました');
      }
    }
    
    if (!user) {
      doLogin();
    }
  }, [user, router]);

  return (
    <div className={styles.page}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <span className={styles.loginIcon}>⚽</span>
            <h1 className={styles.loginTitle}>ADMIN ACCESS</h1>
            <p className={styles.loginSubtitle}>管理者認証中...</p>
          </div>

          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            {error ? (
              <div className={styles.errorMsg}>
                <span>⚠</span> {error}
              </div>
            ) : (
              <div className={styles.btnSpinner} style={{ display: 'inline-block', width: '40px', height: '40px', borderWidth: '4px' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
