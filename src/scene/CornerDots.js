// A stationary patch of dots in the top-right corner that slowly breathes.
//
// The dots never move. Their brightness pulses in a ripple that leaves the
// corner roughly every four seconds, and the patch fades out with distance so
// it has no hard edge. Plain 2D canvas: it does not depend on WebGL, so it
// survives when the 3D scene cannot start.

const SPACING = 18; // CSS px between dots

const lerp = (a, b, t) => a + (b - a) * t;

export default class CornerDots {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('2D canvas unavailable');
    this.reducedMotion = reducedMotion;

    this.ink = '0,0,0';
    this.focus = 0;
    this.focusTarget = 0;
    this.elapsed = 0;
    this.paused = false;

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });
    this.onVisibility = () => {
      this.paused = document.hidden;
    };
    document.addEventListener('visibilitychange', this.onVisibility);

    this.resize();
  }

  resize() {
    // The canvas is sized by CSS (min(440px, 70vw) square); match its pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = this.canvas.clientWidth || 0;
    this.dpr = dpr;
    this.canvas.width = Math.round(this.size * dpr);
    this.canvas.height = Math.round(this.size * dpr);
  }

  /** Hovering a project gives the patch a small lift. */
  setFocus(bandOrNull) {
    this.focusTarget = bandOrNull == null ? 0 : 1;
  }

  setInk(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    this.ink = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  update(dt) {
    if (this.paused || this.size === 0) return;
    this.focus = lerp(this.focus, this.focusTarget, 1 - Math.exp(-6 * dt));
    if (!this.reducedMotion) this.elapsed += dt;

    const { ctx, size, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const t = this.elapsed;
    const n = Math.ceil(size / SPACING);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        // Measured from the top-right corner.
        const x = size - (c + 0.5) * SPACING;
        const y = (r + 0.5) * SPACING;
        const d = Math.hypot(c + 0.5, r + 0.5) * SPACING;

        // Soft quarter-circle mask so the patch dissolves into the page.
        const mask = Math.max(0, 1 - d / size) ** 1.6;
        if (mask < 0.01) continue;

        const wave = 0.5 + 0.5 * Math.sin(t * 1.5 - d * 0.03);
        const pulse = wave ** 3;

        const a = mask * (0.14 + 0.4 * pulse + 0.15 * this.focus);
        const s = 1.4 + pulse * 1.1 * mask;
        ctx.fillStyle = `rgba(${this.ink},${Math.min(a, 0.85)})`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
