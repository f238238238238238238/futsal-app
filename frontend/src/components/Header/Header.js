'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Header.module.css';

const NAV_LINKS = [
  { href: '/', label: 'TOP' },
  { href: '/players', label: 'PLAYERS' },
  { href: '/matches', label: 'MATCHES' },
  { href: '/rankings', label: 'RANKINGS' },
  { href: '/fumindor', label: 'FUMINDOR' },
  { href: '/news', label: 'NEWS' },
  { href: '/attendance', label: 'ATTENDANCE' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { user, logout, isAdmin } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoIcon}>⚽</span>
          <span className={styles.logoText}>FUMINTUS</span>
        </Link>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
          <ul className={styles.navList}>
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${styles.navLink} ${pathname === link.href ? styles.navLinkActive : ''}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  className={`${styles.navLink} ${styles.navLinkAdmin} ${pathname.startsWith('/admin') ? styles.navLinkActive : ''}`}
                >
                  ADMIN
                </Link>
              </li>
            )}
          </ul>

          <div className={styles.navActions}>
            {user ? (
              <div className={styles.userMenu}>
                <Link href="/mypage" className={styles.userName}>👤 {user.name} (設定)</Link>
                <button onClick={logout} className={styles.logoutBtn}>
                  LOGOUT
                </button>
              </div>
            ) : null}
          </div>
        </nav>

        <button
          className={`${styles.hamburger} ${menuOpen ? styles.hamburgerOpen : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="メニュー"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
