// Volumetric clouds: every pixel marches a ray through a 3D field of cloud density and
// integrates how sunlight scatters and is absorbed along the way (Beer–Lambert extinction,
// a two-lobe Henyey–Greenstein phase for silver linings, approximate multiple scattering,
// ambient sky light that dims toward cloud bases, aerial haze with distance).
// Density comes from tiling 3D Perlin–Worley / Worley noise textures built at load time,
// shaped per cloud type by altitude, a 2D "weather" map and the Blender layout
// (cumulus positions, the storm tower, the rain layer).
//
// Scene units: x/z 1 unit = 100 m; heights are exaggerated 2x, so y 1 unit = 50 m.
import * as THREE from 'three';

// ---------------------------------------------------------------- noise textures (CPU, once)
// ---------------------------------------------------------------- shaders
const MAX_CU = 20;

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler3D uNoise, uDetail;
uniform sampler2D uWeather;
uniform mat4 uInvProj, uCamWorld;
uniform vec3 uCamPos, uSunDir, uSunCol;
uniform float uTime, uFlash, uAlt, uFrame;
uniform int uSteps;
uniform int uSolo;              // -1: the whole sky; otherwise only this cloud type (clouds.js id) for the ground view
uniform float uYScale;          // 2.0 undoes the climb's doubled heights, so the ground view has true proportions

// is this cloud type drawn? (ids from clouds.js)
bool on(int id) { return uSolo < 0 || uSolo == id; }
uniform vec4 uCuA[${MAX_CU}];   // x, base y, z, radius
uniform float uCuTop[${MAX_CU}];
uniform int uCuCount;
uniform vec4 uCb;               // x, base y, z, top y (of the tower, anvil sits on it)
uniform vec4 uNs;               // x, base y, z, top y
uniform vec2 uNsSize;           // half extents x, z

float remap(float v, float a, float b, float c, float d) { return c + (v - a) / (b - a) * (d - c); }
float sat(float x) { return clamp(x, 0.0, 1.0); }

// billowy base shape (Perlin–Worley eroded by its own worley fbm)
float baseShape(vec3 p, float f) {
  vec4 n = texture(uNoise,p*f);
  float wf = n.g * 0.625 + n.b * 0.25 + n.a * 0.125;
  return sat(n.r - (1.0 - wf) * 0.2);
}
// coverage-driven shaping: where coverage is high almost everything is cloud; at the edges only the noise peaks survive
float shapeCov(float shape, float cov) { return sat(remap(shape, 1.0 - cov, 1.0, 0.0, 1.0)) * cov; }
vec4 wx(vec2 xz, float f) { return texture(uWeather, xz * f); }

