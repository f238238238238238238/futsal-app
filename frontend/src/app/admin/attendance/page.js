'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getEvents, getEventAttendances, createEvent, updateEvent, deleteEvent } from '@/lib/api';
import styles from '../admin.module.css';

const STATUS_LABELS = {
  present: { label: '出席確定', color: '#22c55e' },
  absent: { label: '不参加', color: '#ef4444' },
  pending: { label: '参加予定', color: '#3b82f6' },
};

export default function AdminAttendancePage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    event_type: 'practice',
    date_time: '',
    location: '',
    description: ''
  });

  useEffect(() => {
    getEvents()
      .then(data => {
        const evts = data.events || data || [];
        setEvents(evts);
        if (evts.length > 0) selectEvent(evts[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectEvent = async (event) => {
    setSelectedEvent(event);
    try {
      const data = await getEventAttendances(event.event_id || event.id);
      setAttendances(data.attendances || data || []);
    } catch { setAttendances([]); }
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    if (!confirm(`イベント「${selectedEvent.title}」を削除してもよろしいですか？\n※登録された出欠データも全て削除されます。`)) return;
    try {
      await deleteEvent(selectedEvent.event_id || selectedEvent.id);
      const data = await getEvents();
      const evts = data.events || data || [];
      setEvents(evts);
      if (evts.length > 0) {
        selectEvent(evts[0]);
      } else {
        setSelectedEvent(null);
        setAttendances([]);
      }
      alert('イベントを削除しました。');
    } catch (err) {
      alert(err.message || '削除に失敗しました');
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setFormData({
      title: '',
      event_type: 'practice',
      date_time: '',
      location: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedEvent) return;
    setEditingEvent(selectedEvent);
    setFormData({
      title: selectedEvent.title || '',
      event_type: selectedEvent.event_type || 'practice',
      date_time: selectedEvent.date_time ? selectedEvent.date_time.slice(0, 16) : '',
      location: selectedEvent.location || '',
      description: selectedEvent.description || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.event_id || editingEvent.id, formData);
        alert('イベントを更新しました。');
      } else {
        await createEvent(formData);
        alert('イベントを作成しました。');
      }
      setIsModalOpen(false);
      // 再取得
      const data = await getEvents();
      const evts = data.events || data || [];
      setEvents(evts);
      if (editingEvent) {
        const updated = evts.find(ev => (ev.event_id || ev.id) === (editingEvent.event_id || editingEvent.id));
        if (updated) selectEvent(updated);
      } else if (evts.length > 0) {
        selectEvent(evts[0]);
      }
    } catch (err) {
      alert(err.message || '保存に失敗しました');
    }
  };

  if (authLoading) return <div className={styles.adminPage}><div className={styles.loading}><div className={styles.spinner} /></div></div>;
  if (!isAdmin) return <div className={styles.adminPage}><p className={styles.empty}>管理者権限が必要です</p></div>;

  const pendingCount = attendances.filter(a => a.status === 'pending').length;
  const presentCount = attendances.filter(a => a.status === 'present').length;
  const absentCount = attendances.filter(a => a.status === 'absent').length;

  return (
    <div className={styles.adminPage}>
      <div className={styles.adminHeader}>
        <div className={styles.adminHeaderBg} />
        <div className={styles.adminHeaderInner}>
          <Link href="/admin" className={styles.adminBack}>← ADMIN</Link>
          <h1 className={styles.adminTitle}>出欠管理</h1>
        </div>
      </div>

      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            onClick={openCreateModal}
            style={{ background: 'var(--color-gold)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
          >
            ＋ 新規イベント作成
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}><div className={styles.spinner} /></div>
        ) : events.length === 0 ? (
          <p className={styles.empty}>イベントがありません。新しく作成してください。</p>
        ) : (
          <div style={{ display: 'flex', gap: '24px', padding: '24px 0 64px', flexWrap: 'wrap' }}>
            {/* Event selector */}
            <div style={{ flex: '0 0 240px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-gold)' }}>
                  イベント選択
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {events.map(ev => (
                  <button
                    key={ev.event_id || ev.id}
                    onClick={() => selectEvent(ev)}
                    style={{
                      padding: '10px 14px', textAlign: 'left', borderRadius: '8px', border: '1px solid',
                      borderColor: selectedEvent?.event_id === ev.event_id ? 'var(--color-gold)' : 'var(--color-dark-600)',
                      background: selectedEvent?.event_id === ev.event_id ? 'rgba(197,160,89,0.1)' : 'var(--color-dark-800)',
                      cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-white)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '2px' }}>{ev.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-light-400)' }}>
                      {new Date(ev.date_time).toLocaleDateString('ja-JP')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Attendance table */}
            <div style={{ flex: 1, minWidth: '300px' }}>
              {selectedEvent && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', fontWeight: 700 }}>
                      <span style={{ color: '#22c55e' }}>出席確定: {presentCount}</span>
                      <span style={{ color: '#ef4444' }}>不参加: {absentCount}</span>
                      <span style={{ color: '#3b82f6' }}>参加予定: {pendingCount}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={openEditModal}
                        style={{ background: 'var(--color-dark-500)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        編集
                      </button>
                      <button 
                        onClick={handleDeleteEvent}
                        style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>選手</th>
                          <th>ステータス</th>
                          <th>コメント</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendances.map((a, i) => (
                          <tr key={i} style={a.status === 'pending' ? { background: 'rgba(245,158,11,0.05)' } : {}}>
                            <td style={{ fontWeight: 600 }}>{a.name || a.user_name}</td>
                            <td>
                              <span style={{
                                display: 'inline-flex', padding: '3px 10px', borderRadius: '999px',
                                fontSize: '0.7rem', fontWeight: 700,
                                background: `${STATUS_LABELS[a.status]?.color}20`,
                                color: STATUS_LABELS[a.status]?.color
                              }}>
                                {STATUS_LABELS[a.status]?.label}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--color-light-400)' }}>{a.comment || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            background: 'var(--color-dark-800)', border: '1px solid var(--color-dark-500)',
            borderRadius: '12px', width: '90%', maxWidth: '500px', padding: '24px'
          }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', color: 'var(--color-white)' }}>
              {editingEvent ? 'イベント編集' : 'イベント新規登録'}
            </h2>
            <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-light-400)', marginBottom: '4px' }}>タイトル</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-light-400)', marginBottom: '4px' }}>種別</label>
                <select value={formData.event_type} onChange={e => setFormData({...formData, event_type: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)' }}>
                  <option value="practice">練習</option>
                  <option value="match">試合</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-light-400)', marginBottom: '4px' }}>日時</label>
                <input required type="datetime-local" value={formData.date_time} onChange={e => setFormData({...formData, date_time: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-light-400)', marginBottom: '4px' }}>場所</label>
                <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--color-light-400)', marginBottom: '4px' }}>詳細</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', background: 'var(--color-dark-900)', color: 'white', border: '1px solid var(--color-dark-600)' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: 'var(--color-gold)', color: '#000', fontWeight: 'bold', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>保存する</button>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '10px', background: 'transparent', color: 'var(--color-white)', border: '1px solid var(--color-dark-500)', borderRadius: '6px', cursor: 'pointer' }}>キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
