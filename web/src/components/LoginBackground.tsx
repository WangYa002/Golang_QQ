import { useEffect, useRef } from 'react';

/**
 * 登录页科技感背景（参考 trae.cn）：
 *  - canvas 粒子星网：粒子漂移 + 近距连线 + 鼠标吸附连线
 *  - CSS 光晕 + 网格 + 扫描线 + 暗角
 */
export default function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let mouse = { x: -9999, y: -9999 };

    interface P { x: number; y: number; vx: number; vy: number; r: number; hue: 'mint' | 'cyan' | 'violet'; }
    let particles: P[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.max(45, Math.floor((w * h) / 16000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.6,
        hue: (['mint', 'cyan', 'violet'] as const)[Math.floor(Math.random() * 3)],
      }));
    };

    const colorOf = (hue: P['hue'], alpha: number) => {
      if (hue === 'mint') return `rgba(0, 229, 174, ${alpha})`;
      if (hue === 'cyan') return `rgba(56, 189, 248, ${alpha})`;
      return `rgba(139, 116, 255, ${alpha})`;
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;
      }

      // 连线（粒子间 + 鼠标）
      const linkDist = 120;
      const mouseDist = 170;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            const alpha = (1 - Math.sqrt(d2) / linkDist) * 0.16;
            ctx.strokeStyle = colorOf('mint', alpha);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const mdx = a.x - mouse.x;
        const mdy = a.y - mouse.y;
        const md2 = mdx * mdx + mdy * mdy;
        if (md2 < mouseDist * mouseDist) {
          const alpha = (1 - Math.sqrt(md2) / mouseDist) * 0.32;
          ctx.strokeStyle = colorOf('cyan', alpha);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // 粒子
      for (const p of particles) {
        ctx.fillStyle = colorOf(p.hue, 0.55);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(step);
    };

    const onMouse = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => { mouse = { x: -9999, y: -9999 }; };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseout', onLeave);
    if (!reduced) raf = requestAnimationFrame(step);
    else step();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <div className="lg-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="lg-canvas" />
      <div className="lg-orb lg-orb-1" />
      <div className="lg-orb lg-orb-2" />
      <div className="lg-orb lg-orb-3" />
      <div className="lg-grid" />
      <div className="lg-scanline" />
      <div className="lg-vignette" />
    </div>
  );
}
