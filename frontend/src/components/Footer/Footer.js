import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <span className="stripeMark" aria-hidden="true" />
              <span className={styles.logoText}>FUMINTUS</span>
            </div>
            <p className={styles.tagline}>Victory is a state of mind.</p>
          </div>

          <div className={styles.links}>
            <h4 className={styles.linksTitle}>Club</h4>
            <ul className={styles.linksList}>
              <li><Link href="/players">Players</Link></li>
              <li><Link href="/matches">Matches</Link></li>
              <li><Link href="/rankings">Rankings</Link></li>
            </ul>
          </div>

          <div className={styles.links}>
            <h4 className={styles.linksTitle}>More</h4>
            <ul className={styles.linksList}>
              <li><Link href="/fumindor">Fumindor</Link></li>
              <li><Link href="/news">News</Link></li>
              <li><Link href="/attendance">Attendance</Link></li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            &copy; {currentYear} FUMINTUS
          </p>
        </div>
      </div>
    </footer>
  );
}
