'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';

const ADMIN_SECTIONS = [
  { href: '/admin/matches', icon: '⚽', title: '試合管理', desc: '試合結果の登録・編集、スコア・成績データの管理' },
  { href: '/admin/players', icon: '👥', title: '選手管理', desc: '選手の新規登録、基本情報の編集、退団処理' },
  { href: '/admin/news', icon: '📰', title: 'ニュース管理', desc: 'お知らせ記事の作成・編集・削除' },
  { href: '/admin/attendance', icon: '📋', title: '出欠管理', desc: 'イベントの出欠状況確認、未回答者の把握' },
  { href: '/admin/fumindor', icon: '🏆', title: 'FUMINDOR管理', desc: '年間MVPの登録・削除' },
  { href: '/admin/settings', icon: '⚙️', title: 'サイト設定', desc: 'TOPヒーロー画像等の設定' },
];

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}><div className={styles.spinner} /></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div className={styles.headerBg} />
          <h1 className={styles.pageTitle}>ADMIN</h1>
        </div>
        <div className="container">
          <div className={styles.denied}>
            <span className={styles.denyIcon}>🔒</span>
            <h2>アクセス権限がありません</h2>
            <p>管理者画面は管理者アカウントでログインする必要があります。</p>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>ADMIN</h1>
        <p className={styles.pageSubtitle}>管理者ダッシュボード</p>
      </div>

      <div className="container">
        <div className={styles.welcome}>
          <p>ようこそ、<strong>{user.name}</strong> さん</p>
        </div>

        <div className={styles.grid}>
          {ADMIN_SECTIONS.map((section, i) => (
            <Link
              key={section.href}
              href={section.href}
              className={styles.card}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <span className={styles.cardIcon}>{section.icon}</span>
              <h3 className={styles.cardTitle}>{section.title}</h3>
              <p className={styles.cardDesc}>{section.desc}</p>
              <span className={styles.cardArrow}>→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
