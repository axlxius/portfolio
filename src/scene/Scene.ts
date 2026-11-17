import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  LineSegments,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PerspectiveCamera,
  Points,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';

import { clamp, damp, lerp } from '../core/env.ts';
import { motion } from '../core/motion.ts';
import { buildTakeover } from './projects.ts';
import type { TakeoverId } from './projects.ts';
import { linesFragment, linesVertex, pointsFragment, pointsVertex } from './shaders.ts';
import { BANDS, ROLES, STATE_COUNT, buildMeta, buildSegmentIndices, buildStates } from './shapes.ts';
import {
  CAMERA_Y,
  CAMERA_Z,
  FIT_WIDTH,
  NOISE,
  OFFSET_X,
  OFFSET_Y,
  SPIN,
  STAGGER,
  WEIGHT,
  fitCameraZ,
  sampleTrack,
} from './tracks.ts';

// --- Quality tiers -------------------------------------------------------------
// Point count is strands x pointsPerStrand. Size and opacity fall as density
// rises, so every tier lands at a similar overall weight.
export type Tier = 'high' | 'mid' | 'low';

const TIERS: Record<Tier, { strands: number; len: number; size: number; opacity: number; line: number }> = {
  high: { strands: 1500, len: 48, size: 1.3, opacity: 0.2, line: 0.016 },
  mid: { strands: 820, len: 40, size: 1.55, opacity: 0.27, line: 0.026 },
  low: { strands: 380, len: 30, size: 2.0, opacity: 0.4, line: 0.05 },
};

// Light theme lays ink on paper and needs more of it than light on black.
const INK_GAIN = 2.1;

function chooseTier(renderer: WebGLRenderer): Tier {
  const forced = new URLSearchParams(location.search).get('tier');
  if (forced === 'high' || forced === 'mid' || forced === 'low') return forced;

  // A software rasteriser can draw the scene, just not many points of it.
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 'low';

  const cores = navigator.hardwareConcurrency || 4;
  const small = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  if (small) return cores >= 8 ? 'mid' : 'low';
  return cores >= 8 ? 'high' : cores >= 4 ? 'mid' : 'low';
}

export interface SceneOptions {
  /** Called once if the frame rate probe lowers the quality. */
  onQuality?: (fraction: number) => void;
}

export default class Scene {
  readonly tier: Tier;

  private renderer: WebGLRenderer;
  private scene = new ThreeScene();
  private camera = new PerspectiveCamera(42, 1, 0.1, 100);
  private pointsGeometry = new BufferGeometry();
  private linesGeometry = new BufferGeometry();
  private pointsMaterial!: ShaderMaterial;
  private linesMaterial!: ShaderMaterial;
  private uniforms!: Record<string, { value: any }>;

  private strands: number;
  private len: number;
  private fraction = 1; // share of strands being drawn (adaptive quality)

  // Smoothed drivers. Raw input is written to the *Target fields and eased
  // toward in update(), so scroll and pointer never jolt the scene.
  private progress = 0;
  private progressTarget = 0;
  private pointer = new Vector2();
  private pointerTarget = new Vector2();
  private trail = new Vector2();
  private pointerVel = new Vector2();
  private pointerStrength = 0;
  private pointerStrengthTarget = 0;
  private tilt = new Vector2(); // device tilt, for touch screens
  private bandGlow = new Float32Array(BANDS);
  private bandTarget = -1;
  private roleGlow = new Float32Array(ROLES);
  private roleTarget = -1;
  private bandDim = 0;
  private velocity = 0;
  private velocityTarget = 0;
  private assemble = 1;
  private theme = 1; // 1 = dark (additive light), 0 = light (ink)
  private themeTarget = 1;

  // Takeover: two attribute slots, cross-faded, so moving from one project to
  // the next never pops.
  private slots: (TakeoverId | null)[] = [null, null];
  private altMix = 0;
  private altMixTarget = 0;
  private alt = 0;
  private altTarget = 0;
  private wanted: TakeoverId | null = null;

  private shocks = [new Vector4(0, 0, 9, 0), new Vector4(0, 0, 9, 0)];
  private nextShock = 0;

  private angle = 0;
  private elapsed = 0;
  private paused = false;
  private width = 1;
  private height = 1;
  private frameScale = 1;

