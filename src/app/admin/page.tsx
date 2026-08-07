'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/console-x9f8');
  }, [router]);

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-slate-950 text-slate-400 text-xs font-mono">
      Redirecting to Security Console...
    </div>
  );
}
