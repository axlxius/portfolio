import { STATE_COUNT } from './shapes.js';

// Ashima / Stefan Gustavson simplex noise (3D), public domain.
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

const posAttributes = Array.from(
  { length: STATE_COUNT },
  (_, i) => `attribute vec3 aPos${i};`
).join('\n');

// Tent weights sum to exactly 1 between any two consecutive states, so the
// blend is a straight lerp with no branching and no dynamic array indexing.
const posMix = Array.from(
  { length: STATE_COUNT },
  (_, i) => `aPos${i} * tent(${i}.0, p)`
).join('\n    + ');

const VERTEX_COMMON = /* glsl */ `
precision highp float;

${posAttributes}
attribute float aSeed;

uniform float uProgress;
uniform float uTime;
uniform float uStagger;
uniform float uNoise;
uniform vec2  uPointer;
uniform float uPointerStrength;
uniform float uAspect;
uniform float uFocus;
uniform float uFocusBand;

varying float vFade;
varying float vGlow;

${SIMPLEX}

float tent(float i, float p){ return max(0.0, 1.0 - abs(p - i)); }

vec4 morphedViewPosition(){
  // Stagger each strand slightly so the morph flows across the object
  // instead of every point arriving in lockstep.
  float p = clamp(
    uProgress + (aSeed - 0.5) * uStagger,
    0.0,
    ${(STATE_COUNT - 1).toFixed(1)}
  );

  vec3 pos = ${posMix};

  // Slow drift keeps the structure alive while it is at rest.
  float t = uTime * 0.11;
  vec3 drift = vec3(
    snoise(pos * 0.34 + vec3(0.0,  0.0, t)),
    snoise(pos * 0.34 + vec3(11.2, 3.7, t)),
    snoise(pos * 0.34 + vec3(-5.1, 8.3, t))
  );
  pos += drift * uNoise;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);

  // Pointer repulsion, measured in aspect-corrected clip space so the
  // influence radius is a circle on screen rather than an ellipse.
  if (uPointerStrength > 0.001) {
    vec4 clip = projectionMatrix * mv;
    vec2 ndc = clip.xy / max(abs(clip.w), 0.0001);
    vec2 delta = (ndc - uPointer) * vec2(uAspect, 1.0);
    float dist = length(delta);
    float influence = smoothstep(0.6, 0.0, dist) * uPointerStrength;
    mv.xy += normalize(delta + vec2(1e-5)) * influence * 0.45;
    mv.z  += influence * 0.3;
  }

  float depth = -mv.z;
  vFade = 1.0 - smoothstep(4.5, 14.0, depth);
  vFade *= smoothstep(0.0, 1.2, depth); // hide points clipping through camera

  // Circular distance from the highlighted band of strands.
  float bandDist = abs(fract(aSeed - uFocusBand + 0.5) - 0.5);
  vGlow = (1.0 - smoothstep(0.0, 0.13, bandDist)) * uFocus;

  return mv;
}
`;

export const pointsVertex = /* glsl */ `
${VERTEX_COMMON}

uniform float uSize;
uniform float uPixelRatio;

void main(){
  vec4 mv = morphedViewPosition();
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (1.0 + vGlow * 1.6)
               * (4.0 / max(-mv.z, 0.001));
}
`;

export const pointsFragment = /* glsl */ `
precision highp float;

uniform vec3  uInk;
uniform float uOpacity;

varying float vFade;
varying float vGlow;

void main(){
  float d = length(gl_PointCoord - 0.5);
  float mask = smoothstep(0.5, 0.15, d);
  float alpha = mask * vFade * (uOpacity + vGlow * 0.6);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uInk, alpha);
}
`;

export const linesVertex = /* glsl */ `
${VERTEX_COMMON}

void main(){
  gl_Position = projectionMatrix * morphedViewPosition();
}
`;

export const linesFragment = /* glsl */ `
precision highp float;

uniform vec3  uInk;
uniform float uOpacity;

varying float vFade;
varying float vGlow;

void main(){
  float alpha = vFade * (uOpacity + vGlow * 0.5);
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(uInk, alpha);
}
`;