  // Frame-rate probe.
  private probeFrames = 0;
  private probeTime = 0;
  private probesLeft = 3;
  private onQuality?: (fraction: number) => void;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, options: SceneOptions = {}) {
    this.canvas = canvas;
    this.onQuality = options.onQuality;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);

    this.tier = chooseTier(this.renderer);
    const tier = TIERS[this.tier];
    this.strands = tier.strands;
    this.len = tier.len;

    this.buildGeometry();
    this.buildMaterials();
    this.bindEvents();
    this.resize();
  }

  // --- Construction -------------------------------------------------------------

  private buildGeometry() {
    const { strands, len } = this;
    const count = strands * len;
    const states = buildStates(strands, len);
    const meta = new BufferAttribute(buildMeta(strands, len), 4);
    const altA = new BufferAttribute(new Float32Array(count * 3), 3);
    const altB = new BufferAttribute(new Float32Array(count * 3), 3);

    // Points and lines share every attribute buffer; only the lines are indexed.
    for (const geometry of [this.pointsGeometry, this.linesGeometry]) {
      states.forEach((arr, i) => {
        geometry.setAttribute(i === 0 ? 'position' : `aPos${i}`, new BufferAttribute(arr, 3));
      });
      geometry.setAttribute('aMeta', meta);
      geometry.setAttribute('aAltA', altA);
      geometry.setAttribute('aAltB', altB);
    }
    this.linesGeometry.setIndex(new BufferAttribute(buildSegmentIndices(strands, len), 1));
  }

  private buildMaterials() {
    const tier = TIERS[this.tier];
    // One set of uniform objects, shared by both materials: write once, both see it.
    this.uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uStagger: { value: STAGGER[0] },
      uNoise: { value: NOISE[0] },
      uAssemble: { value: 1 },
      uAlt: { value: 0 },
      uAltMix: { value: 0 },
      uSpin: { value: Array.from({ length: STATE_COUNT }, () => new Vector2(1, 0)) },
      uAltSpin: { value: new Vector2(1, 0) },
      uPointer: { value: this.pointer },
      uTrail: { value: this.trail },
      uPointerVel: { value: this.pointerVel },
      uPointerStrength: { value: 0 },
      uShock: { value: this.shocks },
      uAspect: { value: 1 },
      uVelocity: { value: 0 },
      uCamDist: { value: CAMERA_Z[0] },
      uBandGlow: { value: this.bandGlow },
      uRoleGlow: { value: this.roleGlow },
      uBandDim: { value: 0 },
      uInk: { value: new Color(0xffffff) },
      uAdditive: { value: 1 },
      uPixelRatio: { value: 1 },
      uSize: { value: tier.size },
      uOpacity: { value: tier.opacity },
      uLineOpacity: { value: tier.line },
    };

    const common = {
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendSrcAlpha: OneFactor,
      blendDstAlpha: OneMinusSrcAlphaFactor,
    } as const;

    this.pointsMaterial = new ShaderMaterial({ ...common, vertexShader: pointsVertex, fragmentShader: pointsFragment });
    this.linesMaterial = new ShaderMaterial({ ...common, vertexShader: linesVertex, fragmentShader: linesFragment });

    const points = new Points(this.pointsGeometry, this.pointsMaterial);
    const lines = new LineSegments(this.linesGeometry, this.linesMaterial);
    // The shader moves every vertex, so three's bounds would be wrong anyway.
    points.frustumCulled = false;
    lines.frustumCulled = false;
    this.scene.add(lines, points);
    this.applyFraction();
  }

  private applyFraction() {
    const strands = Math.max(60, Math.round(this.strands * this.fraction));
    this.pointsGeometry.setDrawRange(0, strands * this.len);
    this.linesGeometry.setDrawRange(0, strands * (this.len - 1) * 2);
    // Fewer points, each a little heavier, keeps the overall weight.
    const boost = 1 / Math.sqrt(this.fraction);
    const tier = TIERS[this.tier];
    this.uniforms.uSize.value = tier.size * Math.min(boost, 1.5) * clamp(this.height / 900, 0.7, 1.15);
  }

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    this.pointerTarget.set((event.clientX / this.width) * 2 - 1, -((event.clientY / this.height) * 2 - 1));
    this.pointerStrengthTarget = 1;
  };
  private onPointerLeave = () => {
    this.pointerStrengthTarget = 0;
  };
  private onVisibility = () => {
    this.paused = document.hidden;
  };
  private onResize = () => this.resize();
  private onTilt = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || event.beta == null) return;
    this.tilt.set(clamp(event.gamma / 35, -1, 1), clamp((event.beta - 45) / 35, -1, 1));
  };

  private bindEvents() {
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);
    document.addEventListener('visibilitychange', this.onVisibility);
    // Fires without a prompt on Android; iOS needs a permission tap, which a
    // background effect does not earn, so there it simply never fires.
    window.addEventListener('deviceorientation', this.onTilt, { passive: true });
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.tier === 'low' ? 1.5 : 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;

    this.uniforms.uAspect.value = this.camera.aspect;
    this.uniforms.uPixelRatio.value = dpr;
    // Narrow viewports need the object pulled back to stay inside the frame.
    this.frameScale = clamp(1.35 - this.camera.aspect * 0.28, 1, 1.5);
    this.applyFraction();
  }

  // --- Inputs ---------------------------------------------------------------------

  /** Scroll-driven morph position, in units of state index. */
  setProgress(value: number, immediate = false) {
    this.progressTarget = clamp(value, 0, STATE_COUNT - 1);
    if (immediate) this.progress = this.progressTarget;
  }

  /** 0 = scattered dust, 1 = formed. Driven by the intro sequence. */
  setAssemble(value: number) {
    this.assemble = clamp(value, 0, 1);
  }

  /** Light one project's band of the vase (list order). Null releases it. */
  setBand(index: number | null) {
    this.bandTarget = index == null ? -1 : index;
  }

  /** Reform into a project's figure. Null relaxes back to the morph state. */
  setTakeover(id: TakeoverId | null) {
    this.wanted = id;
    if (id == null) this.altTarget = 0;
  }

  /** Light one role's segment of the column. Null releases it. */
  setRole(index: number | null) {
    this.roleTarget = index == null ? -1 : index;
  }

  /** Signed scroll speed; smears the cloud along the direction of travel. */
  setScrollVelocity(value: number) {
    this.velocityTarget = clamp(value / 60, -1, 1);
  }

  /** A ripple through the cloud from a point on screen. */
  shock(clientX: number, clientY: number, strength = 1) {
    if (motion.reduced) return;
    const slot = this.shocks[this.nextShock];
    this.nextShock = (this.nextShock + 1) % this.shocks.length;
    slot.set((clientX / this.width) * 2 - 1, -((clientY / this.height) * 2 - 1), 0, strength);
  }

  /** `instant` skips the cross-fade (the theme wipe covers the switch). */
  setTheme(mode: 'light' | 'dark', instant: boolean) {
    this.themeTarget = mode === 'dark' ? 1 : 0;
    if (instant) this.theme = this.themeTarget;
  }

  // --- Takeover slots --------------------------------------------------------------

  private loadSlot(slot: 0 | 1, id: TakeoverId) {
    const name = slot === 0 ? 'aAltA' : 'aAltB';
    const attribute = this.pointsGeometry.getAttribute(name) as BufferAttribute;
    (attribute.array as Float32Array).set(buildTakeover(id, this.strands, this.len));
    attribute.needsUpdate = true;
    this.slots[slot] = id;
  }

  private stepTakeover() {
    const id = this.wanted;
    if (id == null) return;
    const showing = (this.altMixTarget > 0.5 ? 1 : 0) as 0 | 1;

    if (this.slots[showing] === id) {
      this.altTarget = 1;
    } else if (this.alt < 0.02) {
      // Nothing visible yet: load straight into the slot that is showing.
      this.loadSlot(showing, id);
      this.altTarget = 1;
    } else if (Math.abs(this.altMix - this.altMixTarget) < 0.02) {
      // The other slot is fully hidden, so it is safe to rewrite it.
      const other = (1 - showing) as 0 | 1;
      this.loadSlot(other, id);
      this.altMixTarget = other;
      this.altTarget = 1;
    }
    // Otherwise a cross-fade is still running; try again next frame.
  }

  // --- Frame ------------------------------------------------------------------------

  update(dt: number) {
    if (this.paused) return;
    const still = motion.reduced;
    const u = this.uniforms;
    const k = (rate: number) => (still ? 1 : damp(rate, dt));

    this.progress = lerp(this.progress, this.progressTarget, k(5.5));
    this.velocity = lerp(this.velocity, still ? 0 : this.velocityTarget, k(8));
    this.theme = lerp(this.theme, this.themeTarget, still ? 1 : damp(7, dt));

    // Pointer: the eased position, a slower trail behind it, and the velocity
    // between frames (in NDC per second, eased so it does not flicker).
    const before = this.pointer.clone();
    this.pointer.lerp(this.pointerTarget, k(7));
    this.trail.lerp(this.pointer, k(2.2));
    if (dt > 0) {
      const vx = (this.pointer.x - before.x) / dt;
      const vy = (this.pointer.y - before.y) / dt;
      this.pointerVel.lerp(new Vector2(clamp(vx, -4, 4), clamp(vy, -4, 4)), k(6));
    }
    this.pointerStrength = lerp(this.pointerStrength, still ? 0 : this.pointerStrengthTarget, k(4));

    for (let i = 0; i < BANDS; i++) {
      this.bandGlow[i] = lerp(this.bandGlow[i], i === this.bandTarget ? 1 : 0, k(9));
    }
    this.bandDim = lerp(this.bandDim, this.bandTarget >= 0 ? 1 : 0, k(7));
    for (let i = 0; i < ROLES; i++) {
      this.roleGlow[i] = lerp(this.roleGlow[i], i === this.roleTarget ? 1 : 0, k(4));
    }

    this.stepTakeover();
    this.alt = lerp(this.alt, this.altTarget, k(this.altTarget > 0.5 ? 4.2 : 3.4));
    this.altMix = lerp(this.altMix, this.altMixTarget, k(5));

    for (const shock of this.shocks) {
      if (shock.w > 0) {
        shock.z += dt;
        if (shock.z > 1.5) shock.w = 0;
      }
    }

    if (!still) {
      this.elapsed += dt;
      this.angle += dt * 0.07;
    }

    // Each state turns by its own share of the slow spin; the ribbon and the
    // takeover figures are held facing the camera with only a slight sway.
    const turn = this.angle + this.progress * 0.5;
    const sway = still ? 0 : Math.sin(this.elapsed * 0.22) * 0.12;
    const spins = u.uSpin.value as Vector2[];
    for (let i = 0; i < STATE_COUNT; i++) {
      const a = SPIN[i] ? turn * SPIN[i] : sway;
      spins[i].set(Math.cos(a), Math.sin(a));
    }
    const altSway = (still ? 0 : Math.sin(this.elapsed * 0.5) * 0.16) + this.pointer.x * 0.22 - 0.2;
    (u.uAltSpin.value as Vector2).set(Math.cos(altSway), Math.sin(altSway));

    u.uProgress.value = this.progress;
    u.uTime.value = this.elapsed;
    u.uStagger.value = sampleTrack(STAGGER, this.progress);
    u.uNoise.value = still ? 0 : sampleTrack(NOISE, this.progress);
    u.uAssemble.value = still ? 1 : this.assemble;
    u.uAlt.value = this.alt;
    u.uAltMix.value = this.altMix;
    u.uPointerStrength.value = this.pointerStrength;
    u.uVelocity.value = this.velocity;
    u.uBandDim.value = this.bandDim;

    // Theme: ink colour, blend, and how much ink a point lays down.
    const tier = TIERS[this.tier];
    (u.uInk.value as Color).setScalar(this.theme);
    u.uAdditive.value = this.theme;
    const gain = lerp(INK_GAIN, 1, this.theme) * sampleTrack(WEIGHT, this.progress);
    u.uOpacity.value = tier.opacity * gain;
    u.uLineOpacity.value = tier.line * gain * 1.2;

    // Camera: distance and height per state, a parallax lean toward the
    // pointer (or the device tilt), and a view offset that seats the object
    // in the open part of the layout.
    const baseZ = sampleTrack(CAMERA_Z, this.progress) * this.frameScale;
    const z = fitCameraZ(baseZ, sampleTrack(FIT_WIDTH, this.progress), this.camera.fov, this.camera.aspect * 0.62);
    const camY = sampleTrack(CAMERA_Y, this.progress);
    const leanX = still ? 0 : this.pointer.x * this.pointerStrength + this.tilt.x;
    const leanY = still ? 0 : this.pointer.y * this.pointerStrength - this.tilt.y;
    this.camera.position.set(leanX * 0.55, camY + leanY * 0.32, z);
    this.camera.lookAt(0, camY * 0.35, 0);
    u.uCamDist.value = this.camera.position.length();

    const wide = clamp((this.camera.aspect - 0.85) / 0.55, 0, 1);
    const ox = sampleTrack(OFFSET_X, this.progress) * wide * (1 - this.alt * 0.12);
    const oy = sampleTrack(OFFSET_Y, this.progress);
    this.camera.setViewOffset(this.width, this.height, -ox * this.width, oy * this.height, this.width, this.height);

    this.renderer.render(this.scene, this.camera);
    this.probe(dt);
  }

  /**
   * Adaptive quality: time a run of frames once the scene has formed, and if
   * the device cannot hold about 45fps, draw fewer strands. Because any prefix
   * of the strand list is a fair sample of every shape, this needs no rebuild.
   */
  private probe(dt: number) {
    if (this.probesLeft <= 0 || this.assemble < 1 || motion.reduced) return;
    this.probeFrames++;
    this.probeTime += dt;
    if (this.probeFrames < 90) return;

    const average = this.probeTime / this.probeFrames;
    this.probeFrames = 0;
    this.probeTime = 0;
    this.probesLeft--;
    if (average > 1 / 45 && this.fraction > 0.3) {
      this.fraction = Math.max(0.3, this.fraction * 0.62);
      this.applyFraction();
      this.onQuality?.(this.fraction);
    } else {
      this.probesLeft = 0;
    }
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('deviceorientation', this.onTilt);
    this.pointsGeometry.dispose();
    this.linesGeometry.dispose();
    this.pointsMaterial.dispose();
    this.linesMaterial.dispose();
    this.renderer.dispose();
    this.canvas.width = this.canvas.height = 0;
  }
}
