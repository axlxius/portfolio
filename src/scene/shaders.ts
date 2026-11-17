import { BANDS, ROLES, STATE_COUNT } from './shapes.ts';

// State 0 rides in three's built-in `position` attribute; the rest are aPos1..n.
const posAttributes = Array.from({ length: STATE_COUNT - 1 }, (_, i) => `attribute vec3 aPos${i + 1};`).join('\n');

// Tent weights sum to exactly 1 between any two consecutive states, so the
// blend is a straight lerp with no branching.
const posMix = Array.from(
  { length: STATE_COUNT },
  (_, i) => `spin(${i === 0 ? 'position' : `aPos${i}`}, uSpin[${i}]) * tent(${i}.0, p)`
).join('\n    + ');

const VERTEX_COMMON = /* glsl */ `
precision highp float;

#define STATES ${STATE_COUNT}
#define BANDS ${BANDS}
#define ROLES ${ROLES}
#define PI 3.14159265

${posAttributes}
attribute vec3 aAltA;
attribute vec3 aAltB;
attribute vec4 aMeta;       // seed, position along strand, band, role

uniform float uProgress;
uniform float uTime;
uniform float uStagger;
uniform float uNoise;
uniform float uAssemble;    // 0 = scattered dust, 1 = formed (the intro)
uniform float uAlt;         // 0..1: how far the takeover shape has taken over
uniform float uAltMix;      // which of the two takeover slots is showing
uniform vec2  uSpin[STATES]; // (cos, sin) of each state's turn about y
uniform vec2  uAltSpin;
uniform vec2  uPointer;     // pointer in NDC
uniform vec2  uTrail;       // a slower copy of the pointer: its wake
uniform vec2  uPointerVel;
uniform float uPointerStrength;
uniform vec4  uShock[2];    // xy = origin (NDC), z = age (s), w = strength
uniform float uAspect;
uniform float uVelocity;    // scroll speed, signed
uniform float uCamDist;
uniform float uBandGlow[BANDS];
uniform float uRoleGlow[ROLES];
uniform float uBandDim;

varying float vAlpha;
varying float vGlow;
varying float vCoc;

float tent(float i, float p){ return max(0.0, 1.0 - abs(p - i)); }
float hash(float n){ return fract(sin(n * 127.1) * 43758.5453); }
vec3 spin(vec3 p, vec2 cs){ return vec3(p.x * cs.x + p.z * cs.y, p.y, p.z * cs.x - p.x * cs.y); }

vec4 morphedViewPosition(){
  float seed = aMeta.x;
  float along = aMeta.y;

  // Each point runs slightly ahead of or behind the scroll. The offset is
  // smooth along a strand, so a morph pours through the object like sand
  // rather than cross-fading. It fades out as progress lands on a whole
  // state, so a centred section shows its form fully built.
  float delay = seed * 0.72 + along * 0.28;
  float settle = sin(PI * fract(uProgress));
  float p = clamp(uProgress + (delay - 0.5) * uStagger * settle, 0.0, float(STATES - 1));
  float whole = floor(p);
  float part = p - whole;
  p = whole + part * part * (3.0 - 2.0 * part);

  vec3 pos = ${posMix};

  // The ribbon flows: a travelling wave along its length.
  float flow = tent(3.0, p);
  pos.y += sin(pos.x * 0.9 - uTime * 0.55 + seed * 0.6) * 0.2 * flow;
  pos.z += cos(pos.x * 0.6 - uTime * 0.4) * 0.18 * flow;

  // Slow drift keeps the structure alive while it is at rest.
  float t = uTime * 0.25;
  vec3 q = pos * 0.9 + seed * 6.2832;
  vec3 drift = 0.5 * vec3(
    sin(q.y * 1.3 + t)       + sin(q.z * 0.7 - t * 1.3),
    sin(q.z * 1.1 + t * 0.8) + sin(q.x * 0.9 + t * 1.1),
    sin(q.x * 1.2 - t)       + sin(q.y * 0.8 + t * 0.7)
  );
  pos += drift * uNoise;

  // Project takeover: the cloud reforms into the hovered project's figure.
  vec3 alt = spin(mix(aAltA, aAltB, uAltMix), uAltSpin) + drift * 0.012;
  float take = clamp(uAlt * 1.6 - delay * 0.6, 0.0, 1.0);
  take = take * take * (3.0 - 2.0 * take);
  pos = mix(pos, alt, take);

  // Intro: points fall out of scattered dust and assemble.
  float formed = clamp(uAssemble * 1.7 - delay * 0.7, 0.0, 1.0);
  float settleIn = 1.0 - pow(1.0 - formed, 3.0);
  vec3 dust = pos * 2.2
    + (vec3(hash(seed * 91.7 + along * 13.1), hash(seed * 37.3 + along * 71.9), hash(seed * 11.9 + along * 5.3)) - 0.5) * 7.0
    + vec3(0.0, 4.5, 0.0);
  pos = mix(dust, pos, settleIn);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float glow = 0.0;

  // Everything below is measured in aspect-corrected screen space, so the
  // pointer's reach is a circle on screen whatever the depth.
  vec4 clip = projectionMatrix * mv;
  vec2 ndc = clip.xy / max(clip.w, 0.0001);
  vec2 ratio = vec2(uAspect, 1.0);
  float reach = -mv.z * 0.14;

  if (uPointerStrength > 0.001) {
    vec2 d = (ndc - uPointer) * ratio;
    float dist = length(d);
    float influence = smoothstep(0.5, 0.0, dist) * uPointerStrength;
    vec2 away = d / (dist + 0.0001);
    // Repelled, and swirled sideways by a rippling field: a cheap curl.
    float swirl = sin(dist * 13.0 - uTime * 1.8 + seed * 6.2832);
    mv.xy += (away + vec2(-away.y, away.x) * swirl * 0.75) * influence * reach * 1.5;
    mv.z += influence * 0.3;

    // The wake: points near where the pointer just was are dragged along.
    float wake = smoothstep(0.65, 0.0, length((ndc - uTrail) * ratio)) * uPointerStrength;
    mv.xy += uPointerVel * wake * reach * 0.45;
  }

  // Click shockwaves: an expanding ring that shoves points outward.
  for (int i = 0; i < 2; i++) {
    vec4 shock = uShock[i];
    if (shock.w > 0.001) {
      vec2 d = (ndc - shock.xy) * ratio;
      float dist = length(d);
      float ring = exp(-pow((dist - shock.z * 1.5) / 0.13, 2.0)) * shock.w * max(0.0, 1.0 - shock.z / 1.5);
      mv.xy += d / (dist + 0.0001) * ring * reach * 2.0;
      glow += ring * 0.7;
    }
  }

  // Fast scrolling smears the cloud along the direction of travel.
  mv.y += (hash(seed * 7.7 + along) - 0.5) * uVelocity * reach;

  // Depth: fog behind the object, a soft cut in front of the lens, and a
  // circle of confusion that grows away from the focal plane.
  float depth = -mv.z;
  float rel = depth - uCamDist;
  float fog = 1.0 - smoothstep(1.2, 6.5, rel);
  float lens = smoothstep(0.3, 1.6, depth);
  vCoc = clamp(abs(rel) / 3.4, 0.0, 1.0);

  int band = int(aMeta.z + 0.5);
  int role = int(aMeta.w + 0.5);
  float atWork = tent(1.0, p) * (1.0 - take);
  float lit = uBandGlow[band] * atWork + uRoleGlow[role] * tent(2.0, p);
  glow += lit;
  float dim = 1.0 - uBandDim * 0.55 * (1.0 - uBandGlow[band]) * atWork;

  vGlow = glow;
  vAlpha = fog * lens * dim * smoothstep(0.0, 0.3, formed) / (1.0 + vCoc * vCoc * 3.5);
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
  gl_PointSize = uSize * uPixelRatio * (1.0 + vCoc * 2.2) * (1.0 + min(vGlow, 1.5) * 0.5)
               * (uCamDist / max(-mv.z, 0.001));
}
`;

// Output is premultiplied, with alpha scaled back by uAdditive: at 1 the
// points add light (dark theme), at 0 they lay down ink (light theme), and
// the theme switch can cross-fade between the two without changing blend mode.
export const pointsFragment = /* glsl */ `
precision highp float;

uniform vec3  uInk;
uniform float uOpacity;
uniform float uAdditive;

varying float vAlpha;
varying float vGlow;
varying float vCoc;

void main(){
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.1, d) * vAlpha * (uOpacity + vGlow * 0.55);
  alpha = min(alpha, 1.0);
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uInk * alpha, alpha * (1.0 - uAdditive));
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
uniform float uLineOpacity;
uniform float uAdditive;

varying float vAlpha;
varying float vGlow;
varying float vCoc;

void main(){
  float alpha = min(vAlpha * (uLineOpacity + vGlow * 0.22), 1.0);
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(uInk * alpha, alpha * (1.0 - uAdditive));
}
`;
