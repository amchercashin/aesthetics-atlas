// Туманности карты: моря в стиле гравюры (Блау, Меркатор). Поле плотности членов с шумом → изолинии → берег и линии глубины.
// Берег = изолиния поля плотности членов и их ветвей, искажённого шумом (domain warping + рваный край);
// внутри — затухающие «water lines» параллельно берегу (из карты расстояний), пунктир глубины, ручная отмывка цветом.
// Вся геометрия считается в init() в координатах карты; draw() — drawImage отмывки и stroke готовых Path2D.

  // ---------- параметры формы ----------
  const CS = 2;                 // шаг сетки, px карты
  const PAD = 90;               // поля сетки вокруг карты
  const SX = 36, SY = 27;       // ядро вокруг члена (по времени шире)
  const SC = 14;                // полуширина протоки вдоль ветви
  const WSEG = 0.6;             // вес протоки
  const T = 0.42;               // порог берега туманности
  const TP = 0.34;              // порог берега части
  const GAP = 0.2;              // зазор между соседними морями
  const GAPP = 0.3;             // зазор между частями одной туманности (проливы)
  const RHO = 0.42;             // сила рваного края
  const R_OWN = 9, R_ISL = 12;  // гарантированное море под своим членом / остров вокруг чужого
  const TIERW = [0, 1.25, 1.0, 0.85];
  // уровни water lines (px карты от берега) и пунктир глубины
  const LV_FAR = [2.8, 6.6, 11, 16, 21.8, 28.5, 36.5], DEEP_FAR = 52;
  const LV_MID = [1.9, 4.3, 7.1, 10.3, 14, 18.4, 23.6], DEEP_MID = 33;

  // ---------- детерминированный шум ----------
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const PERM = new Uint8Array(512);
  { const r = mulberry(20261014), p = []; for (let i = 0; i < 256; i++) p[i] = i; for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0, t = p[i]; p[i] = p[j]; p[j] = t; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
  const GXS = [1, -1, 0, 0, 0.7071, -0.7071, 0.7071, -0.7071], GYS = [0, 0, 1, -1, 0.7071, 0.7071, -0.7071, -0.7071];
  function perlin(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const h00 = PERM[PERM[X] + Y] & 7, h10 = PERM[PERM[X + 1] + Y] & 7, h01 = PERM[PERM[X] + Y + 1] & 7, h11 = PERM[PERM[X + 1] + Y + 1] & 7;
    const n00 = GXS[h00] * xf + GYS[h00] * yf, n10 = GXS[h10] * (xf - 1) + GYS[h10] * yf;
    const n01 = GXS[h01] * xf + GYS[h01] * (yf - 1), n11 = GXS[h11] * (xf - 1) + GYS[h11] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = n00 + u * (n10 - n00), b = n01 + u * (n11 - n01);
    return a + v * (b - a);
  }
  // fbm с поворотом октав (меньше сеточных артефактов)
  function fbm(x, y, oct) { let s = 0, a = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * perlin(x, y); n += a; a *= 0.5; const nx = x * 1.6 - y * 1.2 + 3.1; y = x * 1.2 + y * 1.6 + 7.7; x = nx; } return s / n; }
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---------- цвет ----------
  const hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c) => `rgb(${c.map((x) => Math.round(Math.max(0, Math.min(255, x)))).join(',')})`;
  function hsl(c) { const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function rgb([h, s, l]) { if (!s) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }

  // ---------- сетка ----------
  let A, NX, NY, OX, OY, WX, WY, RG, WMAX = 0;
  let nebRegs = [], partRegs = [], washFar = null, washMid = null, theme = 'light', P = {};
  const dbg = {};

  function buildWarp() {
    const S = 8, cw = Math.ceil((NX * CS) / S) + 2, ch = Math.ceil((NY * CS) / S) + 2;
    const cx = new Float32Array(cw * ch), cy = new Float32Array(cw * ch);
    const F = 1 / 210, AMP = 46;
    for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
      const x = (OX + i * S) * F, y = (OY + j * S) * F;
      const qx = fbm(x, y, 3), qy = fbm(x + 5.2, y + 1.3, 3);
      cx[j * cw + i] = AMP * fbm(x + 2.2 * qx + 1.7, y + 2.2 * qy + 9.2, 4);
      cy[j * cw + i] = AMP * 0.75 * fbm(x + 2.2 * qx + 8.3, y + 2.2 * qy + 2.8, 4);
    }
    WX = new Float32Array(NX * NY); WY = new Float32Array(NX * NY); RG = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) {
      const fy = (j * CS) / S, y0 = Math.floor(fy), ty = fy - y0;
      for (let i = 0; i < NX; i++) {
        const fx = (i * CS) / S, x0 = Math.floor(fx), tx = fx - x0, c = y0 * cw + x0, n = j * NX + i;
        const wx = (cx[c] * (1 - tx) + cx[c + 1] * tx) * (1 - ty) + (cx[c + cw] * (1 - tx) + cx[c + cw + 1] * tx) * ty;
        const wy = (cy[c] * (1 - tx) + cy[c + 1] * tx) * (1 - ty) + (cy[c + cw] * (1 - tx) + cy[c + cw + 1] * tx) * ty;
        WX[n] = wx; WY[n] = wy; const m = Math.abs(wx) + Math.abs(wy); if (m > WMAX) WMAX = m;
        const x = OX + i * CS, y = OY + j * CS;
        // рваный край: бухты и мысы + мелкая изрезанность
        RG[n] = fbm(x / 30, y / 30, 3) + 0.45 * perlin(x / 9 + 11.3, y / 9 + 3.7);
      }
    }
  }

  // ---------- поле плотности ----------
  function regBox(pts, segs, R) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (const s of segs) { x0 = Math.min(x0, s[0], s[2]); x1 = Math.max(x1, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]); y1 = Math.max(y1, s[1], s[3]); }
    const bx0 = Math.max(0, Math.floor((x0 - R - OX) / CS)), by0 = Math.max(0, Math.floor((y0 - R - OY) / CS));
    const bx1 = Math.min(NX - 1, Math.ceil((x1 + R - OX) / CS)), by1 = Math.min(NY - 1, Math.ceil((y1 + R - OY) / CS));
    return { bx0, by0, bw: bx1 - bx0 + 1, bh: by1 - by0 + 1 };
  }
  function splatField(reg, pts, segs) {
    const { bx0, by0, bw, bh } = reg, F = new Float32Array(bw * bh);
    const ix = 1 / (2 * SX * SX), iy = 1 / (2 * SY * SY), ic = 1 / (2 * SC * SC);
    for (const [px, py, w] of pts) {
      const R = 3 * SX + WMAX, i0 = Math.max(0, Math.floor((px - R - OX) / CS) - bx0), i1 = Math.min(bw - 1, Math.ceil((px + R - OX) / CS) - bx0);
      const Ry = 3 * SY + WMAX, j0 = Math.max(0, Math.floor((py - Ry - OY) / CS) - by0), j1 = Math.min(bh - 1, Math.ceil((py + Ry - OY) / CS) - by0);
      for (let j = j0; j <= j1; j++) {
        const gy = OY + (by0 + j) * CS, row = (by0 + j) * NX + bx0;
        for (let i = i0; i <= i1; i++) {
          const n = row + i, dx = OX + (bx0 + i) * CS + WX[n] - px, dy = gy + WY[n] - py, e = dx * dx * ix + dy * dy * iy;
          if (e < 4.6) F[j * bw + i] += w * Math.exp(-e);
        }
      }
    }
    for (const [ax, ay, bx, by] of segs) {
      const R = 3 * SC + WMAX, vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy || 1;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - R - OX) / CS) - bx0), i1 = Math.min(bw - 1, Math.ceil((Math.max(ax, bx) + R - OX) / CS) - bx0);
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - R - OY) / CS) - by0), j1 = Math.min(bh - 1, Math.ceil((Math.max(ay, by) + R - OY) / CS) - by0);
      for (let j = j0; j <= j1; j++) {
        const gy = OY + (by0 + j) * CS, row = (by0 + j) * NX + bx0;
        for (let i = i0; i <= i1; i++) {
          const n = row + i, qx = OX + (bx0 + i) * CS + WX[n] - ax, qy = gy + WY[n] - ay;
          let t = (qx * vx + qy * vy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = qx - t * vx, dy = qy - t * vy, e = (dx * dx + dy * dy) * ic;
          // ширина протоки слегка «дышит» по шуму
          if (e < 4.6) F[j * bw + i] += WSEG * (0.75 + 0.6 * RG[n]) * Math.exp(-e);
        }
      }
    }
    return F;
  }

  // ветви внутри группы: связи parent/links + MST (время дешевле строки), с ограничением длины
  function groupSegs(idx, key) {
    const S = A.styles, set = new Set(idx), seen = new Set(), segs = [];
    const add = (a, b) => { const k2 = a < b ? a + ':' + b : b + ':' + a; if (seen.has(k2)) return; const p = S[a], q = S[b]; if (Math.hypot((p.x - q.x) * 0.7, p.y - q.y) > 230) return; seen.add(k2); segs.push([p.x, p.y, q.x, q.y]); };
    for (const i of idx) { const s = S[i]; if (s.parent >= 0 && set.has(s.parent)) add(i, s.parent); for (const [j] of s.links) if (set.has(j)) add(i, j); }
    // MST (Прим)
    const n = idx.length, inT = new Array(n).fill(false), best = new Array(n).fill(1e18), from = new Array(n).fill(-1);
    best[0] = 0;
    for (let it = 0; it < n; it++) {
      let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || best[i] < best[u])) u = i;
      inT[u] = true; if (from[u] >= 0) add(idx[u], idx[from[u]]);
      for (let i = 0; i < n; i++) if (!inT[i]) { const p = S[idx[u]], q = S[idx[i]], d = Math.hypot((p.x - q.x) * 0.7, p.y - q.y); if (d < best[i]) { best[i] = d; from[i] = u; } }
    }
    return segs;
  }

  // ---------- компоненты, карта расстояний, изолинии ----------
  let STK = null;
  function components(M, w, h) {
    const lab = new Int32Array(w * h).fill(-1), comps = [];
    if (!STK || STK.length < w * h) STK = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
      if (!M[s] || lab[s] >= 0) continue;
      const id = comps.length; let sp = 0, cnt = 0; STK[sp++] = s; lab[s] = id;
      while (sp) { const c = STK[--sp]; cnt++; const x = c % w, y = (c / w) | 0;
        if (x > 0 && M[c - 1] && lab[c - 1] < 0) { lab[c - 1] = id; STK[sp++] = c - 1; }
        if (x < w - 1 && M[c + 1] && lab[c + 1] < 0) { lab[c + 1] = id; STK[sp++] = c + 1; }
        if (y > 0 && M[c - w] && lab[c - w] < 0) { lab[c - w] = id; STK[sp++] = c - w; }
        if (y < h - 1 && M[c + w] && lab[c + w] < 0) { lab[c + w] = id; STK[sp++] = c + w; } }
      comps.push({ id, n: cnt });
    }
    return { lab, comps };
  }
  function dt1(f, n, d, v, z) {
    let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
    }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  }
  // евклидово расстояние (в узлах) от узлов маски до ближайшего узла вне маски (Felzenszwalb)
  function edt(M, w, h) {
    const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
    const D = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) D[i] = M[i] ? 1e20 : 0;
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = D[y * w + x]; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) D[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) f[x] = D[o + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) D[o + x] = Math.sqrt(d[x]); }
    return D;
  }
  // marching squares: замкнутые изолинии уровня lev (края поля должны быть ниже уровня)
  let E0 = null, E1 = null;
  function contours(V, w, h, lev) {
    if (!E0 || E0.length < 2 * w * h) { E0 = new Int32Array(2 * w * h).fill(-1); E1 = new Int32Array(2 * w * h).fill(-1); }
    const SA = [], SB = [];
    const seg = (a, b) => { const id = SA.length; SA.push(a); SB.push(b); if (E0[a] < 0) E0[a] = id; else E1[a] = id; if (E0[b] < 0) E0[b] = id; else E1[b] = id; };
    for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
      const o = j * w + i, a = V[o], b = V[o + 1], c = V[o + w + 1], d = V[o + w];
      const cs = (a > lev ? 8 : 0) | (b > lev ? 4 : 0) | (c > lev ? 2 : 0) | (d > lev ? 1 : 0);
      if (cs === 0 || cs === 15) continue;
      const Te = 2 * o, Be = 2 * (o + w), Le = 2 * o + 1, Re = 2 * (o + 1) + 1;
      switch (cs) {
        case 1: case 14: seg(Le, Be); break;
        case 2: case 13: seg(Be, Re); break;
        case 3: case 12: seg(Le, Re); break;
        case 4: case 11: seg(Te, Re); break;
        case 6: case 9: seg(Te, Be); break;
        case 7: case 8: seg(Le, Te); break;
        case 5: if ((a + b + c + d) / 4 > lev) { seg(Le, Te); seg(Be, Re); } else { seg(Te, Re); seg(Le, Be); } break;
        case 10: if ((a + b + c + d) / 4 > lev) { seg(Te, Re); seg(Le, Be); } else { seg(Le, Te); seg(Be, Re); } break;
      }
    }
    const pt = (e, out) => { const c = e >> 1, i = c % w, j = (c / w) | 0;
      if ((e & 1) === 0) { const t = (lev - V[c]) / (V[c + 1] - V[c]); out.push(i + t, j); } else { const t = (lev - V[c]) / (V[c + w] - V[c]); out.push(i, j + t); } };
    const vis = new Uint8Array(SA.length), loops = [];
    for (let s = 0; s < SA.length; s++) {
      if (vis[s]) continue;
      const poly = []; let cur = s, e = SB[s]; pt(SA[s], poly); vis[s] = 1;
      for (;;) { pt(e, poly); const o = E0[e] === cur ? E1[e] : E0[e]; if (o < 0 || vis[o]) break; vis[o] = 1; e = SA[o] === e ? SB[o] : SA[o]; cur = o; }
      if (poly.length >= 8) { poly.length -= 2; loops.push(poly); }
    }
    for (let s = 0; s < SA.length; s++) { E0[SA[s]] = E1[SA[s]] = E0[SB[s]] = E1[SB[s]] = -1; }
    return loops;
  }
  function chaikin(p, it) {
    for (let k = 0; k < it; k++) { const n = p.length / 2, q = new Array(n * 4);
      for (let i = 0; i < n; i++) { const j = (i + 1) % n, x0 = p[2 * i], y0 = p[2 * i + 1], x1 = p[2 * j], y1 = p[2 * j + 1];
        q[4 * i] = 0.75 * x0 + 0.25 * x1; q[4 * i + 1] = 0.75 * y0 + 0.25 * y1; q[4 * i + 2] = 0.25 * x0 + 0.75 * x1; q[4 * i + 3] = 0.25 * y0 + 0.75 * y1; }
      p = q; }
    return p;
  }
  // упрощение Рамера — Дугласа — Пекера для замкнутой линии: сначала делим по самой далёкой от первой точки,
  // иначе отрезок «первая точка — она же» вырожден и вся линия схлопывается в одну точку
  function rdp(p, eps) {
    const n = p.length / 2; if (n < 8) return p;
    let far = 1, fd = 0;
    for (let i = 1; i < n; i++) { const d = (p[2 * i] - p[0]) ** 2 + (p[2 * i + 1] - p[1]) ** 2; if (d > fd) { fd = d; far = i; } }
    const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
    const X = (i) => p[2 * (i % n)], Y = (i) => p[2 * (i % n) + 1];
    const st = [0, far, far, n], e2 = eps * eps;
    while (st.length) { const b = st.pop(), a = st.pop(); const ax = X(a), ay = Y(a), dx = X(b) - ax, dy = Y(b) - ay, L2 = dx * dx + dy * dy || 1e-9; let mx = 0, mi = -1;
      for (let i = a + 1; i < b; i++) { const cx = X(i) - ax, cy = Y(i) - ay, c = cx * dy - cy * dx, d2 = (c * c) / L2; if (d2 > mx) { mx = d2; mi = i; } }
      if (mi >= 0 && mx > e2) { keep[mi] = 1; st.push(a, mi, mi, b); } }
    const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(p[2 * i], p[2 * i + 1]);
    return out;
  }
  const perim = (p) => { let s = 0; const n = p.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += Math.hypot(p[2 * j] - p[2 * i], p[2 * j + 1] - p[2 * i + 1]); } return s; };

  // изолинии поля региона → Path2D в координатах карты
  function toPath(reg, V, lev, smooth, eps, minLen, stat) {
    const loops = contours(V, reg.bw, reg.bh, lev), path = new Path2D();
    let pts = 0;
    for (let lp of loops) {
      for (let i = 0; i < lp.length; i += 2) { lp[i] = OX + (reg.bx0 + lp[i]) * CS; lp[i + 1] = OY + (reg.by0 + lp[i + 1]) * CS; }
      if (perim(lp) < minLen) continue;
      lp = rdp(chaikin(lp, smooth), eps);
      path.moveTo(lp[0], lp[1]); for (let i = 2; i < lp.length; i += 2) path.lineTo(lp[i], lp[i + 1]); path.closePath();
      pts += lp.length / 2;
    }
    if (stat) stat.pts += pts;
    return path;
  }

  // ---------- построение региона (море туманности или части) ----------
  function finishRegion(reg, G, levels, deep, stat) {
    const { bw, bh } = reg;
    for (let i = 0; i < bw; i++) { G[i] = -1; G[(bh - 1) * bw + i] = -1; }
    for (let j = 0; j < bh; j++) { G[j * bw] = -1; G[j * bw + bw - 1] = -1; }
    // убрать мелкие брызги моря
    let M = new Uint8Array(bw * bh); for (let i = 0; i < bw * bh; i++) M[i] = G[i] > 0 ? 1 : 0;
    const { lab, comps } = components(M, bw, bh);
    for (let i = 0; i < bw * bh; i++) if (M[i] && comps[lab[i]].n < 45) { M[i] = 0; G[i] = -0.05; }
    const D = edt(M, bw, bh);
    reg.G = G; reg.D = D; reg.M = M; reg.lab = lab; reg.comps = comps;
    reg.paths = [toPath(reg, G, 0, 2, 0.12, 9, stat)];
    for (const lv of levels) reg.paths.push(toPath(reg, D, lv / CS + 0.5, 2, 0.28, 14, stat));
    reg.deep = toPath(reg, D, deep / CS + 0.5, 2, 0.3, 40, stat);
    // рамка в координатах карты для отсечения
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) if (M[j * bw + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    reg.box = [OX + (reg.bx0 + x0 - 2) * CS, OY + (reg.by0 + y0 - 2) * CS, OX + (reg.bx0 + x1 + 2) * CS, OY + (reg.by0 + y1 + 2) * CS];
    buildLabelGeo(reg);
  }
  // гарантии: под своими членами — море, вокруг чужих точек — остров неправильной формы
  function guarantees(reg, G, isOwn) {
    const { bx0, by0, bw, bh } = reg;
    for (let si = 0; si < A.styles.length; si++) {
      const s = A.styles[si], own = isOwn(s), R = own ? R_OWN : R_ISL * 1.35;
      const i0 = Math.max(1, Math.floor((s.x - R - OX) / CS) - bx0), i1 = Math.min(bw - 2, Math.ceil((s.x + R - OX) / CS) - bx0);
      const j0 = Math.max(1, Math.floor((s.y - R - OY) / CS) - by0), j1 = Math.min(bh - 2, Math.ceil((s.y + R - OY) / CS) - by0);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = OX + (bx0 + i) * CS - s.x, dy = OY + (by0 + j) * CS - s.y, d = Math.hypot(dx, dy), l = j * bw + i;
        if (own) { if (d < R_OWN) G[l] = Math.max(G[l], 0.3 * (1 - d / R_OWN)); }
        else {
          const a = Math.atan2(dy, dx), rr = R_ISL * (1 + 0.28 * perlin(Math.cos(a) * 1.4 + si * 7.31, Math.sin(a) * 1.4 + si * 3.17) + 0.12 * perlin(Math.cos(a) * 3.5 + si, Math.sin(a) * 3.5 - si));
          if (d < rr) G[l] = Math.min(G[l], -0.3 * (1 - d / rr));
        }
      }
    }
  }

  // ---------- геометрия подписи: ось области (PCA главного бассейна) + кривизна ----------
  function buildLabelGeo(reg) {
    const { bw, bh, M, D, lab, comps } = reg;
    const order = comps.filter((c) => c.n >= 45).sort((a, b) => b.n - a.n);
    reg.area = order.reduce((s, c) => s + c.n, 0) * CS * CS;
    reg.basins = [];
    for (const c of order.slice(0, 3)) {
      if (c.n < order[0].n * 0.18) break;
      let sw = 0, mx = 0, my = 0;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const l = j * bw + i; if (lab[l] !== c.id) continue; const w = Math.min(D[l], 9); sw += w; mx += w * i; my += w * j; }
      mx /= sw; my /= sw;
      let cxx = 0, cyy = 0, cxy = 0;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const l = j * bw + i; if (lab[l] !== c.id) continue; const w = Math.min(D[l], 9), dx = i - mx, dy = j - my; cxx += w * dx * dx; cyy += w * dy * dy; cxy += w * dx * dy; }
      let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
      if (Math.cos(ang) < 0) ang += Math.PI;
      ang = Math.max(-0.42, Math.min(0.42, Math.atan2(Math.sin(ang), Math.cos(ang))));
      const ux = Math.cos(ang), uy = Math.sin(ang);
      // срезы поперёк оси: центр каждого среза → парабола v = a u² + b u + c
      const NB = 11; let umin = 1e9, umax = -1e9;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const l = j * bw + i; if (lab[l] !== c.id || D[l] < 1.5) continue; const u = (i - mx) * ux + (j - my) * uy; if (u < umin) umin = u; if (u > umax) umax = u; }
      if (!(umax > umin)) { umin = -1; umax = 1; }
      const bs = new Float64Array(NB), bv = new Float64Array(NB);
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) { const l = j * bw + i; if (lab[l] !== c.id) continue; const u = (i - mx) * ux + (j - my) * uy, v = -(i - mx) * uy + (j - my) * ux, b = Math.min(NB - 1, Math.max(0, Math.floor(((u - umin) / (umax - umin + 1e-9)) * NB))), w = Math.min(D[l], 9); bs[b] += w; bv[b] += w * v; }
      // взвешенный МНК для параболы по центрам срезов
      let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, V0 = 0, V1 = 0, V2 = 0;
      for (let b = 0; b < NB; b++) { if (bs[b] <= 0) continue; const u = umin + ((b + 0.5) / NB) * (umax - umin), v = bv[b] / bs[b], w = Math.sqrt(bs[b]); S0 += w; S1 += w * u; S2 += w * u * u; S3 += w * u * u * u; S4 += w * u * u * u * u; V0 += w * v; V1 += w * u * v; V2 += w * u * u * v; }
      const det3 = (a, b, c, d, e, f, g, h, k) => a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g);
      const dd = det3(S4, S3, S2, S3, S2, S1, S2, S1, S0);
      let pa = 0, pb = 0, pc = 0;
      if (Math.abs(dd) > 1e-9) { pa = det3(V2, S3, S2, V1, S2, S1, V0, S1, S0) / dd; pb = det3(S4, V2, S2, S3, V1, S1, S2, V0, S0) / dd; pc = det3(S4, S3, V2, S3, S2, V1, S2, S1, V0) / dd; }
      // центр подписи — середина оси; касательная там задаёт наклон
      const uc = 0.5 * (umin + umax), vc = pa * uc * uc + pb * uc + pc, slope = 2 * pa * uc + pb;
      const a2 = Math.max(-0.42, Math.min(0.42, ang + Math.atan(slope)));
      const L = (umax - umin) * CS;
      let curv = (pa / CS) * Math.cos(Math.atan(slope)) ** 3; // кривизна в px карты
      const half = L * 0.5, maxSag = 0.11 * L; if (Math.abs(curv) * half * half > maxSag) curv = Math.sign(curv) * maxSag / (half * half);
      const cx = OX + (reg.bx0 + mx + uc * ux - vc * uy) * CS, cy = OY + (reg.by0 + my + uc * uy + vc * ux) * CS;
      // ширина поперёк оси (глубина бассейна)
      let dmax = 0; for (let l = 0; l < bw * bh; l++) if (lab[l] === c.id && D[l] > dmax) dmax = D[l];
      reg.basins.push({ cx, cy, ang: a2, curv, L: Math.max(L, 30), area: c.n * CS * CS, depth: dmax * CS });
    }
    // выборка узлов для подписи видимой части
    const smp = [];
    for (let j = 0; j < bh; j += 3) for (let i = 0; i < bw; i += 3) { const l = j * bw + i; if (M[l] && D[l] >= 2) smp.push(OX + (reg.bx0 + i) * CS, OY + (reg.by0 + j) * CS, Math.min(D[l], 9)); }
    reg.samples = new Float32Array(smp);
  }

  // ---------- отмывка (растр в координатах сетки) ----------
  function buildWash(regs, nodeCol) {
    const cv = document.createElement('canvas'); cv.width = NX; cv.height = NY;
    const c2 = cv.getContext('2d'), img = c2.createImageData(NX, NY), px = img.data;
    const dark = theme === 'dark';
    for (const reg of regs) {
      const { bx0, by0, bw, bh, M, D } = reg;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const l = j * bw + i; if (!M[l]) continue;
        const n = (by0 + j) * NX + bx0 + i, d = D[l] * CS - CS * 0.5, o = n * 4;
        const x = OX + (bx0 + i) * CS, y = OY + (by0 + j) * CS;
        // пигмент гуще у берега (ручная раскраска гравюр), внутри — ровный слабый тон и «зерно» акварели
        const grain = 0.78 + 0.42 * (0.5 + fbm(x / 7.5 + 40, y / 7.5 - 13, 2)) + 0.12 * perlin(x / 2.6, y / 2.6);
        const band = Math.exp(-Math.max(0, d) / (dark ? 11 : 8.5));
        const a = (dark ? 0.06 + 0.15 * band : 0.065 + 0.2 * band) * grain;
        px[o] = nodeCol[n * 3]; px[o + 1] = nodeCol[n * 3 + 1]; px[o + 2] = nodeCol[n * 3 + 2]; px[o + 3] = Math.max(0, Math.min(255, a * 255));
      }
    }
    c2.putImageData(img, 0, 0);
    return cv;
  }

  // ---------- init ----------
  let initVersion = 0;
  async function init(atlas, opt) {
    const version = ++initVersion;
    const t0 = performance.now();
    try { await Promise.all(['italic 500 20px Spectral', 'italic 400 20px Spectral', 'italic 600 20px Spectral'].map((f) => document.fonts.load(f, 'АБВабв'))); } catch (e) { /* шрифт подставится */ }
    if (version !== initVersion) return false;
    A = atlas; theme = opt.theme;
    cache = null; clearTimeout(timer); lastCam = null;
    OX = -PAD; OY = -PAD; NX = Math.ceil((A.W + 2 * PAD) / CS) + 1; NY = Math.ceil((A.H + 2 * PAD) / CS) + 1;
    buildWarp(); dbg.tWarp = performance.now() - t0; dbg.WMAX = WMAX;
    const S = A.styles, paper = hex(opt.colors.paper), ink = hex(opt.colors.ink);
    const dark = theme === 'dark';
    const lineCol = (c) => dark ? mix(c, [255, 255, 255], 0.2) : mix(c, ink, 0.22);
    const nameCol = (c) => dark ? mix(c, [255, 255, 255], 0.42) : mix(c, ink, 0.38);

    // поля крупных туманностей (+ «свободные звёзды» как отдельный конкурент)
    const groups = A.nebulae.map((nb, i) => ({ idx: S.map((s, j) => (s.nebula === i ? j : -1)).filter((j) => j >= 0), i }));
    groups.push({ idx: S.map((s, j) => (s.nebula < 0 ? j : -1)).filter((j) => j >= 0), i: -1 });
    const fields = [];
    for (const gr of keepNonEmpty(groups)) {
      const pts = gr.idx.map((j) => [S[j].x, S[j].y, TIERW[S[j].tier]]), segs = gr.i >= 0 ? groupSegs(gr.idx) : [];
      const reg = regBox(pts, segs, 3 * SX + WMAX + 6);
      reg.F = splatField(reg, pts, segs); reg.gi = gr.i; reg.members = gr.idx; fields.push(reg);
    }
    dbg.tField = performance.now() - t0;
    // два лидера в каждом узле — для конкуренции морей
    const M1 = new Float32Array(NX * NY), M2 = new Float32Array(NX * NY), A1 = new Int8Array(NX * NY).fill(-1);
    fields.forEach((r, ri) => { for (let j = 0; j < r.bh; j++) for (let i = 0; i < r.bw; i++) { const f = r.F[j * r.bw + i], n = (r.by0 + j) * NX + r.bx0 + i; if (f > M1[n]) { M2[n] = M1[n]; M1[n] = f; A1[n] = ri; } else if (f > M2[n]) M2[n] = f; } });
    const stat = { pts: 0 };
    nebRegs = [];
    fields.forEach((r, ri) => {
      if (r.gi < 0) return;
      const G = new Float32Array(r.bw * r.bh);
      for (let j = 0; j < r.bh; j++) for (let i = 0; i < r.bw; i++) {
        const l = j * r.bw + i, n = (r.by0 + j) * NX + r.bx0 + i, f = r.F[l], other = A1[n] === ri ? M2[n] : M1[n];
        const g01 = Math.min(1, Math.max(0, 0.5 + RG[n] * 1.6));
        G[l] = Math.min(f - T + RHO * RG[n], f - other - GAP * (0.5 + g01));
      }
      guarantees(r, G, (s) => s.nebula === r.gi);
      const nb = A.nebulae[r.gi], col = hex(nb.color);
      Object.assign(r, { kind: 'neb', id: r.gi, name: nb.name, col, line: css(lineCol(col)), ink: css(nameCol(col)) });
      finishRegion(r, G, LV_FAR, DEEP_FAR, stat);
      nebRegs.push(r);
    });
    dbg.tNeb = performance.now() - t0;

    // части: своё поле, конкуренция только с соседями по туманности, внутри моря туманности
    partRegs = [];
    const byNeb = new Map(nebRegs.map((r) => [r.gi, r]));
    const partGroups = A.parts.map((p) => ({ ...p, idx: S.map((s, j) => (s.part === p.id ? j : -1)).filter((j) => j >= 0) }));
    const pf = keepNonEmpty(partGroups).map((p) => {
      const idx = p.idx;
      const pts = idx.map((j) => [S[j].x, S[j].y, TIERW[S[j].tier]]), segs = groupSegs(idx);
      const reg = regBox(pts, segs, 3 * SX + WMAX + 6); reg.F = splatField(reg, pts, segs); reg.members = idx; reg.pid = p.id; reg.nebula = p.nebula; return reg;
    });
    const at = (r, gx, gy, arr) => { const i = gx - r.bx0, j = gy - r.by0; return i < 0 || j < 0 || i >= r.bw || j >= r.bh ? null : arr[j * r.bw + i]; };
    for (const r of pf) {
      const nr = byNeb.get(r.nebula); if (!nr || !r.members.length) continue;
      const sibs = pf.filter((q) => q !== r && q.nebula === r.nebula);
      const G = new Float32Array(r.bw * r.bh);
      for (let j = 0; j < r.bh; j++) for (let i = 0; i < r.bw; i++) {
        const gx = r.bx0 + i, gy = r.by0 + j, n = gy * NX + gx, l = j * r.bw + i, f = r.F[l];
        const gN = at(nr, gx, gy, nr.G); if (gN === null) { G[l] = -1; continue; }
        let ms = 0; for (const q of sibs) { const v = at(q, gx, gy, q.F); if (v !== null && v > ms) ms = v; }
        const g01 = Math.min(1, Math.max(0, 0.5 + RG[n] * 1.6));
        G[l] = Math.min(gN, f - TP + RHO * RG[n], f - ms - GAPP * (0.5 + g01));
      }
      guarantees(r, G, (s) => s.part === r.pid);
      // не выходить за море туманности после гарантий
      for (let j = 0; j < r.bh; j++) for (let i = 0; i < r.bw; i++) { const gN = at(nr, r.bx0 + i, r.by0 + j, nr.G); if (gN === null || gN <= 0) G[j * r.bw + i] = Math.min(G[j * r.bw + i], gN === null ? -1 : gN); }
      const p = A.parts[r.pid];
      Object.assign(r, { kind: 'part', id: r.pid, name: p.name, col: nr.col, line: nr.line, ink: nr.ink });
      finishRegion(r, G, LV_MID, DEEP_MID, stat);
      partRegs.push(r);
    }
    dbg.tPart = performance.now() - t0;

    // цвет узлов: цвет туманности + акценты работ членов (туманность окрашена своими картинами)
    const nodeCol = new Uint8ClampedArray(NX * NY * 3);
    for (const r of nebRegs) {
      const acc = r.members.map((j) => { const s = S[j]; let c = hsl(hex(s.accent || s.palette[0])); c = [c[0], Math.max(0.35, c[1]), Math.min(0.62, Math.max(0.36, c[2]))]; return [s.x, s.y, rgb(c)]; });
      const base = r.col;
      for (let j = 0; j < r.bh; j++) for (let i = 0; i < r.bw; i++) {
        const l = j * r.bw + i; if (!r.M[l]) continue;
        const x = OX + (r.bx0 + i) * CS, y = OY + (r.by0 + j) * CS; let sw = 0, cr = 0, cg = 0, cb = 0;
        for (const [ax, ay, c] of acc) { const w = Math.exp(-((x - ax) ** 2 + (y - ay) ** 2) / 5000) + 1e-6; sw += w; cr += w * c[0]; cg += w * c[1]; cb += w * c[2]; }
        const lc = [cr / sw, cg / sw, cb / sw], m = mix(base, lc, 0.38), n = ((r.by0 + j) * NX + r.bx0 + i) * 3;
        nodeCol[n] = m[0]; nodeCol[n + 1] = m[1]; nodeCol[n + 2] = m[2];
      }
    }
    washFar = buildWash(nebRegs, nodeCol); washMid = buildWash(partRegs, nodeCol);
    dbg.tWash = performance.now() - t0;

    // ширины подписей при 100px
    const mc = document.createElement('canvas').getContext('2d');
    for (const r of nebRegs) { r.label = r.name.toUpperCase(); mc.font = 'italic 500 100px Spectral, Georgia, serif'; r.lw = splitVariants(r.label, mc); }
    for (const r of partRegs) { r.label = r.name; mc.font = 'italic 500 100px Spectral, Georgia, serif'; r.lw = splitVariants(r.label, mc); }
    P = { paper: opt.colors.paper, dark };
    dbg.pts = stat.pts; dbg.init = performance.now() - t0;
    dbg.members = S.length; dbg.nebulae = nebRegs.length; dbg.parts = partRegs.length;
    return true;
  }
  // варианты подписи: одна строка или две (разрыв по пробелу ближе к середине)
  function splitVariants(str, mc) {
    const one = [{ s: str, w: mc.measureText(str).width, n: [...str].length }];
    const vars = [one];
    const words = str.split(' ');
    if (words.length > 1) {
      let best = null;
      for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), d = Math.abs(a.length - b.length); if (!best || d < best.d) best = { a, b, d }; }
      vars.push([{ s: best.a, w: mc.measureText(best.a).width, n: [...best.a].length }, { s: best.b, w: mc.measureText(best.b).width, n: [...best.b].length }]);
    }
    return vars;
  }

