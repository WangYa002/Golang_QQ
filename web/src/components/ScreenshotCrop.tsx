import { useRef, useState } from 'react';

interface Props {
  src: string;
  onCancel: () => void;
  /** 确认后回调，返回裁剪出的 PNG 文件 */
  onSend: (file: File) => void;
}

/**
 * 截图框选：全屏展示捕获帧，按住拖拽画矩形选区（遮罩外暗化），确认后裁剪为 PNG。
 */
export default function ScreenshotCrop({ src, onCancel, onSend }: Props) {
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    startRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    setRect({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = startRef.current;
    if (!s) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setRect({ x: Math.min(s.x, x), y: Math.min(s.y, y), w: Math.abs(x - s.x), h: Math.abs(y - s.y) });
  };

  const onPointerUp = () => {
    startRef.current = null;
  };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !rect || rect.w < 4 || rect.h < 4) return;
    const scale = img.naturalWidth / img.clientWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.w * scale);
    canvas.height = Math.round(rect.h * scale);
    canvas.getContext('2d')!.drawImage(
      img,
      rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale,
      0, 0, canvas.width, canvas.height,
    );
    canvas.toBlob((blob) => {
      if (!blob) return;
      onSend(new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <div className="shot-overlay">
      <div
        className="shot-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <img ref={imgRef} src={src} alt="屏幕截图" className="shot-img" draggable={false} />
        {rect && rect.w > 1 && (
          <div
            className="shot-rect"
            style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
          />
        )}
      </div>
      <div className="shot-actions">
        <span className="shot-hint">按住鼠标拖拽选择要发送的区域</span>
        <button className="shot-btn" onClick={onCancel}>取消</button>
        <button className="shot-btn primary" disabled={!rect || rect.w < 4} onClick={confirm}>
          发送所选区域
        </button>
      </div>
    </div>
  );
}
