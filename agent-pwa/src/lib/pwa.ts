/**
 * PWA install prompt handling.
 *
 * Browsers that support installation fire `beforeinstallprompt`. We capture it,
 * stop the default mini-bar, and expose the deferred prompt so a UI button
 * can call .prompt() on user gesture.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
type Listener = (canInstall: boolean) => void;
const listeners = new Set<Listener>();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as BeforeInstallPromptEvent;
  notify();
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

function notify() {
  for (const fn of listeners) fn(!!deferred);
}

export function onInstallable(fn: Listener) {
  listeners.add(fn);
  fn(!!deferred);
  return () => { listeners.delete(fn); };
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}