// exact 2D cells: distance to the nearest site and that site's random id (no texture blockiness)
vec2 hash22(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
vec2 cellSite(vec2 x) {
  vec2 i = floor(x), f = fract(x);
  float best = 9.0, id = 0.0;
  for (int yy = -1; yy <= 1; yy++) for (int xx = -1; xx <= 1; xx++) {
    vec2 o = vec2(float(xx), float(yy));
    vec2 h = hash22(i + o);
    vec2 r = o + 0.15 + h * 0.7 - f;
    float d = dot(r, r);
    if (d < best) { best = d; id = fract(h.x * 17.13 + h.y * 3.7); }
  }
  return vec2(sqrt(best), id);
}

// fewer clouds along the sight-lines to the storm and the rain layer, so they aren't buried behind
// other clouds when their chips turn toward them (1 = untouched, 0 = cleared)
float corridor(vec2 xz, vec2 to, float r, float tStart) {
  float t = dot(xz, to) / dot(to, to);
  if (t < tStart || t > 0.85) return 1.0;   // leave the clouds around you, and the target itself, alone
  return smoothstep(r, r * 1.8, length(xz - to * t));
}

// density (extinction scale) and albedo at a point. detail=false is the cheap version for light rays.
float density(vec3 p, bool detail, out float albedo, out float ice) {
  albedo = 1.0; ice = 0.0;
  float y = p.y;
  vec3 q = p + vec3(uTime * 0.12, 0.0, uTime * 0.04);       // gentle wind for the noise
  float d = 0.0;
  bool cumuliform = false;
  bool keepWhole = false;        // veils and rain: keep them whole (edge erosion would delete anything this thin)
  // the storm is looked up at from under the low deck, so its sight-line starts close in
  float clearView = uSolo >= 0 ? 1.0 : corridor(p.xz, uCb.xz, 32.0, 0.03) * corridor(p.xz, uNs.xz, 26.0, 0.12);

  // --- stratus / fog, 0–600 m: a flat, featureless grey blanket. You start inside it as fog;
  //     from above it's a smooth, even sheet (stratus has no lumps — that's what sets it apart)
  if (uSolo == 2 && y < 14.0) {
    vec4 w = wx(q.xz, 0.0015);
    float top = 7.5 + 1.2 * w.r + 0.5 * baseShape(q, 0.02);
    float prof = smoothstep(top + 0.3, top - 2.0, y);
    if (uSolo == 2) prof *= smoothstep(3.0, 5.0, y);      // ground view: lift its base off the ground (stratus sits at 150–500 m)
    float s = baseShape(q * vec3(1.0, 1.5, 1.0), 0.008) * 0.5 + 0.5;
    float st = shapeCov(s, prof * (0.88 + 0.12 * w.g)) * 0.9;
    if (st > d) { d = st; albedo = 0.8; }
  }

  // --- cumulus, bases ~800 m: the Blender cumulus as sites, plus a scattered field
  if (on(0) && y > 15.0 && y < 60.0) {
    float cov = 0.0;
    vec3 warpN = texture(uNoise,p*0.018).gba - 0.5;      // same for every cumulus: fetch once
    for (int i = 0; i < ${MAX_CU}; i++) {
      if (i >= uCuCount) break;
      vec4 a = uCuA[i];
      // a rounded body on a flat base, never taller than it is wide
      float R = a.w * 1.25, H = min((uCuTop[i] - a.y) * 0.55, R * 1.1);
      float h = (y - a.y) / H;
      if (h < 0.0 || h > 1.0) continue;
      if (abs(p.x - a.x) > R * 1.4 || abs(p.z - a.z) > R * 1.4) continue;   // nowhere near this one
      vec3 warp = warpN * vec3(R, H, R) * 0.42;
      vec3 e = (vec3(p.x, y, p.z) + warp - vec3(a.x, a.y + H * 0.3, a.z)) / vec3(R, H * (h < 0.3 ? 0.45 : 0.75), R);
            // Joined, uneven lobes form a connected cauliflower silhouette.
      float body = 1.0 - dot(e,e);
      vec3 lobeA = (e-vec3(-0.34,0.24,0.10))/vec3(0.70,0.82,0.78);
      vec3 lobeB = (e-vec3(0.38,0.10,-0.12))/vec3(0.74,0.70,0.80);
      body = max(body,max(1.0-dot(lobeA,lobeA),1.0-dot(lobeB,lobeB)));
      cov = max(cov,sat(body)*smoothstep(0.0,0.08,h)*0.98);
    }
    // scattered fair-weather cumulus: one per cell (about 3 km apart), squat domes, not every cell occupied
    vec2 cs = cellSite(p.xz * 0.032 + (texture(uNoise,vec3(p.xz*0.004,0.3)).gb - 0.5) * 0.6);
    if (cs.y > 0.42) {
      float size = 0.26 + 0.16 * fract(cs.y * 7.31);                // radius in cells
      float top = 18.0 + 9.0 * fract(cs.y * 3.17);
      float h = (y - 16.0) / (top - 16.0);
      if (h > 0.0 && h < 1.0) {
        float rr = size * sqrt(max(0.0, 1.0 - h * h)) * mix(1.0, 1.15, sin(h * 3.1416));
        cov = max(cov, sat(1.0 - cs.x / max(rr, 0.001)) * smoothstep(0.0, 0.05, h) * 1.4 * clearView);
      }
    }
    if (cov > 0.0) {
      // lobes + cauliflower, cloud-sized (shadow lookups skip the fine layer: it can't show in a shadow)
      float s = detail ? baseShape(q, 0.04) * 0.65 + baseShape(q, 0.08) * 0.35 : baseShape(q, 0.04);
      d = max(d, pow(shapeCov(s, cov), 0.8) * 3.1);
      cumuliform = true;
    }
  }

  // --- stratocumulus deck, 1,600–2,100 m: lumpy grey-white patches with blue gaps
  if (on(1) && y > 31.0 && y < 44.0) {
    vec4 w = wx(q.xz + vec2(31.0, 7.0), 0.0035);
    float h = (y - 34.0 - (w.r-0.5)*5.0) / 7.0;
    float cov = smoothstep(0.24, 0.5, w.g) * smoothstep(0.0, 0.25, h) * smoothstep(1.0, 0.55, h) * clearView;
    float s = detail ? baseShape(q, 0.03) * 0.6 + baseShape(q, 0.07) * 0.4 : baseShape(q, 0.03);
    float sc = shapeCov(s, cov * 0.95) * 1.5;
    if (sc > d) { d = sc; albedo = 0.88; }
  }

  // --- altocumulus, 3,200–3,700 m: rows of small cloudlets (seen from above in the mid tier)
  if (on(5) && y > 65.0 && y < 72.0) {
    float h = (y - 65.0) / 7.0;
    vec4 w = wx(q.xz, 0.003);
    vec3 c = texture(uDetail,vec3(q.x*0.03,q.y*0.05,q.z*0.03+sin(q.x*0.05)*0.12)).rgb;
    float warp = texture(uNoise,vec3(q.xz*0.01,0.5)).r * 9.0;
    float rows = 0.5 + 0.5 * sin(q.x * 0.22 + q.z * 0.04 + warp);
    float cells = (c.r * 0.7 + c.g * 0.3) * mix(0.85, 1.03, rows);
    float cov = smoothstep(0.3, 0.6, w.a) * smoothstep(0.0, 0.3, h) * smoothstep(1.0, 0.5, h) * clearView;
    d = max(d, sat(remap(cells, 1.0 - cov * 0.55, 1.0, 0.0, 1.0)) * 1.1);
  }

  // --- altostratus, 5,200–5,800 m: a smooth, featureless grey veil spreading in from the sunward side
  //     (as it does ahead of a front), just thin enough that the sun shows through as a dim 'watery'
  //     disc. Kept to that side so the rest of the climb still has blue sky.
  if (on(6) && y > 106.0 && y < 114.0) {
    float h = (y - 106.0) / 8.0;
    float prof = smoothstep(0.0, 0.25, h) * smoothstep(1.0, 0.7, h);
    float region = smoothstep(115.0, 70.0, length(p.xz - vec2(27.0, 12.0)) + (baseShape(q, 0.006) - 0.5) * 40.0);
    float c = prof * region * (0.85 + 0.15 * baseShape(q, 0.004)) * 0.09;
    if (c > d) { d = c; albedo = 0.48; keepWhole = true; }
  }

  // --- cirrocumulus, 7,900–8,200 m: tiny white grains in patches, just below the high tier
  if (on(9) && y > 158.0 && y < 164.0) {
    float h = (y - 158.0) / 6.0;
    vec4 w = wx(q.xz + vec2(70.0), 0.004);
    float g = texture(uDetail,q*0.18).g;
    float ripple = 0.5 + 0.5 * sin(q.x * 0.5 + q.z * 0.15 + texture(uNoise,vec3(q.xz*0.012,0.7)).r * 12.0);
    float patchy = uSolo == 9 ? 0.9 : smoothstep(0.45, 0.7, w.a) * smoothstep(0.4, 0.65, w.r);   // ground view: a patch overhead
    float cov = patchy * smoothstep(0.0, 0.4, h) * smoothstep(1.0, 0.6, h);
    float c = sat(remap(g * mix(0.88, 1.03, ripple), 1.0 - cov * 0.45, 1.0, 0.0, 1.0)) * (uSolo == 9 ? 2.8 : 0.7);
    if (c > d) { d = c; ice = 1.0; }
  }

  // --- cirrus, 9,400–9,900 m: fine fibres of ice, combed along the jet stream and curled into hooks
  if (on(7) && y > 190.0 && y < 197.0) {
    float h = (y - 190.0) / 7.0;
    vec2 s = mat2(0.88, -0.47, 0.47, 0.88) * q.xz;       // aligned with the jet stream
    float hook = texture(uWeather, vec2(s.x * 0.0004, s.y * 0.003)).r;
    float band = texture(uWeather, vec2(s.x * 0.0011, s.y * 0.006 + sin(s.x * 0.004) * 0.06)).g;   // where streaks are
    float curl = sin(s.x * 0.03 + band * 6.0) * 2.5 * hook;                                        // mares' tails
    float fq = uSolo == 7 ? 0.24 : 0.8;   // from the ground the fibres are ~10 km away: coarser, or they break into specks
    float fibre = texture(uDetail,vec3(s.x*0.003*fq,y*0.06,(s.y+curl)*0.14*fq)).r;   // long, thin fibres
    float cov = smoothstep(uSolo == 7 ? 0.35 : 0.55, 0.8, band) * smoothstep(0.15, 0.45, hook) * smoothstep(0.0, 0.35, h) * smoothstep(1.0, 0.55, h);
    float c = uSolo == 7 ? smoothstep(0.3, 0.78, fibre) * cov * 2.8 : smoothstep(0.62, 0.9, fibre) * cov * 0.8;
    if (c > d) { d = c; ice = 1.0; }
  }

  // --- cirrostratus, ~11,000 m: a faint milky veil
  if (on(8) && y > 216.0 && y < 224.0) {
    float h = (y - 216.0) / 8.0;
    float c = smoothstep(0.5, 0.8, wx(q.xz, 0.001).r) * smoothstep(0.0, 0.4, h) * smoothstep(1.0, 0.5, h) * 0.02;
    if (c > d) { d = c; ice = 1.0; }
  }

  // --- cumulonimbus: a massive tower with a dark base, flattening into an anvil downwind
  if (on(3) && y > uCb.y - 1.0 && y < uCb.w + 30.0) {
    vec2 c = uCb.xz;
    float h = (y - uCb.y) / (uCb.w - uCb.y);
    float r = 66.0 + 18.0 * h - 12.0 * smoothstep(0.75, 1.0, h);
    vec2 warp = (texture(uNoise,vec3(p.xz*0.006,y*0.004)).gb - 0.5) * 30.0;
    float tower = sat(1.1 - length(p.xz + warp - c) / r) * smoothstep(0.0, 0.02, h) * step(h, 1.02);
    float ah = (y - (uCb.w - 12.0)) / 24.0;
    float anvil = sat(1.0 - length((p.xz - c - vec2(60.0, -5.0)) / vec2(190.0, 120.0))) * smoothstep(0.0, 0.25, ah) * smoothstep(1.0, 0.5, ah);
    float cov = max(tower, anvil * 1.55);
    if (cov > 0.0) {
      float cb = shapeCov(baseShape(q, 0.011) * 0.6 + baseShape(q, 0.03) * 0.4, sat(cov * 1.4)) * 1.9;
      if (cb > d) { d = cb; albedo = mix(0.5, 1.0, smoothstep(0.0, 0.35, h)); cumuliform = true; }
    }
  }

  // --- nimbostratus: a thick, dark, shapeless rain layer
  if (on(4)) {
    vec3 e = abs(p - vec3(uNs.x, (uNs.y + uNs.w) * 0.5, uNs.z)) / vec3(uNsSize.x, (uNs.w - uNs.y) * 0.5, uNsSize.y);
    e *= e;
    float r = pow(dot(e, e), 0.25);           // superellipse: flat top and base, rounded edges
    if (r < 1.2) {
      float cov = sat(1.2 - r);
      float ns = shapeCov(baseShape(q * vec3(1.0, 1.5, 1.0), 0.012) * 0.6 + 0.4, sat(cov * 1.8)) * 1.8;
      if (ns > d) { d = ns; albedo = 0.38; }
    }
  }

  // --- rain: grey streaky curtains under the storm and the rain layer
  if (y < max(uNs.y, uCb.y) + 1.0) {
    float rain = 0.0;
    float rc = length((p.xz - uCb.xz) / vec2(38.0, 30.0));
    if (on(3) && y < uCb.y + 1.0 && rc < 1.0) rain = 1.0 - rc;
    float rn = length((p.xz - uNs.xz) / uNsSize * 0.95);
    if (on(4) && y < uNs.y + 1.0 && rn < 1.0) rain = max(rain, 1.0 - rn);
    if (rain > 0.0) {
      float streak = texture(uDetail,vec3(p.x*0.12,p.y*0.015+uTime*0.5,p.z*0.12)).r;
      float rd = sqrt(rain) * (0.08 + smoothstep(0.3, 0.7, streak) * 0.28);
      if (rd > d) { d = rd; albedo = 0.45; keepWhole = true; }
    }
  }

  // erode the edges with high-frequency detail: crisp cauliflower on heaped clouds, wispy elsewhere
  if (detail && d > 0.0 && d < 1.2 && ice < 0.5 && !keepWhole) {
    vec3 dn = texture(uDetail,q*0.10+vec3(0.0,uTime*0.012,0.0)).rgb;
    float df = dn.r * 0.625 + dn.g * 0.25 + dn.b * 0.125;
    df = cumuliform ? df : mix(1.0 - df, df, smoothstep(0.0, 0.4, d));
    d = max(0.0, remap(d, df * (cumuliform ? 0.24 : 0.24), 1.2, 0.0, 1.2));
  }
  return d;
}

float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

vec3 skyColor(vec3 rd) {
  float alt = sat(uAlt);
  // Linear-light blues: clear azure low down, deeper cobalt higher up.
  float blueHeight = smoothstep(0.0, 1.0, alt);
  vec3 zen = mix(vec3(0.025, 0.12, 0.38), vec3(0.004, 0.018, 0.10), blueHeight);
  vec3 hor = mix(vec3(0.20, 0.40, 0.66), vec3(0.055, 0.15, 0.36), blueHeight);
  float y = rd.y;
  vec3 col = mix(hor, zen, pow(sat(y), 0.38));
  // below the horizon: bright haze over the cloud sea (no ground in this sky)
  vec3 below = mix(vec3(0.48, 0.63, 0.78), vec3(0.22, 0.38, 0.60), blueHeight);
  col = y < 0.0 ? mix(hor, below, sat(-y * 4.0)) : col;
  float sd = max(dot(rd, uSunDir), 0.0);
  // 22° halo: sunlight refracted by the ice crystals of the cirrostratus veil, seen from below it
  float underVeil = uSolo == 8 ? step(0.0, rd.y)
                  : smoothstep(222.0, 205.0, uCamPos.y) * smoothstep(116.0, 124.0, uCamPos.y) * step(0.0, rd.y);
  float ring = exp(-pow((acos(clamp(sd, -1.0, 1.0)) - 0.384) / 0.014, 2.0));
  col += uSunCol * ring * underVeil * vec3(0.05, 0.045, 0.04);
  col += uSunCol * (0.03 * pow(sd, 12.0) + 0.25 * pow(sd, 64.0)) + uSunCol * 12.0 * smoothstep(0.9996, 0.9999, sd);
  return col;
}


// Intersect actual cloud-bearing volumes before integrating. Empty-space traversal
// depends on geometry, never on a noisy density sample or the preceding pixel.
vec2 cloudSpan(vec3 ro, vec3 rd, vec3 low, vec3 high) {
  vec3 inv = sign(rd + vec3(1e-8)) / max(abs(rd), vec3(1e-6));
  vec3 a = (low - ro) * inv, b = (high - ro) * inv;
  vec3 nearT = min(a, b), farT = max(a, b);
  return vec2(max(0.0, max(nearT.x, max(nearT.y, nearT.z))), min(900.0, min(farT.x, min(farT.y, farT.z))));
}
vec2 slabSpan(vec3 ro, vec3 rd, float bottom, float top) {
  return cloudSpan(ro, rd, vec3(-2000.0,bottom,-2000.0),vec3(2000.0,top,2000.0));
}

void main() {
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
  rd = normalize(vec3(rd.x, rd.y * uYScale, rd.z));   // see uYScale
  vec3 ro = uCamPos;
  vec3 sky = skyColor(rd);
  // The continuous low fog has a closed-form optical depth. Sampling this
  // almost-opaque sheet in discrete slices creates false horizontal terraces.
  vec3 fogLight = vec3(0.95,1.02,1.10);
  float localFog = 1.0;
  if(uSolo < 0) {
    vec2 fogSpan = slabSpan(ro,rd,-2.0,8.5);
    float fogLength = max(0.0,fogSpan.y-fogSpan.x);
    float fogT = exp(-fogLength*0.22);
    if(ro.y > 8.5) sky = mix(fogLight,sky,fogT);
    else localFog = fogT;
  }

  // only march where clouds can be: between the haze floor and the top of the weather
  float tMax = 900.0;
  if (rd.y > 0.0) tMax = min(tMax, (250.0 - ro.y) / rd.y);
  else if (rd.y < 0.0) tMax = min(tMax, (-2.0 - ro.y) / rd.y);

  float cosT = dot(rd, uSunDir);
  float phase = mix(hg(cosT, 0.6), hg(cosT, -0.25), 0.3) * 4.0 * 3.14159;   // forward lobe = silver linings
  float T = 1.0;
  vec3 L = vec3(0.0);
  float depth = 0.0, wsum = 0.0;
  vec2 spans[10];
  spans[0] = slabSpan(ro,rd,15.0,60.0);
  spans[1] = slabSpan(ro,rd,31.0,44.0);
  spans[2] = uSolo == 2 ? slabSpan(ro,rd,-2.0,14.0) : vec2(1.0,-1.0);
  spans[3] = cloudSpan(ro,rd,vec3(uCb.x-145.0,-2.0,uCb.z-150.0),vec3(uCb.x+260.0,uCb.w+30.0,uCb.z+150.0));
  spans[4] = cloudSpan(ro,rd,vec3(uNs.x-uNsSize.x*1.3,-2.0,uNs.z-uNsSize.y*1.3),vec3(uNs.x+uNsSize.x*1.3,uNs.w+6.0,uNs.z+uNsSize.y*1.3));
  spans[5] = slabSpan(ro,rd,65.0,72.0);
  spans[6] = slabSpan(ro,rd,106.0,114.0);
  spans[7] = slabSpan(ro,rd,190.0,197.0);
  spans[8] = slabSpan(ro,rd,216.0,224.0);
  spans[9] = slabSpan(ro,rd,158.0,164.0);
  vec3 seed = fract(vec3(gl_FragCoord.xyx) * vec3(0.1031,0.1030,0.0973));
  seed += dot(seed,seed.yxz+33.33);
  float rayPhase = fract((seed.x+seed.y)*seed.z);
  float t = 0.0, exitT = -1.0, spanSize = 1e5;
  for (int i = 0; i < 320; i++) {
    if (i >= uSteps || t >= tMax || T < 0.015) break;
    if(t >= exitT - 0.001) {
      float entry = 1e5;
      exitT = -1.0;
      for (int k = 0; k < 10; k++) {
        if (!on(k) || spans[k].y <= t + 0.001 || spans[k].y <= spans[k].x) continue;
        float start = max(t, spans[k].x);
        if (start < entry) {entry=start;exitT=spans[k].y;spanSize=spans[k].y-spans[k].x;}
      }
      if (exitT < 0.0 || entry >= tMax) break;
      t = entry;
    }
    // Two quadrature samples per interval integrate thin edges instead of toggling
    // them on/off. The step is bounded by the thickness of the intersected layer.
    float ds = min(min((0.45 + t * 0.02)*(0.9+0.2*rayPhase), max(0.15,spanSize/18.0)), min(exitT-t,tMax-t));
    if (ds < 0.001) {t += 0.002;continue;}
    float albA,iceA,albB,iceB;
    vec3 pA = ro + rd * (t + ds * 0.211325);
    vec3 pB = ro + rd * (t + ds * 0.788675);
    float dA = density(pA,true,albA,iceA), dB = density(pB,true,albB,iceB);
    float dens = (dA+dB)*0.5;
    float alb = (albA*dA+albB*dB)/max(dA+dB,1e-6);
    float ice = (iceA*dA+iceB*dB)/max(dA+dB,1e-6);
    vec3 p = (pA+pB)*0.5;
    if (dens > 0.002) {
      float sigma = dens * mix(2.4, 1.2, ice);
      // sunlight reaching this point: march toward the sun through the cheap density.
      // Thin wisps and veils barely shadow themselves, so they skip the march (it's most of the cost).
      float tau = 0.0, ls = 0.9, a2, i2;
      if (dens > 0.06 && ice < 0.5) {
        vec3 lp = p;   // stable shadow samples
        for (int j = 0; j < 3; j++) { lp += uSunDir * ls; tau += density(lp, false, a2, i2) * ls; ls *= 2.4; }
        tau = mix(dens*1.5,tau*mix(2.4,1.2,ice),smoothstep(0.06,0.25,dens));
      } else {
        tau = dens * 1.5;
      }
      // approximate multiple scattering: deep inside still glows softly instead of going black
      float beer = exp(-tau) + 0.30 * exp(-tau * 0.25) + 0.12 * exp(-tau * 0.06);
      float powder = 1.0 - exp(-sigma * 2.0);
      // skylight: dim toward the base (cloud above blocks the sky), bright on top
      float up = density(p + vec3(0.0, 2.5, 0.0), false, a2, i2) * 1.6 * smoothstep(0.02,0.25,dens);
      vec3 skyAmb = mix(vec3(0.30, 0.38, 0.50), vec3(0.52, 0.66, 0.92), sat(1.0 - up * 0.6)) * mix(1.0, 0.75, sat(uAlt));
      vec3 S = (uSunCol * phase * beer * mix(0.5, 1.0, powder) + skyAmb * exp(-up * 1.3) * 0.9 + skyAmb * 0.15) * alb;
      S = S * mix(1.0, 1.5, ice) + ice * vec3(0.55, 0.58, 0.62);   // thin ice clouds are lit right through: bright white, never grey
      // lightning: the storm lights up from inside
      float cbm = smoothstep(70.0, 15.0, length(p.xz - uCb.xz)) * step(p.y, uCb.w + 20.0);
      S += vec3(0.85, 0.9, 1.0) * uFlash * 6.0 * cbm;
      float ext = exp(-sigma * ds);
      L += T * S * (1.0 - ext);
      depth += t * T * (1.0 - ext); wsum += T * (1.0 - ext);
      T *= ext;
    }
    t += ds;
  }
  // aerial perspective: distant cloud melts into the haze
  float dAvg = wsum > 0.0 ? depth / wsum : 0.0;
  float haze = 1.0 - exp(-dAvg * mix(0.00065, 0.0003, sat(uAlt)));
  vec3 col = sky * T + mix(L, sky * (1.0 - T), haze);
  col = mix(fogLight,col,localFog);
  gl_FragColor = vec4(col, T > 0.97 ? 1e5 : dAvg);   // alpha = distance to the cloud seen here, for reprojection
}`;

// Temporal reprojection: find where this pixel's cloud was on screen last frame (using its depth
// and last frame's camera), blend with the history there, and clamp that history to the colours
// around this pixel now, so anything that's moved or been uncovered can't ghost.
const BLEND_FRAG = /* glsl */ `
layout(location = 0) out highp vec4 pc_fragColor;
in vec2 vUv;
uniform sampler2D tNew, tOld;
uniform mat4 uInvProj, uCamWorld, uPrevViewProj;
uniform vec3 uCamPos;
uniform vec2 uTexel;
uniform float uKeep, uClampK;
void main() {
  vec4 cur = texture(tNew, vUv);
  vec3 m1 = vec3(0.0), m2 = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 c = texture(tNew, vUv + vec2(float(x), float(y)) * uTexel).rgb;
    m1 += c; m2 += c * c;
  }
  m1 /= 9.0; m2 /= 9.0;
  vec3 sd = sqrt(max(m2 - m1 * m1, 0.0));
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
  vec4 clip = cur.a > 5e4 ? uPrevViewProj * vec4(rd, 0.0) : uPrevViewProj * vec4(uCamPos + rd * cur.a, 1.0);
  vec2 puv = clip.xy / clip.w * 0.5 + 0.5;
  // light spatial smoothing of this frame's grain (stronger where there's no history to lean on)
  if (uKeep <= 0.0 || clip.w <= 0.0 || any(lessThan(puv, vec2(0.0))) || any(greaterThan(puv, vec2(1.0)))) {
    pc_fragColor = vec4(mix(cur.rgb, m1, 0.12), cur.a);
    return;
  }
  vec3 now = mix(cur.rgb, m1, 0.10);
  vec3 hist = clamp(texture(tOld, puv).rgb, m1 - sd * uClampK, m1 + sd * uClampK);
  pc_fragColor = vec4(mix(now, hist, uKeep), cur.a);
}`;

const COMPOSITE_FRAG = /* glsl */ `
layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor
in vec2 vUv;
uniform sampler2D tClouds;
uniform vec2 uTexel;
void main() {
  // One bilinear lookup preserves contours without amplifying tiny edge specks.
  gl_FragColor = vec4(texture(tClouds, vUv).rgb, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

let sharedNoise = null;
let noisePromise;
export function prepareCloudNoise() {
  if (sharedNoise) return Promise.resolve(sharedNoise);
  if (noisePromise) return noisePromise;
  noisePromise = new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./noise-worker.js', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Cloud preparation timed out')); }, 20000);
    worker.onerror = error => { clearTimeout(timer); worker.terminate(); reject(error); };
    worker.onmessage = ({data: result}) => {
      clearTimeout(timer); worker.terminate();
      if (result.error) { reject(new Error(result.error)); return; }
      sharedNoise = Object.fromEntries(Object.entries(result.data).map(([name, spec]) => {
        const t = spec.dimension === 3 ? new THREE.Data3DTexture(spec.data, spec.size, spec.size, spec.size) : new THREE.DataTexture(spec.data, spec.size, spec.size);
        t.format = THREE.RGBAFormat;
        t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
        t.minFilter = t.magFilter = THREE.LinearFilter; t.unpackAlignment = 1; t.needsUpdate = true;
        return [name, t];
      }));
      resolve(sharedNoise);
    };
  });
  return noisePromise;
}

