import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

export interface BurstOptions {
  x: number;
  y: number;
  count?: number;
  colors?: string[];
  /** Base speed in px/s */
  speed?: number;
  /** Direction spread in radians (default: full circle) */
  spread?: number;
  /** Centre direction in radians (0 = right, -PI/2 = up) */
  angle?: number;
  gravity?: number;
  life?: number;
  size?: number;
  shape?: 'spark' | 'confetti';
  /** Extra outward offset so particles start on a ring rather than a point */
  radius?: number;
}

export interface RingOptions {
  x: number;
  y: number;
  color?: string;
  from?: number;
  to?: number;
  life?: number;
  width?: number;
}

export interface ParticleFieldHandle {
  burst: (options: BurstOptions) => void;
  ring: (options: RingOptions) => void;
  clear: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  spin: number;
  rotation: number;
  shape: 'spark' | 'confetti';
}

interface Ring {
  x: number;
  y: number;
  from: number;
  to: number;
  life: number;
  maxLife: number;
  width: number;
  color: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const SPRITE_SIZE = 64;
const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * Canvas `shadowBlur` costs a full blur pass per draw call, which stalls the
 * main thread once a milestone throws 200+ particles at once. Pre-render one
 * glow sprite per colour instead and just blit it.
 */
const glowSprite = (color: string): HTMLCanvasElement => {
  const cached = spriteCache.get(color);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext('2d')!;
  const r = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  // Fading to transparent black is the correct falloff under 'lighter'
  grad.addColorStop(0, color);
  grad.addColorStop(0.3, color);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();

  spriteCache.set(color, canvas);
  return canvas;
};

/**
 * Full-screen additive particle layer. Purely imperative so bursts never cause
 * a React re-render, and the rAF loop only runs while something is alive.
 */
const ParticleField = forwardRef<ParticleFieldHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ringsRef = useRef<Ring[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  const frame = useCallback((now: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      rafRef.current = null;
      return;
    }

    const dt = Math.min(0.05, (now - lastRef.current) / 1000 || 0.016);
    lastRef.current = now;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;

      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(1, t * 1.6);

      if (p.shape === 'confetti') {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.size * 0.5, -p.size * 0.28, p.size, p.size * 0.56);
        ctx.restore();
      } else {
        const r = p.size * (0.35 + 0.65 * t) * 2.6; // sprite carries the glow
        ctx.drawImage(glowSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
      }
    }

    const rings = ringsRef.current;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        rings.splice(i, 1);
        continue;
      }
      const t = 1 - r.life / r.maxLife;
      const eased = 1 - Math.pow(1 - t, 3);
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.shadowBlur = 24;
      ctx.lineWidth = r.width * (1 - t * 0.7);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.from + (r.to - r.from) * eased, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';

    if (particles.length || rings.length) {
      rafRef.current = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rafRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (rafRef.current === null) {
      lastRef.current = performance.now();
      rafRef.current = requestAnimationFrame(frame);
    }
  }, [frame]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  useImperativeHandle(ref, () => ({
    burst: (options: BurstOptions) => {
      const reduced = prefersReducedMotion();
      const {
        x,
        y,
        count = 40,
        colors = ['#05FFA1'],
        speed = 420,
        spread = Math.PI * 2,
        angle = -Math.PI / 2,
        gravity = 620,
        life = 1.1,
        size = 6,
        shape = 'spark',
        radius = 0,
      } = options;

      // Cap the total so a frantic clicker can't melt the frame budget
      const total = Math.min(reduced ? Math.ceil(count * 0.25) : count, 180);
      const room = Math.max(0, 520 - particlesRef.current.length);
      for (let i = 0; i < Math.min(total, room); i++) {
        const dir = angle + (Math.random() - 0.5) * spread;
        const power = speed * (0.45 + Math.random() * 0.75);
        particlesRef.current.push({
          x: x + Math.cos(dir) * radius,
          y: y + Math.sin(dir) * radius,
          vx: Math.cos(dir) * power,
          vy: Math.sin(dir) * power,
          life: life * (0.65 + Math.random() * 0.6),
          maxLife: life,
          size: size * (0.55 + Math.random() * 0.9),
          color: colors[(Math.random() * colors.length) | 0],
          gravity,
          spin: (Math.random() - 0.5) * 14,
          rotation: Math.random() * Math.PI,
          shape,
        });
      }
      start();
    },
    ring: (options: RingOptions) => {
      const { x, y, color = '#05FFA1', from = 10, to = 340, life = 0.75, width = 6 } = options;
      ringsRef.current.push({ x, y, from, to, life, maxLife: life, width, color });
      start();
    },
    clear: () => {
      particlesRef.current = [];
      ringsRef.current = [];
    },
  }), [start]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[45]"
      aria-hidden="true"
    />
  );
});

ParticleField.displayName = 'ParticleField';

export default ParticleField;
