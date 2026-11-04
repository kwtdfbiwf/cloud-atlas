// CPU-only data generation, shared by the background worker and offline checks.
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0; s ^= s >>> 12; return (s >>> 0) / 4294967296; };
}

// tileable Worley (cellular) noise, inverted so cell centres are 1
function worley3(size, cells, seed) {
  const r = rng(seed), n = cells * cells * cells;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pts[i] = r();
  const out = new Float32Array(size * size * size);
  const k = cells / size;
  let o = 0;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + 0.5) * k, py = (y + 0.5) * k, pz = (z + 0.5) * k;
    const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
    let best = 9;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const ix = (cx + dx + cells) % cells, iy = (cy + dy + cells) % cells, iz = (cz + dz + cells) % cells;
      const j = ((iz * cells + iy) * cells + ix) * 3;
      const fx = cx + dx + pts[j] - px, fy = cy + dy + pts[j + 1] - py, fz = cz + dz + pts[j + 2] - pz;
      const d = fx * fx + fy * fy + fz * fz;
      if (d < best) best = d;
    }
    out[o++] = 1 - Math.min(1, Math.sqrt(best));
  }
  return out;
}

// tileable gradient (Perlin-style) noise fbm
function perlin3(size, period, octaves, seed) {
  const out = new Float32Array(size * size * size);
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  let amp = 1, tot = 0;
  for (let oc = 0; oc < octaves; oc++) {
    const P = period << oc, r = rng(seed + oc * 101);
    const g = new Float32Array(P * P * P * 3);
    for (let i = 0; i < P * P * P; i++) {
      const th = r() * Math.PI * 2, u = r() * 2 - 1, s = Math.sqrt(1 - u * u);
      g[i * 3] = s * Math.cos(th); g[i * 3 + 1] = s * Math.sin(th); g[i * 3 + 2] = u;
    }
    const grad = (ix, iy, iz, fx, fy, fz) => {
      const j = ((((iz % P) + P) % P * P + ((iy % P) + P) % P) * P + ((ix % P) + P) % P) * 3;
      return g[j] * fx + g[j + 1] * fy + g[j + 2] * fz;
    };
    const k = P / size;
    let o = 0;
    for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x * k, py = y * k, pz = z * k;
      const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
      const fx = px - ix, fy = py - iy, fz = pz - iz;
      const u = fade(fx), v = fade(fy), w = fade(fz);
      const l = (a, b, t) => a + (b - a) * t;
      const n = l(
        l(l(grad(ix, iy, iz, fx, fy, fz), grad(ix + 1, iy, iz, fx - 1, fy, fz), u),
          l(grad(ix, iy + 1, iz, fx, fy - 1, fz), grad(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz), u), v),
        l(l(grad(ix, iy, iz + 1, fx, fy, fz - 1), grad(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1), u),
          l(grad(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1), grad(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1), u), v), w);
      out[o++] += n * amp;
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, Math.max(0, out[i] / tot * 0.9 + 0.5));
  return out;
}

function tex3D(size, channels) {
  const data = new Uint8Array(size * size * size * 4);
  for (let i = 0; i < size * size * size; i++) for (let c = 0; c < 4; c++) {
    const ch = channels[c];
    data[i * 4 + c] = ch ? Math.round(Math.min(1, Math.max(0, ch[i])) * 255) : 255;
  }
  return { data, size, dimension: 3 };
}

// 2D weather map: R broad coverage, G medium, B cells (cumulus sites), A fine
function weather2D(size) {
  const r = rng(77);
  const vnoise = (cells, seed) => {
    const rr = rng(seed), g = new Float32Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rr();
    const out = new Float32Array(size * size), k = cells / size, s = t => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = x * k, py = y * k, ix = Math.floor(px), iy = Math.floor(py), fx = s(px - ix), fy = s(py - iy);
      const a = g[(iy % cells) * cells + ix % cells], b = g[(iy % cells) * cells + (ix + 1) % cells];
      const c = g[((iy + 1) % cells) * cells + ix % cells], d = g[((iy + 1) % cells) * cells + (ix + 1) % cells];
      out[y * size + x] = (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
    }
    return out;
  };
  const fbm = (base, seed) => {
    const out = new Float32Array(size * size); let amp = 1, tot = 0;
    for (let o = 0; o < 5; o++) { const n = vnoise(base << o, seed + o); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  };
  const cells = (() => {             // 2D Worley for discrete cumulus sites
    const c = 12, pts = []; for (let i = 0; i < c * c; i++) pts.push([r(), r()]);
    const out = new Float32Array(size * size), k = c / size;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = (x + 0.5) * k, py = (y + 0.5) * k, cx = Math.floor(px), cy = Math.floor(py); let best = 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const ix = (cx + dx + c) % c, iy = (cy + dy + c) % c, p = pts[iy * c + ix];
        const fx = cx + dx + p[0] - px, fy = cy + dy + p[1] - py; best = Math.min(best, fx * fx + fy * fy);
      }
      out[y * size + x] = 1 - Math.min(1, Math.sqrt(best) * 1.3);
    }
    return out;
  })();
  const R = fbm(3, 11), G = fbm(6, 23), A = fbm(12, 41);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = R[i] * 255; data[i * 4 + 1] = G[i] * 255; data[i * 4 + 2] = cells[i] * 255; data[i * 4 + 3] = A[i] * 255;
  }
  return { data, size, dimension: 2 };
}

export function buildNoiseData() {
  const S = 64;
  const p = perlin3(S, 4, 4, 5);
  const w1 = worley3(S, 4, 1), w2 = worley3(S, 8, 2), w3 = worley3(S, 16, 3);
  // Perlin–Worley: billowy perlin, carved by worley so it has round cauliflower lobes
  const pw = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) {
    const wf = w1[i] * 0.625 + w2[i] * 0.25 + w3[i] * 0.125;
    const per = Math.min(1, Math.max(0, (p[i] - 0.5) * 1.8 + 0.5));
    pw[i] = per * 0.5 + wf * 0.5;
  }
  const base = tex3D(S, [pw, w1, w2, w3]);
  const D = 32;
  const detail = tex3D(D, [worley3(D, 4, 7), worley3(D, 8, 8), worley3(D, 16, 9), null]);
  return { base, detail, weather: weather2D(256) };
}

