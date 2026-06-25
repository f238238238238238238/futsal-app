import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.goldLine} />
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>⚽</span>
              <span className={styles.logoText}>FUMINTUS</span>
            </div>
            <p className={styles.tagline}>
              Victory is a state of mind.
            </p>
          </div>

          <div className={styles.links}>
            <h4 className={styles.linksTitle}>MENU</h4>
            <ul className={styles.linksList}>
              <li><Link href="/players">PLAYERS</Link></li>
              <li><Link href="/matches">MATCHES</Link></li>
              <li><Link href="/rankings">RANKINGS</Link></li>
              <li><Link href="/fumindor">FUMINDOR</Link></li>
              <li><Link href="/news">NEWS</Link></li>
              <li><Link href="/attendance">ATTENDANCE</Link></li>
            </ul>
          </div>


        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {currentYear} FUMINTUS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
