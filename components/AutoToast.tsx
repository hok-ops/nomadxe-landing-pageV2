'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from './ToastProvider';

function ToastWatcher() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (success) {
      showToast(success, 'success');
      // Clean URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('success');
      router.replace(window.location.pathname + (params.toString() ? `?${params.toString()}` : ''));
    }

    if (error) {
      showToast(error, 'error');
      // Clean URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('error');
      router.replace(window.location.pathname + (params.toString() ? `?${params.toString()}` : ''));
    }
  }, [searchParams, router, showToast]);

  return null;
}

export default function AutoToast() {
  return (
    <Suspense fallback={null}>
      <ToastWatcher />
    </Suspense>
  );
}
