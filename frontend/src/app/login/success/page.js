'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function SuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/mypage';
    } else {
      router.push('/login?error=no_token');
    }
  }, [searchParams, router]);

  return <p style={{ textAlign: 'center', padding: '2rem' }}>ログイン処理中...</p>;
}

export default function LoginSuccessPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <SuccessHandler />
    </Suspense>
  );
}
