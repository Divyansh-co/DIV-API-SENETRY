import React, { useEffect, useRef } from 'react';

export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width: number, height: number, dpr: number, cx: number, cy: number;
    const mouse = { x: 0, y: 0, nx: 0, ny: 0 }; // nx/ny = normalized -1..1
    let rotY = 0, rotX = 0;
    let targetTiltX = 0, targetTiltY = 0;
    let t = 0;

    const SPHERE_RADIUS = 190;
    const POINT_COUNT = 130;
    const NEIGHBOR_COUNT = 3;
    const FOCAL = 620;

    let points: { x: number; y: number; z: number }[] = [];
    let edges: [number, number][] = [];

    // --- Build an evenly distributed sphere of points (Fibonacci sphere) ---
    function buildSphere() {
      points = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < POINT_COUNT; i++) {
        const yv = 1 - (i / (POINT_COUNT - 1)) * 2;
        const r = Math.sqrt(1 - yv * yv);
        const theta = golden * i;
        points.push({ x: Math.cos(theta) * r, y: yv, z: Math.sin(theta) * r });
      }
      // Connect each point to its N nearest neighbors
      edges = [];
      const seen = new Set<string>();
      for (let i = 0; i < points.length; i++) {
        const dists: { j: number; d: number }[] = [];
        for (let j = 0; j < points.length; j++) {
          if (i === j) continue;
          const dx = points[i].x - points[j].x;
          const dy = points[i].y - points[j].y;
          const dz = points[i].z - points[j].z;
          dists.push({ j, d: dx * dx + dy * dy + dz * dz });
        }
        dists.sort((a, b) => a.d - b.d);
        for (let k = 0; k < NEIGHBOR_COUNT; k++) {
          const j = dists[k].j;
          const key = i < j ? `${i}_${j}` : `${j}_${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push([i, j]);
          }
        }
      }
    }

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = width > 900 ? width * 0.68 : width * 0.5; // globe sits right-of-center
      cy = height * 0.5;
    }

    function lerp(a: number, b: number, n: number) {
      return a + (b - a) * n;
    }

    // --- Decorative orbit arcs behind the globe ---
    function drawOrbitArcs(context: CanvasRenderingContext2D) {
      const rings = [
        { r: SPHERE_RADIUS * 1.55, w: 1.4, speed: 0.15, span: 4.4 },
        { r: SPHERE_RADIUS * 1.95, w: 1.1, speed: -0.1, span: 3.6 },
        { r: SPHERE_RADIUS * 2.35, w: 0.9, speed: 0.07, span: 5.2 },
      ];
      rings.forEach((ring, idx) => {
        const angle = t * 0.0016 * ring.speed + idx;
        const grad = context.createLinearGradient(
          cx - ring.r,
          cy - ring.r,
          cx + ring.r,
          cy + ring.r
        );
        grad.addColorStop(0, 'rgba(0, 255, 170, 0.7)');
        grad.addColorStop(1, 'rgba(16, 185, 129, 0.25)');
        context.beginPath();
        context.arc(cx, cy, ring.r, angle, angle + ring.span);
        context.strokeStyle = grad;
        context.lineWidth = ring.w * 1.3;
        context.stroke();
      });
    }

    // --- Small floating hex-icon accents ---
    const hexes = [
      { angle: 0.6, dist: 1.5, phase: 0, icon: 'user' },
      { angle: 2.3, dist: 1.7, phase: 2, icon: 'bars' },
      { angle: 4.1, dist: 1.6, phase: 4, icon: 'hourglass' },
    ];

    function drawHex(context: CanvasRenderingContext2D, px: number, py: number, size: number, alpha: number) {
      context.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const x = px + Math.cos(a) * size;
        const y = py + Math.sin(a) * size;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      context.strokeStyle = `rgba(0, 255, 170, ${Math.min(1, alpha + 0.15)})`;
      context.lineWidth = 1.3;
      context.stroke();
    }

    function drawIcon(context: CanvasRenderingContext2D, kind: string, px: number, py: number, alpha: number) {
      context.strokeStyle = `rgba(230, 255, 245, ${Math.min(1, alpha + 0.2)})`;
      context.lineWidth = 1.3;
      context.beginPath();
      if (kind === 'user') {
        context.arc(px, py - 5, 4, 0, Math.PI * 2);
        context.moveTo(px - 6, py + 8);
        context.quadraticCurveTo(px, py, px + 6, py + 8);
      } else if (kind === 'bars') {
        context.moveTo(px - 6, py + 6);
        context.lineTo(px - 6, py - 2);
        context.moveTo(px, py + 6);
        context.lineTo(px, py - 7);
        context.moveTo(px + 6, py + 6);
        context.lineTo(px + 6, py - 4);
      } else if (kind === 'hourglass') {
        context.moveTo(px - 5, py - 7);
        context.lineTo(px + 5, py - 7);
        context.lineTo(px - 5, py + 7);
        context.lineTo(px + 5, py + 7);
        context.closePath();
      }
      context.stroke();
    }

    function drawFloatingHexes(context: CanvasRenderingContext2D) {
      hexes.forEach((h) => {
        const wobble = Math.sin(t * 0.01 + h.phase) * 10;
        const px = cx + Math.cos(h.angle) * SPHERE_RADIUS * h.dist;
        const py = cy + Math.sin(h.angle) * SPHERE_RADIUS * h.dist * 0.6 + wobble;
        const alpha = 0.45 + Math.sin(t * 0.015 + h.phase) * 0.2;
        drawHex(context, px, py, 22, alpha);
        drawIcon(context, h.icon, px, py, alpha);
      });
    }

    function project(p: { x: number; y: number; z: number }) {
      // Rotate around Y then X
      let x = p.x * Math.cos(rotY) - p.z * Math.sin(rotY);
      let z = p.x * Math.sin(rotY) + p.z * Math.cos(rotY);
      const y = p.y * Math.cos(rotX) - z * Math.sin(rotX);
      z = p.y * Math.sin(rotX) + z * Math.cos(rotX);

      x *= SPHERE_RADIUS;
      const yScaled = y * SPHERE_RADIUS;
      z *= SPHERE_RADIUS;
      const scale = FOCAL / (FOCAL + z);
      return {
        sx: cx + x * scale,
        sy: cy + yScaled * scale,
        scale,
        z,
      };
    }

    function drawGlobe(context: CanvasRenderingContext2D) {
      const projected = points.map(project);

      // Edges (drawn first, behind nodes)
      edges.forEach(([i, j]) => {
        const a = projected[i];
        const b = projected[j];
        if (!a || !b) return;
        const avgZ = (a.z + b.z) / 2;
        const alpha = Math.max(0.12, Math.min(0.7, 0.65 - avgZ / (SPHERE_RADIUS * 2)));
        context.beginPath();
        context.moveTo(a.sx, a.sy);
        context.lineTo(b.sx, b.sy);
        context.strokeStyle = `rgba(0, 255, 170, ${alpha})`;
        context.lineWidth = 0.95;
        context.stroke();
      });

      // Nodes (sorted back-to-front)
      const order = projected
        .map((_, i) => i)
        .sort((a, b) => projected[a].z - projected[b].z);

      order.forEach((i) => {
        const p = projected[i];
        const front = Math.max(
          0,
          Math.min(1, (p.z + SPHERE_RADIUS) / (SPHERE_RADIUS * 2))
        );
        const r = 1.6 + front * 2.6;
        const alpha = 0.45 + front * 0.55;

        const glow = context.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4.5);
        glow.addColorStop(0, `rgba(0, 255, 170, ${alpha * 0.85})`);
        glow.addColorStop(1, 'rgba(0, 255, 170, 0)');
        context.fillStyle = glow;
        context.beginPath();
        context.arc(p.sx, p.sy, r * 4.5, 0, Math.PI * 2);
        context.fill();

        context.beginPath();
        context.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        context.fillStyle = `rgba(230, 255, 245, ${alpha})`;
        context.fill();
      });

      // Core glow at center
      const coreGlow = context.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        SPHERE_RADIUS * 1.15
      );
      coreGlow.addColorStop(0, 'rgba(0, 230, 153, 0.28)');
      coreGlow.addColorStop(1, 'rgba(0, 230, 153, 0)');
      context.fillStyle = coreGlow;
      context.beginPath();
      context.arc(cx, cy, SPHERE_RADIUS * 1.1, 0, Math.PI * 2);
      context.fill();
    }

    let rafId: number;
    function frame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      drawOrbitArcs(ctx);

      // Auto-rotation plus a gentle cursor-driven tilt
      targetTiltX = lerp(targetTiltX, mouse.ny * 0.35, 0.05);
      targetTiltY = lerp(targetTiltY, mouse.nx * 0.5, 0.05);
      rotY += 0.0022 + targetTiltY * 0.01;
      rotX = lerp(rotX, targetTiltX * 0.4, 0.08);

      drawGlobe(ctx);
      drawFloatingHexes(ctx);

      t++;
      if (!reduceMotion) {
        rafId = requestAnimationFrame(frame);
      }
    }

    function onMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.nx = (e.clientX / width) * 2 - 1;
      mouse.ny = (e.clientY / height) * 2 - 1;
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });

    buildSphere();
    resize();
    frame();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse at 60% 40%, #063428 0%, #031A14 55%, #020D0A 100%)',
      }}
    >
      <canvas ref={canvasRef} id="c" className="block w-full h-full" />
    </div>
  );
};
