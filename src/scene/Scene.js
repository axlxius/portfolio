import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineSegments,
  NormalBlending,
  PerspectiveCamera,
  Points,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from 'three';

import {
  STATE_COUNT,
  buildSeeds,
  buildSegmentIndices,
  buildStates,
} from './shapes.js';

import {
  linesFragment,
  linesVertex,
  pointsFragment,
  pointsVertex,
} from './shaders.js';

const DESKTOP = { strands: 220, pointsPerStrand: 28 };
const MOBILE = { strands: 110, pointsPerStrand: 20 };

// Camera distance per state. The camera eases with the morph so each
// configuration is framed deliberately rather than all at one focal length.
const CAMERA_Z = [6.4, 5.2, 7.2, 8.4, 7.6];
const CAMERA_Y = [0.0, 1.05, 0.0, 0.1, 0.0];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Sample a per-state track at a fractional progress value.
function sampleTrack(track, progress) {
  const p = clamp(progress, 0, track.length - 1);
  const i = Math.floor(p);
  const j = Math.min(i + 1, track.length - 1);
  return lerp(track[i], track[j], p - i);
}

export default class Scene {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearAlpha(0);

    this.scene = new ThreeScene();
    this.camera = new PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAMERA_Z[0]);

    this.group = new Group();
    this.scene.add(this.group);

    const isMobile = window.matchMedia('(max-width: 720px)').matches;
    const { strands, pointsPerStrand } = isMobile ? MOBILE : DESKTOP;
    this.strands = strands;

    this.#buildGeometry(strands, pointsPerStrand);

    // Smoothed drivers. Raw input is written to the *Target fields and eased
    // toward in update(), so scroll and pointer never jolt the scene.
    this.progress = 0;
    this.progressTarget = 0;
    this.pointer = new Vector2(0, 0);
    this.pointerTarget = new Vector2(0, 0);
    this.pointerStrength = 0;
    this.pointerStrengthTarget = 0;
    this.focus = 0;
    this.focusTarget = 0;
    this.focusBand = 0;

    this.elapsed = 0;
    // The caller owns the rAF loop so scroll and rendering are sampled from
    // the same frame. This flag only parks rendering for a hidden tab.
    this.paused = false;

    this.#bindEvents();
    this.resize();
  }

  #buildGeometry(strands, pointsPerStrand) {
    const count = strands * pointsPerStrand;
    const states = buildStates(strands, pointsPerStrand);
    const seeds = buildSeeds(strands, pointsPerStrand);
    const indices = buildSegmentIndices(strands, pointsPerStrand);

    const geometry = new BufferGeometry();
    // `position` is required by three's bounding-sphere math; the shader
    // computes the real position from the aPos* targets instead.
    geometry.setAttribute('position', new BufferAttribute(states[0], 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    states.forEach((arr, i) => {
      geometry.setAttribute(`aPos${i}`, new BufferAttribute(arr, 3));
    });
    geometry.setIndex(new BufferAttribute(indices, 1));

    // Frustum culling is disabled below, so a cheap manual bound is enough.
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius = 12;

    this.geometry = geometry;
    this.count = count;

    this.uniforms = {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uStagger: { value: 0.55 },
      uNoise: { value: 0.12 },
      uPointer: { value: new Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uAspect: { value: 1 },
      uFocus: { value: 0 },
      uFocusBand: { value: 0 },
      uInk: { value: new Color(0xffffff) },
      uPixelRatio: { value: 1 },
    };

    const shared = this.uniforms;

    this.pointsMaterial = new ShaderMaterial({
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        ...shared,
        uSize: { value: 3.2 },
        uOpacity: { value: 0.55 },
      },
    });

    this.linesMaterial = new ShaderMaterial({
      vertexShader: linesVertex,
      fragmentShader: linesFragment,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        ...shared,
        uOpacity: { value: 0.1 },
      },
    });

    // Points draw the full vertex list; lines draw the indexed pairs.
    this.points = new Points(geometry, this.pointsMaterial);
    this.points.frustumCulled = false;
    this.lines = new LineSegments(geometry, this.linesMaterial);
    this.lines.frustumCulled = false;

    this.group.add(this.lines);
    this.group.add(this.points);
  }

  // Every material got a copy of the shared uniform objects, so writing to
  // one material's uniform updates both. Kept explicit for clarity.
  #setUniform(name, value) {
    this.pointsMaterial.uniforms[name].value = value;
    this.linesMaterial.uniforms[name].value = value;
  }

  #bindEvents() {
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize, { passive: true });

    this.onPointerMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -((event.clientY / window.innerHeight) * 2 - 1);
      this.pointerTarget.set(x, y);
      this.pointerStrengthTarget = 1;
    };

    this.onPointerLeave = () => {
      this.pointerStrengthTarget = 0;
    };

    if (!this.reducedMotion && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', this.onPointerMove, {
        passive: true,
      });
      document.addEventListener('pointerleave', this.onPointerLeave);
    }

    this.onVisibility = () => {
      this.paused = document.hidden;
    };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.#setUniform('uAspect', this.camera.aspect);
    this.#setUniform('uPixelRatio', dpr);

    // Narrow viewports need the object pulled back to stay inside the frame.
    this.frameScale = clamp(1.35 - this.camera.aspect * 0.28, 1, 1.5);
  }

  /** Scroll-driven morph position, in units of state index. */
  setProgress(value) {
    this.progressTarget = clamp(value, 0, STATE_COUNT - 1);
  }

  /** Highlight a band of strands. Pass null to release. */
  setFocus(bandOrNull) {
    if (bandOrNull == null) {
      this.focusTarget = 0;
      return;
    }
    this.focusBand = bandOrNull;
    this.focusTarget = 1;
  }

  setInk(hex) {
    this.uniforms.uInk.value.set(hex);
    this.pointsMaterial.uniforms.uInk.value.set(hex);
    this.linesMaterial.uniforms.uInk.value.set(hex);
  }

  update(dt) {
    if (this.paused) return;

    // Frame-rate independent easing: the 1 - e^(-k·dt) form keeps the feel
    // identical at 60Hz and 144Hz.
    const ease = (k) => 1 - Math.exp(-k * dt);

    this.progress = lerp(this.progress, this.progressTarget, ease(6));
    this.pointer.lerp(this.pointerTarget, ease(5));
    this.pointerStrength = lerp(
      this.pointerStrength,
      this.pointerStrengthTarget,
      ease(4)
    );
    this.focus = lerp(this.focus, this.focusTarget, ease(8));

    if (!this.reducedMotion) this.elapsed += dt;

    this.#setUniform('uProgress', this.progress);
    this.#setUniform('uTime', this.elapsed);
    this.#setUniform('uPointerStrength', this.pointerStrength);
    this.#setUniform('uFocus', this.focus);
    this.#setUniform('uFocusBand', this.focusBand);
    this.uniforms.uPointer.value.copy(this.pointer);
    this.pointsMaterial.uniforms.uPointer.value.copy(this.pointer);
    this.linesMaterial.uniforms.uPointer.value.copy(this.pointer);

    // Rotation reads the eased progress so the object turns as it reforms.
    this.group.rotation.y = this.elapsed * 0.045 + this.progress * 0.52;
    this.group.rotation.x = Math.sin(this.progress * 0.8) * 0.16;

    this.camera.position.z =
      sampleTrack(CAMERA_Z, this.progress) * this.frameScale;
    this.camera.position.y = sampleTrack(CAMERA_Y, this.progress);
    this.camera.lookAt(0, this.camera.position.y * 0.35, 0);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.geometry.dispose();
    this.pointsMaterial.dispose();
    this.linesMaterial.dispose();
    this.renderer.dispose();
  }
}
