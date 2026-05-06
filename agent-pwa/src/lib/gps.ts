import { api } from './api';
import { enqueue } from './db';

const SUBMIT_INTERVAL_MS = 30_000;

interface BufferedPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  battery?: number;
  recordedAt: string;
}

let intervalHandle: number | null = null;
let watchId: number | null = null;
let buffer: BufferedPoint[] = [];
let lastBattery: number | undefined;
let trackingEnabled = false;

type StatusListener = (s: { tracking: boolean; lastSentAt?: number }) => void;
const listeners = new Set<StatusListener>();
let lastSentAt: number | undefined;

export function onTrackingStatus(fn: StatusListener) {
  listeners.add(fn);
  fn({ tracking: trackingEnabled, lastSentAt });
  return () => { listeners.delete(fn); };
}

function notify() {
  const s = { tracking: trackingEnabled, lastSentAt };
  for (const fn of listeners) fn(s);
}

async function readBattery() {
  // navigator.getBattery is non-standard but widely supported; ignore failures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (typeof nav.getBattery === 'function') {
    try {
      const b = await nav.getBattery();
      lastBattery = Math.round(b.level * 100);
    } catch { /* ignore */ }
  }
}

function pushPoint(pos: GeolocationPosition) {
  buffer.push({
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? undefined,
    speed: pos.coords.speed ?? undefined,
    heading: pos.coords.heading ?? undefined,
    battery: lastBattery,
    recordedAt: new Date(pos.timestamp || Date.now()).toISOString(),
  });
  // Trim buffer in case sync is failing for a while
  if (buffer.length > 500) buffer = buffer.slice(-500);
}

async function flushBuffer() {
  if (!buffer.length) return;
  const points = buffer.splice(0, buffer.length);
  try {
    if (navigator.onLine) {
      await api.post('/tracking/location/batch', { points });
    } else {
      await enqueue({ kind: 'tracking.batch', payload: { points } });
    }
    lastSentAt = Date.now();
    notify();
  } catch {
    // Network error → queue for later
    await enqueue({ kind: 'tracking.batch', payload: { points } });
  }
}

/**
 * Start GPS tracking. Triggers a one-time geolocation prompt the first time.
 *
 *  - Uses watchPosition for low-power continuous updates from the browser
 *  - Every 30 s, batches buffered points and POSTs to /tracking/location/batch
 *  - Falls back to outbox queue when offline
 *  - Stops automatically on logout
 */
export async function startTracking() {
  if (trackingEnabled) return;
  if (!('geolocation' in navigator)) return;

  trackingEnabled = true;
  await readBattery();

  watchId = navigator.geolocation.watchPosition(
    pushPoint,
    (err) => {
      // Permission denied or position unavailable → keep tracking flag but no buffer
      console.warn('geolocation error', err.message);
    },
    {
      enableHighAccuracy: false,
      maximumAge: 10_000,
      timeout: 25_000,
    },
  );

  intervalHandle = window.setInterval(() => {
    void flushBuffer();
  }, SUBMIT_INTERVAL_MS);

  // Also flush on visibility change to send before screen-off
  document.addEventListener('visibilitychange', flushOnHide);
  notify();
}

function flushOnHide() {
  if (document.visibilityState === 'hidden') void flushBuffer();
}

export async function stopTracking() {
  trackingEnabled = false;
  if (watchId != null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  document.removeEventListener('visibilitychange', flushOnHide);
  await flushBuffer();
  notify();
}

/** One-shot read for visit check-in. */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 5_000,
      timeout: 15_000,
    });
  });
}
