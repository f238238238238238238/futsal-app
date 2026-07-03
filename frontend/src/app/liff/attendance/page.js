'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import liff from '@line/liff';

function AttendanceContent() {
  const searchParams = useSearchParams();
  const [cups, setCups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attendances, setAttendances] = useState({});

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "1234567890-AbcdEfgh"; // Fallback for dev
        await liff.init({ liffId });
        
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const userProfile = await liff.getProfile();
        setProfile(userProfile);

        // Fetch cups from backend based on query params
        const month = searchParams.get('month');
        const dows = searchParams.get('dows') || searchParams.get('dow'); // API supports dows
        
        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        if (baseUrl.endsWith('/api')) {
          baseUrl = baseUrl.slice(0, -4);
        }
        let url = `${baseUrl}/api/cups`;
        const params = new URLSearchParams();
        if (month) params.append('month', month);
        if (dows) params.append('dows', dows);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch cups');
        const data = await res.json();
        
        setCups(data);
        
        // Initialize attendances state
        const initialAtt = {};
        data.forEach(cup => {
          initialAtt[cup.isoDate] = {
            dateStr: cup.isoDate,
            shortTitle: cup.title.substring(0, 40),
            timeStr: cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/) ? cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/)[1] : '',
            status: 'pending' // Default
          };
        });
        setAttendances(initialAtt);

      } catch (err) {
        console.error('LIFF init or fetch error', err);
        setError('エラーが発生しました: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    initLiff();
  }, [searchParams]);

  const handleStatusChange = (isoDate, status) => {
    setAttendances(prev => ({
      ...prev,
      [isoDate]: {
        ...prev[isoDate],
        status
      }
    }));
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        lineUserId: profile.userId,
        lineDisplayName: profile.displayName,
        attendances: Object.values(attendances).filter(a => a.status !== 'pending')
      };

      let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      if (baseUrl.endsWith('/api')) {
        baseUrl = baseUrl.slice(0, -4);
      }

      const res = await fetch(`${baseUrl}/api/attendance/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save');
      setSuccess(true);
      
      // Close LIFF app after a short delay
      setTimeout(() => {
        liff.closeWindow();
      }, 2000);

    } catch (err) {
      console.error(err);
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (success) return (
    <div className="p-8 text-center">
      <div className="text-5xl mb-4">🎉</div>
      <h2 className="text-xl font-bold text-green-600 mb-2">保存が完了しました！</h2>
      <p className="text-gray-600">この画面は自動的に閉じます。</p>
    </div>
  );

  return (
    <div className="max-w-md mx-auto p-4 pb-32">
      <div className="mb-6 flex items-center space-x-3">
        {profile?.pictureUrl && (
          <img src={profile.pictureUrl} alt="profile" className="w-10 h-10 rounded-full shadow-md" />
        )}
        <h1 className="text-xl font-bold text-gray-800">
          出欠の一括登録
        </h1>
      </div>

      <p className="text-sm text-gray-600 mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100">
        参加・不参加を選択して、一番下の「保存する」ボタンを押してください。
      </p>

      {cups.length === 0 ? (
        <div className="text-center text-gray-500 py-10">該当する大会が見つかりませんでした。</div>
      ) : (
        <div className="space-y-4">
          {cups.map((cup, i) => {
            const timeMatch = cup.dateText.match(/(\d{1,2}:\d{2}.*\d{1,2}:\d{2})/);
            const timeStr = timeMatch ? timeMatch[1] : '';
            const pParts = cup.isoDate.split('-');
            const mDate = pParts.length >= 3 ? `${parseInt(pParts[1], 10)}月${parseInt(pParts[2], 10)}日` : cup.isoDate;
            const currentStatus = attendances[cup.isoDate]?.status || 'pending';

            return (
              <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-800 text-lg">{mDate}</span>
                    {cup.availability !== '情報なし' && (
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded-full font-medium text-gray-600">
                        {cup.availability}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{timeStr}</div>
                  <div className="text-sm font-medium text-gray-900 leading-tight">🏆 {cup.title}</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleStatusChange(cup.isoDate, 'present')}
                    className={`py-2 text-sm font-bold rounded-lg transition-colors ${currentStatus === 'present' ? 'bg-[#1DB446] text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
                  >
                    参加
                  </button>
                  <button
                    onClick={() => handleStatusChange(cup.isoDate, 'absent')}
                    className={`py-2 text-sm font-bold rounded-lg transition-colors ${currentStatus === 'absent' ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
                  >
                    不参加
                  </button>
                  <button
                    onClick={() => handleStatusChange(cup.isoDate, 'pending')}
                    className={`py-2 text-sm font-bold rounded-lg transition-colors ${currentStatus === 'pending' ? 'bg-gray-700 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
                  >
                    未定
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cups.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200">
          <div className="max-w-md mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 bg-[#1DB446] text-white text-lg font-bold rounded-xl shadow-lg hover:bg-[#199d3d] active:scale-95 transition-all flex justify-center items-center"
            >
              {saving ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "一括で保存する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <AttendanceContent />
    </Suspense>
  );
}
