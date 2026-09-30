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
import { focusEdges } from './bands.js';
import {
  CAMERA_Y,
  CAMERA_Z,
  FIT_WIDTH,
  NOISE,
  SETTLE,
  STAGGER,
  fitCameraZ,
  sampleTrack,
} from './tracks.js';

import {
  linesFragment,
  linesVertex,
  pointsFragment,
  pointsVertex,
} from './shaders.js';

const DESKTOP = { strands: 220, pointsPerStrand: 28 };
const MOBILE = { strands: 110, pointsPerStrand: 20 };

// Dots are sized in pixels but the object scales with viewport height.
const DOT_SIZE = 3.2;
// How much a lit strand's dots grow. A lift in brightness with a small size
// change reads as "this project" without the hoop turning heavy.
const GLOW_SIZE = 0.45;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default class Scene {
  constructor(canvas, { reducedMotion = false, projectBands = [] } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;
    this.projectBands = projectBands;

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
    const states = buildStates(strands, pointsPerStrand, {
      projectBands: this.projectBands,
    });
    const edges = focusEdges(this.projectBands);
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
      uStagger: { value: STAGGER[0] },
      uNoise: { value: NOISE[0] },
      uSettle: { value: SETTLE[0] },
      uPointer: { value: new Vector2(0, 0) },
      uPointerStrength: { value: 0 },
      uAspect: { value: 1 },
      uFocus: { value: 0 },
      uFocusBand: { value: 0 },
      uFocusEdge: { value: new Vector2(edges.inner, edges.outer) },
      uDepthShift: { value: 0 },
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
        uSize: { value: DOT_SIZE },
        uGlowSize: { value: GLOW_SIZE },
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

    // Keep the dot-to-shape ratio roughly constant, so landscape phones don't
    // get chunky dots.
    this.pointsMaterial.uniforms.uSize.value = DOT_SIZE * clamp(height / 900, 0.6, 1.1);
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
    this.#setUniform('uStagger', sampleTrack(STAGGER, this.progress));
    this.#setUniform('uNoise', sampleTrack(NOISE, this.progress));
    this.#setUniform('uSettle', sampleTrack(SETTLE, this.progress));
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

    const baseZ = sampleTrack(CAMERA_Z, this.progress) * this.frameScale;
    const z = fitCameraZ(
      baseZ,
      sampleTrack(FIT_WIDTH, this.progress),
      this.camera.fov,
      this.camera.aspect
    );
    this.camera.position.z = z;
    this.camera.position.y = sampleTrack(CAMERA_Y, this.progress);
    // The extra distance is only for framing: keep depth fog from dimming it.
    this.#setUniform('uDepthShift', z - baseZ);
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
