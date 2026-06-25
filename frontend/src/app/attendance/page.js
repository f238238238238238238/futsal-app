'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getEvents, getEventAttendances, updateAttendance, getPlayers } from '@/lib/api';
import styles from './page.module.css';

const STATUS_CONFIG = {
  present: { label: '◯ 参加', color: 'var(--color-success)', bg: 'rgba(34,197,94,0.15)' },
  absent: { label: '✕ 不参加', color: 'var(--color-danger)', bg: 'rgba(239,68,68,0.15)' },
  pending: { label: '△ 未定', color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.15)' },
};

const EVENT_ICONS = { match: '⚽', practice: '🏃', other: '📌' };

export default function AttendancePage() {
  const [players, setPlayers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [events, setEvents] = useState([]);
  const [attendances, setAttendances] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const pData = await getPlayers();
      setPlayers(pData.users || pData || []);

      const data = await getEvents();
      const evts = data.events || data || [];
      setEvents(evts);

      // Fetch attendance for each event
      const attMap = {};
      await Promise.all(
        evts.map(async (ev) => {
          try {
            const att = await getEventAttendances(ev.event_id || ev.id);
            attMap[ev.event_id || ev.id] = att.attendances || att || [];
          } catch { attMap[ev.event_id || ev.id] = []; }
        })
      );
      setAttendances(attMap);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (eventId, status) => {
    if (!selectedUserId) {
      alert('自分の名前を選択してください');
      return;
    }
    setSaving(true);
    try {
      await updateAttendance({
        event_id: eventId,
        status,
        comment: comment || undefined,
        user_id: selectedUserId
      });
      await fetchData();
    } catch {}
    setSaving(false);
  };

  const getMyStatus = (eventId) => {
    if (!selectedUserId) return 'pending';
    const atts = attendances[eventId] || [];
    const mine = atts.find(a => a.user_id === parseInt(selectedUserId, 10));
    return mine?.status || 'pending';
  };

  const getStats = (eventId) => {
    const atts = attendances[eventId] || [];
    const present = atts.filter(a => a.status === 'present').length;
    const absent = atts.filter(a => a.status === 'absent').length;
    const pending = atts.filter(a => a.status === 'pending').length;
    return { present, absent, pending, total: atts.length };
  };



  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerBg} />
        <h1 className={styles.pageTitle}>ATTENDANCE</h1>
        <p className={styles.pageSubtitle}>出欠登録</p>
      </div>

      <div className="container">
        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : (
          <>
            <div className={styles.userSelectCard}>
              <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>登録する選手を選択してください</h2>
              <select 
                className={styles.userSelect} 
                value={selectedUserId} 
                onChange={e => setSelectedUserId(e.target.value)}
                style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', background: 'var(--color-dark-800)', color: 'white', border: '1px solid var(--color-dark-600)', borderRadius: '8px' }}
              >
                <option value="">-- 名前を選択 --</option>
                {players.map(p => (
                  <option key={p.user_id} value={p.user_id}>{p.jersey_number ? `#${p.jersey_number} ` : ''}{p.name}</option>
                ))}
              </select>
            </div>

            {events.length === 0 ? (
              <p className={styles.empty} style={{ marginTop: '2rem' }}>今後のイベントはありません</p>
            ) : (
              <div className={styles.eventList}>
            {events.map((event, i) => {
              const evId = event.event_id || event.id;
              const myStatus = getMyStatus(evId);
              const stats = getStats(evId);
              const isExpanded = expandedId === evId;
              const atts = attendances[evId] || [];

              return (
                <div
                  key={evId}
                  className={styles.eventCard}
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className={styles.eventMain}>
                    <div className={styles.eventIcon}>
                      {EVENT_ICONS[event.event_type] || '📌'}
                    </div>
                    <div className={styles.eventInfo}>
                      <div className={styles.eventDate}>
                        {new Date(event.date_time).toLocaleDateString('ja-JP', {
                          month: 'short', day: 'numeric', weekday: 'short'
                        })}
                        {' '}
                        {new Date(event.date_time).toLocaleTimeString('ja-JP', {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                      <h3 className={styles.eventTitle}>{event.title}</h3>
                      {event.location && (
                        <span className={styles.eventLocation}>📍 {event.location}</span>
                      )}
                    </div>
                  </div>

                  {/* Status buttons */}
                  <div className={styles.statusButtons}>
                    {['present', 'absent', 'pending'].map(status => (
                      <button
                        key={status}
                        className={`${styles.statusBtn} ${myStatus === status ? styles.statusActive : ''}`}
                        style={myStatus === status ? {
                          background: STATUS_CONFIG[status].bg,
                          color: STATUS_CONFIG[status].color,
                          borderColor: STATUS_CONFIG[status].color,
                        } : {}}
                        onClick={() => handleStatusChange(evId, status)}
                        disabled={saving}
                      >
                        {STATUS_CONFIG[status].label}
                      </button>
                    ))}
                  </div>

                  {/* Comment input */}
                  <div className={styles.commentArea}>
                    <input
                      type="text"
                      className={styles.commentInput}
                      placeholder="コメント（遅刻・早退の連絡など）"
                      defaultValue={selectedUserId ? (atts.find(a => a.user_id === parseInt(selectedUserId, 10))?.comment || '') : ''}
                      onBlur={(e) => setComment(e.target.value)}
                      disabled={!selectedUserId}
                    />
                  </div>

                  {/* Attendance stats bar */}
                  <div className={styles.statsBar}>
                    <div className={styles.progressBar}>
                      {stats.total > 0 && (
                        <>
                          <div
                            className={styles.progressPresent}
                            style={{ width: `${(stats.present / stats.total) * 100}%` }}
                          />
                          <div
                            className={styles.progressPending}
                            style={{ width: `${(stats.pending / stats.total) * 100}%` }}
                          />
                        </>
                      )}
                    </div>
                    <div className={styles.statsLabels}>
                      <span className={styles.statPresent}>参加 {stats.present}</span>
                      <span className={styles.statAbsent}>不参加 {stats.absent}</span>
                      <span className={styles.statPending}>未定 {stats.pending}</span>
                    </div>

                    <button
                      className={styles.expandBtn}
                      onClick={() => setExpandedId(isExpanded ? null : evId)}
                    >
                      {isExpanded ? '閉じる ▲' : '参加者を見る ▼'}
                    </button>
                  </div>

                  {/* Expanded attendee list */}
                  {isExpanded && (
                    <div className={styles.attendeeList}>
                      {atts.length === 0 ? (
                        <p className={styles.noAttendees}>回答がありません</p>
                      ) : (
                        atts.map((att, idx) => (
                          <div key={idx} className={styles.attendeeItem}>
                            <span className={styles.attendeeName}>{att.name || att.user_name}</span>
                            <span
                              className={styles.attendeeStatus}
                              style={{ color: STATUS_CONFIG[att.status]?.color }}
                            >
                              {STATUS_CONFIG[att.status]?.label}
                            </span>
                            {att.comment && (
                              <span className={styles.attendeeComment}>{att.comment}</span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
