'use client';

import { useEffect, useState } from 'react';

function getCurrentPageActivity() {
  if (typeof document === 'undefined') return true;
  const visible = document.visibilityState === 'visible';
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  return visible && online;
}

export function usePageActivity() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => setActive(getCurrentPageActivity());
    update();

    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return active;
}