export function createVolumetricClouds(renderer) {
  const noise = sharedNoise;
  if (!noise) throw new Error('prepareCloudNoise must complete before rendering');
  const quad = new THREE.BufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uNoise: { value: noise.base }, uDetail: { value: noise.detail }, uWeather: { value: noise.weather },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uCamPos: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0.75, 0.55, 0.35).normalize() },   // behind-right of the climb: side light on the clouds
    uSunCol: { value: new THREE.Color(1.0, 0.95, 0.86).multiplyScalar(1.9) },
    uTime: { value: 0 }, uFlash: { value: 0 }, uAlt: { value: 0 }, uFrame: { value: 0 }, uSteps: { value: 72 },
    uSolo: { value: -1 }, uYScale: { value: 1 },
    uCuA: { value: Array.from({ length: MAX_CU }, () => new THREE.Vector4(0, -999, 0, 1)) },
    uCuTop: { value: new Array(MAX_CU).fill(-998) }, uCuCount: { value: 0 },
    uCb: { value: new THREE.Vector4(0, -999, 0, -998) },
    uNs: { value: new THREE.Vector4(0, -999, 0, -998) }, uNsSize: { value: new THREE.Vector2(1, 1) },
  };
  const march = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
  }));
  march.frustumCulled = false;
  const marchScene = new THREE.Scene(); marchScene.add(march);

  const mkRT = () => {
    const t = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter;
    return t;
  };
  const rt = mkRT();                         // this frame's march
  let hist = [mkRT(), mkRT()];               // accumulated result (ping-pong)
  const blend = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tNew: { value: rt.texture }, tOld: { value: null }, uKeep: { value: 0 }, uClampK: { value: 1.25 }, uTexel: { value: new THREE.Vector2() },
      uInvProj: uniforms.uInvProj, uCamWorld: uniforms.uCamWorld, uCamPos: uniforms.uCamPos,
      uPrevViewProj: { value: new THREE.Matrix4() },
    },
    vertexShader: VERT, fragmentShader: BLEND_FRAG, depthTest: false, depthWrite: false,
  }));
  blend.frustumCulled = false;
  const blendScene = new THREE.Scene(); blendScene.add(blend);
  const comp = new THREE.Mesh(quad, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms: { tClouds: { value: null }, uTexel: { value: new THREE.Vector2() } }, vertexShader: VERT, fragmentShader: COMPOSITE_FRAG,
    depthTest: false, depthWrite: false, toneMapped: true,
  }));
  comp.frustumCulled = false;
  const compScene = new THREE.Scene(); compScene.add(comp);
  const prevViewProj = new THREE.Matrix4(), curViewProj = new THREE.Matrix4(), viewInv = new THREE.Matrix4();
  let frame = 0;

  let scale = 0.5;
  return {
    uniforms,
    setSize(w, h) {
      const W = Math.max(2, Math.round(w * scale)), H = Math.max(2, Math.round(h * scale));
      rt.setSize(W, H); hist[0].setSize(W, H); hist[1].setSize(W, H); frame = 0;
      blend.material.uniforms.uTexel.value.set(1 / W, 1 / H);
      comp.material.uniforms.uTexel.value.set(1 / W, 1 / H);
    },
    setScale(s, w, h) { scale = s; this.setSize(w, h); },
    // layout from the Blender scene (all in scene units)
    setLayout({ cumulus = [], cb, ns }) {
      cumulus.slice(0, MAX_CU).forEach((c, i) => { uniforms.uCuA.value[i].set(c.x, c.base, c.z, c.r); uniforms.uCuTop.value[i] = c.top; });
      uniforms.uCuCount.value = Math.min(MAX_CU, cumulus.length);
      if (cb) uniforms.uCb.value.set(cb.x, cb.base, cb.z, cb.top);
      if (ns) { uniforms.uNs.value.set(ns.x, ns.base, ns.z, ns.top); uniforms.uNsSize.value.set(ns.hx, ns.hz); }
    },
    render(cam, { time, flash, altFrac }) {
      uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
      uniforms.uCamWorld.value.copy(cam.matrixWorld);
      uniforms.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
      uniforms.uTime.value = time; uniforms.uFlash.value = flash; uniforms.uAlt.value = altFrac;
      uniforms.uFrame.value = frame % 64;
      renderer.setRenderTarget(rt);
      renderer.render(marchScene, ortho);
      // history follows the clouds as the camera moves, so frames keep averaging out the grain mid-scroll.
      // Holding still, nothing can ghost: average over more frames and barely clamp, for a clean image.
      viewInv.copy(cam.matrixWorld).invert();
      curViewProj.multiplyMatrices(cam.projectionMatrix, viewInv);
      let still = true;
      for (let i = 0; i < 16; i++) if (Math.abs(curViewProj.elements[i] - prevViewProj.elements[i]) > 1e-5) { still = false; break; }
      blend.material.uniforms.uKeep.value = frame === 0 ? 0 : still ? 0.90 : 0.45;
      blend.material.uniforms.uClampK.value = still ? 3.0 : 1.25;
      blend.material.uniforms.uPrevViewProj.value.copy(prevViewProj);
      blend.material.uniforms.tOld.value = hist[0].texture;
      renderer.setRenderTarget(hist[1]);
      renderer.render(blendScene, ortho);
      hist = [hist[1], hist[0]];
      prevViewProj.copy(curViewProj);
      frame++;
      renderer.setRenderTarget(null);
      comp.material.uniforms.tClouds.value = hist[0].texture;
      renderer.render(compScene, ortho);
    },
  };
}
