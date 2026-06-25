'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerPlayer } from '@/lib/api';
import styles from './page.module.css';

export default function RegisterPage() {
  const [name, setName] = useState('');
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
      await registerPlayer(name, email, password);
      alert('登録が完了しました！ログイン画面からログインしてください。');
      router.push('/login');
    } catch (err) {
      setError(err.message || '登録に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
            <span className={styles.loginIcon}>📝</span>
            <h1 className={styles.loginTitle}>SIGN UP</h1>
            <p className={styles.loginSubtitle}>選手アカウントを新規作成</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.errorMsg}>
                <span>⚠</span> {error}
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>お名前</label>
              <input
                type="text"
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="フルネーム"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>メールアドレス (ログインIDになります)</label>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                required
                autoComplete="email"
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
                autoComplete="new-password"
                minLength={6}
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
                '登録する'
              )}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link href="/login" style={{ color: 'var(--color-gold)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}>
              ← ログイン画面に戻る
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
