import { useEffect, useRef, useState } from 'react';

interface Props {
  onChange?: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
}

/**
 * Touch + mouse signature pad backed by a 2D canvas.
 * Exposes the signature as a base64 PNG via onChange when the user lifts.
 */
export function SignaturePad({ onChange, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Make the canvas crisp on HiDPI screens
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2;
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = point(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(e);
    const last = lastRef.current;
    if (!ctx || !last) return;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (!hasInk) setHasInk(true);
  };
  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    lastRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    const url = canvasRef.current?.toDataURL('image/png') ?? null;
    onChange?.(url);
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    setHasInk(false);
    onChange?.(null);
  };

  return (
    <div className="space-y-2">
      <div
        className="border border-slate-300 rounded-xl bg-white overflow-hidden"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={onUp}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{hasInk ? 'تم التوقيع' : 'وقّع هنا'}</span>
        <button type="button" onClick={clear} className="text-red-600 px-2 py-1">
          مسح
        </button>
      </div>
    </div>
  );
}