// ---------- кадр ----------
// Линии строятся заново на каждый масштаб (Path2D.addPath с матрицей — в нативном коде) и рисуются
// равномерной толщиной. Готовый слой кэшируется в битмап: панорама сдвигает его, зум растягивает,
// перерисовка — после паузы. Без кэша 100 тыс. точек береговых линий давали бы 15–40 мс на кадр.
const MARGIN = 0.3, SETTLE_MS = 90, MIN_AREA = 1500;   // MIN_AREA — в обзорных px², меньше — море без линий глубины и без названия
let cache = null, lastCam = null, timer = 0, onDirty = () => {};
export function setNebulaDirtyHandler(fn) { onDirty = fn; }
const scaleKey = (c) => `${c.kx.toFixed(4)}|${c.ky.toFixed(4)}|${c.dpr}`;

function screenPaths(r, kx, ky) {
  const key = `${kx.toFixed(4)}|${ky.toFixed(4)}`;
  if (r.sp?.key === key) return r.sp;
  const m = new DOMMatrix([kx, 0, 0, ky, 0, 0]), conv = (p) => { const q = new Path2D(); q.addPath(p, m); return q; };
  return (r.sp = { key, paths: r.paths.map(conv), deep: conv(r.deep) });
}
function strokeSet(ctx, regs, w, cam, t2, far) {
  if (w < 0.01) return;
  const { kx, ky, ox, oy } = cam, x0 = -ox / kx, y0 = (cam.axis - oy) / ky, x1 = (cam.w - ox) / kx, y1 = (cam.h - oy) / ky;
  const lv = far ? LV_FAR : LV_MID, NL = lv.length, dark = P.dark;
  const coastW = (far ? 1.05 : 1.1) * (1 - 0.25 * t2), coastA = (dark ? 0.85 : 0.82) * (1 - 0.45 * t2);
  for (const r of regs) {
    const b = r.box; if (b[2] < x0 || b[0] > x1 || b[3] < y0 || b[1] > y1) continue;
    const sp = screenPaths(r, kx, ky), small = r.area < MIN_AREA;
    ctx.strokeStyle = r.line;
    const wa = w * (1 - t2);
    if (wa > 0.01 && !small) {
      ctx.lineWidth = 0.6;
      for (let n = 0; n < NL; n++) { ctx.globalAlpha = wa * (0.06 + 0.5 * Math.pow(1 - n / NL, 1.5)) * (dark ? 0.9 : 1); ctx.stroke(sp.paths[n + 1]); }
      ctx.globalAlpha = wa * 0.5; ctx.lineWidth = 0.9; ctx.setLineDash([0.01, 3.2]); ctx.lineCap = 'round';
      ctx.stroke(sp.deep); ctx.setLineDash([]); ctx.lineCap = 'butt';
    }
    ctx.globalAlpha = w * coastA; ctx.lineWidth = coastW; ctx.stroke(sp.paths[0]);
  }
}
// Отмывка и линии при камере cam в контекст c (размер cam.w × cam.h, начало — левый верх).
function paint(c, cam) {
  const { kx, ky, ox, oy, dpr } = cam, t1 = sstep(0.62, 0.95, kx), t2 = sstep(1.45, 2.05, kx);
  c.save();
  c.setTransform(dpr * kx, 0, 0, dpr * ky, dpr * ox, dpr * oy);
  c.imageSmoothingEnabled = true;
  const wa = 1 - 0.62 * t2;
  if (P.dark) c.globalCompositeOperation = 'screen';
  if (t1 < 0.99) { c.globalAlpha = wa * (1 - t1); c.drawImage(washFar, OX - CS / 2, OY - CS / 2, NX * CS, NY * CS); }
  if (t1 > 0.01) { c.globalAlpha = wa * t1; c.drawImage(washMid, OX - CS / 2, OY - CS / 2, NX * CS, NY * CS); }
  c.restore();
  c.save();
  c.setTransform(dpr, 0, 0, dpr, dpr * ox, dpr * oy);
  c.lineJoin = 'round';
  strokeSet(c, nebRegs, 1 - t1, cam, t2, true);
  strokeSet(c, partRegs, t1, cam, t2, false);
  c.restore();
}
function renderLayer(cam) {
  const mx = cam.w * MARGIN, my = cam.h * MARGIN, w = cam.w + 2 * mx, h = cam.h + 2 * my;
  const cv = cache?.cv ?? document.createElement('canvas');
  cv.width = Math.round(w * cam.dpr); cv.height = Math.round(h * cam.dpr);
  const c = cv.getContext('2d');
  cache = { cv, kx: cam.kx, ky: cam.ky, ox: cam.ox, oy: cam.oy, mx, my, w, h, dpr: cam.dpr, key: scaleKey(cam),
    u0: (-mx - cam.ox) / cam.kx, u1: (w - mx - cam.ox) / cam.kx, v0: (-my - cam.oy) / cam.ky, v1: (h - my - cam.oy) / cam.ky };
  paint(c, { ...cam, ox: cam.ox + mx, oy: cam.oy + my, w, h, axis: 0 });
}
function draw(ctx, cam) {
  if (!washFar) return;
  lastCam = cam;
  if (!cache) renderLayer(cam);
  else if (cache.key !== scaleKey(cam) || !covers(cache, cam)) {
    clearTimeout(timer);
    timer = setTimeout(() => { if (washFar && lastCam) { renderLayer(lastCam); onDirty(); } }, SETTLE_MS);
  }
  if (!cache) return;
  const r = blitRect(cache, cam);
  ctx.drawImage(cache.cv, r.x, r.y, r.w, r.h);
}
const MAX_ANG = 0.22;   // наклон названия на экране, рад

  // ---------- названия ----------
  function BoxIdx(w, h) { this.c = 48; this.nx = Math.ceil(w / 48) + 1; this.ny = Math.ceil(h / 48) + 1; this.cells = new Array(this.nx * this.ny); }
  BoxIdx.prototype.add = function (b) { const c = this.c; for (let j = Math.max(0, Math.floor(b[1] / c)); j <= Math.min(this.ny - 1, Math.floor(b[3] / c)); j++) for (let i = Math.max(0, Math.floor(b[0] / c)); i <= Math.min(this.nx - 1, Math.floor(b[2] / c)); i++) { const k2 = j * this.nx + i; (this.cells[k2] || (this.cells[k2] = [])).push(b); } };
  BoxIdx.prototype.hits = function (b) { const c = this.c; let n = 0; const seen = new Set();
    for (let j = Math.max(0, Math.floor(b[1] / c)); j <= Math.min(this.ny - 1, Math.floor(b[3] / c)); j++) for (let i = Math.max(0, Math.floor(b[0] / c)); i <= Math.min(this.nx - 1, Math.floor(b[2] / c)); i++) { const L = this.cells[j * this.nx + i]; if (!L) continue; for (const o of L) if (!seen.has(o) && b[0] < o[2] && o[0] < b[2] && b[1] < o[3] && o[1] < b[3]) { seen.add(o); n++; } }
    return n; };

  // кривая подписи в экранных координатах: центр, направление, кривизна
  function lineBoxes(cx, cy, ang, curv, wid, fs, off) {
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux, out = [], st = fs * 0.75, half = wid / 2;
    for (let t = -half; t <= half + 0.1; t += st) { const vv = curv * t * t + off, x = cx + ux * t + nx * vv, y = cy + uy * t + ny * vv; out.push([x - fs * 0.48, y - fs * 0.5, x + fs * 0.48, y + fs * 0.5]); }
    return out;
  }
  // Возвращает рамки поставленных названий ([x0, y0, x1, y1]) — чтобы подписи стилей их обходили.
  function names(g, v) {
    if (!washFar) return [];
    const k = v.kx, t1 = sstep(0.62, 0.95, k), t2 = sstep(1.45, 2.05, k);
    if (t2 > 0.6) return [];   // на рабочем масштабе названия частей пересекали бы ветви древа
    // hard — с запасом между названиями; tight — без запаса: на него переходим, если иначе названию не нашлось места.
    const hard = new BoxIdx(v.w, v.h), tight = new BoxIdx(v.w, v.h), soft = new BoxIdx(v.w, v.h);
    for (const b of v.labelBoxes || []) { hard.add([b[0] - 4, b[1] - 3, b[2] + 4, b[3] + 3]); tight.add([b[0] - 1, b[1] - 1, b[2] + 1, b[3] + 1]); }
    for (const b of v.dotBoxes || []) soft.add(b);
    for (const b of v.reserved || []) { hard.add(b); tight.add(b); }
    const defs = v.svg('defs', {}, g);
    const sets = [];
    // Два набора названий не показываются вместе: перетекание — в узком окне t1 ∈ [0.4, 0.6].
    const fFar = Math.min(1, Math.max(0, (0.6 - t1) / 0.2)), fPart = Math.min(1, Math.max(0, (t1 - 0.4) / 0.2));
    if (fFar > 0.02) sets.push({ regs: nebRegs, op: fFar, far: true });
    if (fPart > 0.02) sets.push({ regs: partRegs, op: fPart * (1 - 0.35 * t2), far: false });
    if (sets.length === 2 && t1 > 0.5) sets.reverse();
    let uid = 0;
    const placed = [];
    for (const set of sets) {
      const regs = set.regs.slice().sort((a, b) => b.area - a.area);
      for (const r of regs) {
        const b = r.box, [sx0, sy0] = v.toScreen(b[0], b[1]), [sx1, sy1] = v.toScreen(b[2], b[3]);
        if (sx1 < 0 || sx0 > v.w || sy1 < v.axis || sy0 > v.h) continue;
        if (r.area < MIN_AREA) continue;
        const best = placeName(r, v, set.far, hard, soft, t2) || placeName(r, v, set.far, tight, soft, t2);
        if (!best) continue;
        for (const bx of best.boxes) { hard.add([bx[0] - 5, bx[1] - 3, bx[2] + 5, bx[3] + 3]); tight.add(bx); placed.push(bx); }
        renderName(g, defs, v, r, best, set.op * (set.far ? 1 : 0.95), uid++, set.far);
      }
    }
    return placed;
  }
  function placeName(r, v, far, hard, soft, t2) {
    const areaS = r.area * v.kx * v.ky;
    // кегль по протяжённости области
    let fs = far ? Math.max(10.5, Math.min(19, Math.sqrt(areaS) / 8.5)) : Math.max(10.5, Math.min(14.5, Math.sqrt(areaS) / 8.5));
    if (!far && t2 > 0) fs = Math.max(10.5, fs - 1.5 * t2);
    const cands = [];
    const pushBasin = (bs, pri) => {
      const Ls = screenLength(bs.L, bs.ang, v.kx, v.ky);
      for (let vi = 0; vi < r.lw.length; vi++) {
        const lines = r.lw[vi];
        // разрядка: растянуть до ~80% оси, в пределах 0.12–0.75 em (у частей 0.06–0.32 em)
        const lsMin = far ? 0.16 : 0.06, lsMax = far ? 0.75 : 0.32;
        const nat = Math.max(...lines.map((ln) => (ln.w * fs) / 100 + lsMin * fs * (ln.n - 1)));
        let ls = lsMin * fs;
        const target = Ls * 0.8, ln0 = lines.reduce((a, b) => (a.w > b.w ? a : b));
        if (nat < target) ls = Math.min(lsMax * fs, (target - (ln0.w * fs) / 100) / Math.max(1, ln0.n - 1));
        const wid = Math.max(...lines.map((ln) => (ln.w * fs) / 100 + ls * (ln.n - 1)));
        const over = wid / Math.max(Ls, 1);
        // двухстрочный вариант — только когда одна строка заметно длиннее области
        if (vi === 1 && r.lw[0][0].w * fs / 100 < Ls * 1.1) continue;
        cands.push({ bs, lines, fs, ls, wid, pri: pri + vi * 0.5 + Math.max(0, over - 1.1) * 2 });
      }
    };
    r.basins.forEach((bs, i) => pushBasin(bs, i * 1.5));
    cands.sort((a, b) => a.pri - b.pri);
    // подпись видимой части области (если главный бассейн за кадром)
    const vis = visibleAxis(r, v);
    let bestC = null, bestCost = 1e9;
    const tryAt = (c, cx, cy, ang, curv, extra) => {
      const lh = c.fs * 1.18, nL = c.lines.length, boxes = [];
      for (let li = 0; li < nL; li++) { const off = (li - (nL - 1) / 2) * lh; boxes.push(...lineBoxes(cx, cy, ang, curv, c.lines[li].w * c.fs / 100 + c.ls * (c.lines[li].n - 1), c.fs, off)); }
      for (const b of boxes) if (b[0] < 3 || b[2] > v.w - 3 || b[1] < v.axis + 3 || b[3] > v.h - 3) return;
      let cost = extra + c.pri;
      for (const b of boxes) { if (hard.hits(b)) return; }
      let dots = 0; for (const b of boxes) dots += soft.hits(b);
      cost += dots * (far ? 1.2 : 3);
      if (cost < bestCost) { bestCost = cost; bestC = { c, cx, cy, ang, curv, boxes }; }
    };
    const offs = [[0, 0], [0, -1], [0, 1], [-0.22, 0], [0.22, 0], [0, -2], [0, 2], [-0.22, -1], [0.22, 1], [0.22, -1], [-0.22, 1], [-0.4, 0], [0.4, 0]];
    for (const c of cands) {
      const bs = c.bs, [cx, cy] = v.toScreen(bs.cx, bs.cy), Ls = screenLength(bs.L, bs.ang, v.kx, v.ky);
      const ang = Math.max(-MAX_ANG, Math.min(MAX_ANG, screenAngle(bs.ang, v.kx, v.ky)));
      const sa = Ls / bs.L, sp = Math.hypot(Math.sin(bs.ang) * v.kx, Math.cos(bs.ang) * v.ky), curv = bs.curv * sp / (sa * sa);
      const ux = Math.cos(ang), uy = Math.sin(ang), step = c.fs * 1.18 * c.lines.length * 0.8;
      for (let oi = 0; oi < offs.length; oi++) {
        const [au, an] = offs[oi];
        tryAt(c, cx + ux * au * Ls - uy * an * step, cy + uy * au * Ls + ux * an * step, ang, curv, oi * 0.35);
        if (bestCost < c.pri + 0.01) return bestC;
      }
      if (bestC && bestCost < 1.5) return bestC;
    }
    if (vis && (!bestC || bestCost > 2)) {
      for (const c of cands.slice(0, 2)) {
        const ux = Math.cos(vis.ang), uy = Math.sin(vis.ang);
        for (let oi = 0; oi < offs.length; oi++) { const [au, an] = offs[oi]; tryAt(c, vis.x + ux * au * vis.L - uy * an * c.fs * 1.4, vis.y + uy * au * vis.L + ux * an * c.fs * 1.4, vis.ang, 0, 2 + oi * 0.35); }
      }
    }
    return bestC && bestCost < (far ? 9 : 6) ? bestC : null;
  }
  // ось видимой части области по выборке глубоких узлов
  function visibleAxis(r, v) {
    const s = r.samples; let sw = 0, mx = 0, my = 0; const pts = [];
    for (let i = 0; i < s.length; i += 3) { const [x, y] = v.toScreen(s[i], s[i + 1]); if (x < 20 || x > v.w - 20 || y < v.axis + 16 || y > v.h - 16) continue; const w = s[i + 2]; pts.push(x, y, w); sw += w; mx += w * x; my += w * y; }
    if (sw < 20) return null;
    mx /= sw; my /= sw; let cxx = 0, cyy = 0, cxy = 0;
    for (let i = 0; i < pts.length; i += 3) { const dx = pts[i] - mx, dy = pts[i + 1] - my, w = pts[i + 2]; cxx += w * dx * dx; cyy += w * dy * dy; cxy += w * dx * dy; }
    let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy); if (Math.cos(ang) < 0) ang += Math.PI; ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    ang = Math.max(-MAX_ANG, Math.min(MAX_ANG, ang));
    return { x: mx, y: my, ang, L: 2 * Math.sqrt(Math.max(cxx, cyy) / sw) };
  }
  function renderName(g, defs, v, r, best, op, uid, far) {
    const { c, cx, cy, ang, curv } = best, fs = c.fs, lh = fs * 1.18, nL = c.lines.length;
    const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
    const t = v.svg('text', { 'text-anchor': 'middle', style: `font:italic ${far ? 500 : 500} ${fs.toFixed(1)}px Spectral, Georgia, serif;letter-spacing:${c.ls.toFixed(2)}px;fill:${r.ink};fill-opacity:${(op * (far ? 0.92 : 0.9)).toFixed(3)};paint-order:stroke;stroke:${P.paper};stroke-opacity:${(op * 0.55).toFixed(3)};stroke-width:${far ? 3.2 : 2.6}px;stroke-linejoin:round` }, null);
    for (let li = 0; li < nL; li++) {
      const ln = c.lines[li], wid = ln.w * fs / 100 + c.ls * ln.n, T2 = wid / 2 + 40;
      // базовая линия ниже оси на полвысоты строчных/прописных букв
      const off = (li - (nL - 1) / 2) * lh + fs * (far ? 0.34 : 0.28);
      const P0 = [cx - ux * T2 + nx * (curv * T2 * T2 + off), cy - uy * T2 + ny * (curv * T2 * T2 + off)];
      const P2 = [cx + ux * T2 + nx * (curv * T2 * T2 + off), cy + uy * T2 + ny * (curv * T2 * T2 + off)];
      const P1 = [cx + nx * (-curv * T2 * T2 + off), cy + ny * (-curv * T2 * T2 + off)];
      const id = `eng-n${uid}-${li}`;
      v.svg('path', { id, d: `M${P0[0].toFixed(1)} ${P0[1].toFixed(1)}Q${P1[0].toFixed(1)} ${P1[1].toFixed(1)} ${P2[0].toFixed(1)} ${P2[1].toFixed(1)}`, fill: 'none' }, defs);
      const tp = v.svg('textPath', { href: `#${id}`, startOffset: '50%' }, t); tp.textContent = ln.s;
    }
    g.appendChild(t);
  }

  export { edt, contours, chaikin, rdp, components };
