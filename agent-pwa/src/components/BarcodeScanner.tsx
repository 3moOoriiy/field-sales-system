import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType, BarcodeFormat } from '@zxing/library';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/**
 * Full-screen barcode scanner overlay.
 * - Uses ZXing for cross-browser support (works on Android Chrome + iOS Safari)
 * - Picks the rear camera by default; user can swap
 * - Detects EAN-13, EAN-8, UPC-A, CODE-128, QR — covers basically every retail label
 * - On detect, plays a short beep, calls onDetected, and stays open so the agent
 *   can scan multiple items in a row (close button to dismiss)
 */
export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const lastDetectAt = useRef(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        // Hint at common retail formats for faster decoding
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        readerRef.current = reader;

        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        setDevices(videoInputDevices);

        // Prefer rear camera by label (works on most Android phones)
        const rear = videoInputDevices.find((d) =>
          /back|rear|environment/i.test(d.label));
        const chosen = deviceId ?? rear?.deviceId ?? videoInputDevices[0]?.deviceId;
        setDeviceId(chosen);

        if (!videoRef.current) return;
        controlsRef.current = await reader.decodeFromVideoDevice(
          chosen,
          videoRef.current,
          (result) => {
            if (!result) return;
            // Debounce — same scanner can fire multiple times per second
            const now = Date.now();
            if (now - lastDetectAt.current < 1500) return;
            lastDetectAt.current = now;

            const code = result.getText();
            setLastCode(code);
            setScanCount((c) => c + 1);
            beep();
            onDetected(code);
          },
        );
      } catch (e) {
        const msg = (e as Error).message ?? 'Camera error';
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, [open, deviceId, onDetected]);

  const swapCamera = () => {
    if (devices.length < 2 || !deviceId) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    setDeviceId(devices[(idx + 1) % devices.length].deviceId);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="bg-black/60 backdrop-blur text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📷</span>
          <span className="font-semibold text-sm">مسح الباركود</span>
        </div>
        <div className="flex items-center gap-1">
          {devices.length > 1 && (
            <button onClick={swapCamera} className="p-2 hover:bg-white/10 rounded-md text-lg" title="تبديل الكاميرا">
              ↻
            </button>
          )}
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-md text-lg" title="إغلاق">
            ✕
          </button>
        </div>
      </div>

      {/* Camera */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Reticle overlay */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="relative w-72 max-w-[80%] aspect-[3/2]">
            <div className="absolute inset-0 border-2 border-white/40 rounded-2xl" />
            {/* Animated scan line */}
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
            {/* Corner brackets for a modern look */}
            <Corner pos="top-left" />
            <Corner pos="top-right" />
            <Corner pos="bottom-left" />
            <Corner pos="bottom-right" />
          </div>
        </div>

        {error && (
          <div className="absolute inset-x-4 top-4 bg-rose-600 text-white text-sm rounded-xl px-4 py-3">
            خطأ: {error}
            <div className="text-[11px] opacity-80 mt-1">
              تأكد إن الكاميرا مسموح لها (Settings → Site permissions → Camera).
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-black/60 backdrop-blur text-white px-4 py-3">
        <div className="text-center">
          <div className="text-xs opacity-70">وجّه الكاميرا للباركود — يتم القراءة تلقائياً</div>
          {lastCode && (
            <div className="mt-1 text-sm font-bold">
              آخر مسح: <code dir="ltr">{lastCode}</code>
              {scanCount > 1 && <span className="text-[10px] opacity-70"> ({scanCount} مسحة)</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Corner({ pos }: { pos: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' }) {
  const cls = pos === 'top-left' ? 'top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl'
    : pos === 'top-right' ? 'top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl'
    : pos === 'bottom-left' ? 'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl'
    : 'bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl';
  return <span className={`absolute w-7 h-7 border-emerald-400 ${cls}`} aria-hidden />;
}

function beep() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  } catch { /* ignore */ }
}

