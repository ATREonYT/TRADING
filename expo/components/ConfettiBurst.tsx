"use client";

/**
 * A short pixel-confetti burst for quest completions — little squares in the
 * booth-carpet palette, 1.4s, then gone. Purposeful celebration feedback, not
 * ambient decoration; skipped entirely under prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

const COLORS = ["#D9480F", "#4E6E4E", "#3B5B92", "#F2C14E", "#6B4E71", "#2F6F6A", "#C4562B"];
const COUNT = 44;
const LIFE_MS = 1400;

export default function ConfettiBurst({ burstId }: { burstId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (burstId <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h * 0.32;
    const parts = Array.from({ length: COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 220;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 140,
        size: 3 + Math.floor(Math.random() * 4),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        spin: Math.random() * Math.PI,
      };
    });

    const start = performance.now();
    let last = start;
    const tick = (now: number) => {
      const t = now - start;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      if (t >= LIFE_MS) return;
      const alpha = t > LIFE_MS - 300 ? (LIFE_MS - t) / 300 : 1;
      ctx.globalAlpha = alpha;
      for (const p of parts) {
        p.vy += 420 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin + t / 300);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ctx.clearRect(0, 0, w, h);
    };
  }, [burstId]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[80] h-full w-full"
    />
  );
}
