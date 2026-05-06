import { useEffect, useState } from 'react';
import { onInstallable, promptInstall, isStandalone } from '../lib/pwa';

export function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('install_dismissed') === '1',
  );

  useEffect(() => onInstallable(setCanInstall), []);

  if (!canInstall || dismissed || isStandalone()) return null;

  return (
    <div className="fixed inset-x-2 bottom-20 z-30 bg-indigo-600 text-white rounded-2xl shadow-lg p-3 flex items-center gap-3">
      <div className="flex-1 text-sm">
        <div className="font-semibold">ثبّت التطبيق</div>
        <div className="text-xs opacity-90">للوصول السريع وحفظ الفواتير دون اتصال</div>
      </div>
      <button
        className="bg-white/15 hover:bg-white/25 text-xs px-3 py-2 rounded-lg"
        onClick={() => {
          sessionStorage.setItem('install_dismissed', '1');
          setDismissed(true);
        }}
      >
        لاحقاً
      </button>
      <button
        className="bg-white text-indigo-700 text-xs font-semibold px-3 py-2 rounded-lg"
        onClick={async () => {
          const r = await promptInstall();
          if (r === 'accepted' || r === 'dismissed') setDismissed(true);
        }}
      >
        تثبيت
      </button>
    </div>
  );
}
