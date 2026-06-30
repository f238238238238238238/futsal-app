'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import styles from '../register/page.module.css'; // Reusing register styles

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.token);
      window.location.href = '/mypage';
    } catch (err) {
      setError(err.message || 'ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <span className={styles.loginIcon}>🔑</span>
            <h1 className={styles.loginTitle}>LOGIN</h1>
            <p className={styles.loginSubtitle}>ログイン</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorMsg}>
                <span>⚠</span> {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>メールアドレス</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>パスワード</label>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
              />
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.btnSpinner} />
              ) : (
                'ログイン'
              )}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link href="/register" style={{ color: 'var(--color-gold)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>
              新規メール登録はこちら →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