export { init as initNebulae, draw as drawNebulae, names as drawNebulaNames };
// Группы без членов (например, нет «свободных звёзд») поле не строят.
export const keepNonEmpty = (groups) => groups.filter((g) => g.idx.length);
export function disposeNebulae() { initVersion++; washFar = washMid = null; nebRegs = []; partRegs = []; cache = null; clearTimeout(timer); lastCam = null; }
export const nebulaStats = () => ({ ...dbg });

// ---------- камера сайта: анизотропная (по x и y масштабы разные) ----------
export const screenAngle = (ang, kx, ky) => Math.atan2(Math.sin(ang) * ky, Math.cos(ang) * kx);
export const screenLength = (len, ang, kx, ky) => len * Math.hypot(Math.cos(ang) * kx, Math.sin(ang) * ky);
// Куда на экране ложится кэш, нарисованный при другой камере: сдвиг и растяжение.
export function blitRect(cache, cam) {
  const ax = cam.kx / cache.kx, ay = cam.ky / cache.ky;
  return { x: cam.ox + (-cache.mx - cache.ox) * ax, y: cam.oy + (-cache.my - cache.oy) * ay, w: cache.w * ax, h: cache.h * ay };
}
// Окно камеры (в координатах карты) целиком внутри кэша?
export function covers(cache, cam) {
  const x0 = -cam.ox / cam.kx, x1 = (cam.w - cam.ox) / cam.kx, y0 = (cam.axis - cam.oy) / cam.ky, y1 = (cam.h - cam.oy) / cam.ky;
  return x0 >= cache.u0 && x1 <= cache.u1 && y0 >= cache.v0 && y1 <= cache.v1;
}
