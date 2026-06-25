'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPlayers, getImageUrl } from '@/lib/api';
import styles from './page.module.css';

const POSITIONS = [
  { key: '', label: '全員' },
  { key: 'ゴレイロ', label: 'ゴレイロ' },
  { key: 'フィクソ', label: 'フィクソ' },
  { key: 'アラ', label: 'アラ' },
  { key: 'ピヴォ', label: 'ピヴォ' },
];

const POSITION_CLASSES = {
  'ゴレイロ': 'posGoleiro',
  'フィクソ': 'posFixo',
  'アラ': 'posAla',
  'ピヴォ': 'posPivo',
};

export default function PlayersPage() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState('');

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true);
      try {
        const data = await getPlayers(position || undefined);
        setPlayers(data.users || data.players || data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [position]);

  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.pageTitle}>Players</h1>

      <div className={styles.filters}>
        {POSITIONS.map(pos => (
          <button
            key={pos.key}
            className={`${styles.filterBtn} ${position === pos.key ? styles.filterBtnActive : ''}`}
            onClick={() => setPosition(pos.key)}
          >
            {pos.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}><div className={styles.spinner} /></div>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : players.length === 0 ? (
        <p className={styles.empty}>選手が見つかりません</p>
      ) : (
        <div className={styles.grid}>
          {players.map((player, i) => (
            <Link
              key={player.user_id || player.id || i}
              href={`/players/${player.user_id || player.id}`}
              className={styles.playerCard}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {player.photo_url && (
                <div className={styles.playerPhotoWrapper}>
                  <img src={getImageUrl(player.photo_url)} alt={player.name} className={styles.playerPhoto} />
                </div>
              )}
              <div className={styles.numberBadge}>{player.number ?? player.jersey_number ?? '-'}</div>
              <div className={styles.playerNumber}>{player.number ?? player.jersey_number ?? ''}</div>
              <div className={styles.playerInfo}>
                <div className={styles.playerName}>{player.name}</div>
                {player.position && (
                  <span className={`${styles.positionBadge} ${POSITION_CLASSES[player.position] || ''}`}>
                    {player.position}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
