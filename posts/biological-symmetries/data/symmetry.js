/* ============================================================================
 * symmetry.js — self-contained interactive figures for "Biological symmetries".
 *
 * No build step, no dependencies. Drop <div data-sym="..."> containers on the
 * page and load this file once with <script defer>. Every container is picked
 * up on DOMContentLoaded and turned into an interactive figure.
 *
 * Widget types (data-sym):
 *   square      2D — an operation that leaves a shape unchanged
 *   compose     2D — composing two rotations of a C5 pinwheel (the group axioms)
 *   cyclic      3D — Cn, one rotation axis            (data-n)
 *   dihedral    3D — Dn, an n-fold axis + n 2-folds   (data-n)
 *   solid       3D — a polyhedral group T / O / I with its axis families
 *                     (data-shape = tetra|octa|ico, data-switch, data-capsid)
 *   helical     3D — a screw axis: the infinite escape hatch
 *   ck          2D — the Caspar–Klug (h,k) lattice and the T-number
 *
 * All 3D scenes share one tiny orthographic renderer + trackball (Viewer3D).
 * ========================================================================== */
(function () {
  "use strict";
  if (window.__symInit) return;
  window.__symInit = true;

  /* ---- palette (axis families follow the reference SVGs) ----------------- */
  var PAL = {
    c5: "#c85a2b", c4: "#2f6db0", c3: "#0f8060", c2: "#6b4fbb",
    axis: "#b8763f", ink: "#2a2622", faint: "#b7b0a4",
    edge: "#4f4a42", pent: "#c85a2b", hex: "#0f8060",
    panel: "#fbfaf6", border: "#e2ddd2", hair: "#ece7dc",
    sub: "#c9b085", subLine: "#9c7f52"
  };
  var FOLD_COLOR = { 2: PAL.c2, 3: PAL.c3, 4: PAL.c4, 5: PAL.c5 };

  /* ---- one-time CSS ------------------------------------------------------ */
  var CSS =
  ".symfig{margin:1.7rem 0;border:1px solid " + PAL.border + ";border-radius:11px;" +
    "background:" + PAL.panel + ";overflow:hidden;font-family:'IBM Plex Sans',system-ui,sans-serif}" +
  ".symfig .sf-stage{position:relative}" +
  ".symfig canvas{display:block;width:100%;touch-action:none}" +
  ".symfig.grab canvas{cursor:grab}.symfig.grab canvas:active{cursor:grabbing}" +
  ".symfig .sf-controls{display:flex;flex-wrap:wrap;gap:.45rem .9rem;align-items:center;" +
    "padding:.6rem .85rem;border-top:1px solid " + PAL.hair + ";font-size:.82rem;color:#4a453e}" +
  ".symfig .sf-cap{padding:.6rem .9rem;font-size:.82rem;line-height:1.45;color:#6a645b;" +
    "border-top:1px solid " + PAL.hair + ";font-family:'IBM Plex Serif',Georgia,serif}" +
  ".symfig .sf-cap b{color:#4a453e;font-weight:600}" +
  ".symfig .sf-btn{cursor:pointer;border:1px solid #d6cfc0;background:#fff;color:#3a352e;" +
    "border-radius:7px;padding:.28rem .6rem;font:inherit;font-size:.8rem;line-height:1}" +
  ".symfig .sf-btn:hover{background:#f3efe6}.symfig .sf-btn.on{background:#efe7d8;border-color:#c9bda3}" +
  ".symfig .sf-btn:disabled{opacity:.45;cursor:default}" +
  ".symfig .sf-chip{cursor:pointer;user-select:none;display:inline-flex;align-items:center;gap:.4rem;" +
    "padding:.24rem .55rem;border:1px solid #d9d3c6;border-radius:999px;background:#fff;font-size:.8rem;color:#6a645b}" +
  ".symfig .sf-chip .dot{width:.62rem;height:.62rem;border-radius:50%;opacity:.35}" +
  ".symfig .sf-chip.on{color:#2a2622;border-color:#c9bda3;background:#fdfaf3}" +
  ".symfig .sf-chip.on .dot{opacity:1}" +
  ".symfig .sf-lab{color:#8a8478}.symfig .sf-num{font-family:'IBM Plex Mono',monospace;" +
    "font-variant-numeric:tabular-nums;color:#2a2622}" +
  ".symfig input[type=range]{accent-color:" + PAL.c5 + ";vertical-align:middle}" +
  ".symfig .sf-read{font-family:'IBM Plex Mono',monospace;font-size:.78rem;color:#4a453e;" +
    "background:#fff;border:1px solid " + PAL.hair + ";border-radius:6px;padding:.15rem .45rem}" +
  ".symfig .sf-tag{position:absolute;font-family:'IBM Plex Mono',monospace;font-size:.72rem;" +
    "padding:.05rem .3rem;border-radius:4px;pointer-events:none;transform:translate(-50%,-50%);white-space:nowrap}";
  var styleEl = document.createElement("style");
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---- tiny DOM helpers -------------------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function chip(label, color, on) {
    var c = el("span", "sf-chip" + (on ? " on" : ""));
    var d = el("span", "dot");
    d.style.background = color;
    c.appendChild(d);
    c.appendChild(document.createTextNode(label));
    return c;
  }

  /* ---- 3x3 matrix / vector math ----------------------------------------- */
  function mul(a, b) {
    var r = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 3; i++)
      for (var j = 0; j < 3; j++)
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  function mv(m, v) {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
  }
  function rotX(t) { var c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; }
  function rotY(t) { var c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; }
  function rotZ(t) { var c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; }
  function rotAxis(u, t) { // Rodrigues, u unit
    var c = Math.cos(t), s = Math.sin(t), C = 1 - c, x = u[0], y = u[1], z = u[2];
    return [
      c + x * x * C, x * y * C - z * s, x * z * C + y * s,
      y * x * C + z * s, c + y * y * C, y * z * C - x * s,
      z * x * C - y * s, z * y * C + x * s, c + z * z * C
    ];
  }
  function len(v) { return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]); }
  function norm(v) { var l = len(v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function vdot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  /* ---- polyhedra: derive edges/faces/axes from vertices ------------------ */
  function buildModel(rawV, folds) {
    // normalize to unit circumradius
    var cr = len(rawV[0]);
    var V = rawV.map(function (v) { return scale(v, 1 / cr); });
    var n = V.length, i, j, k;
    // edges: shortest pairwise distance
    var d0 = Infinity;
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var d = len(sub(V[i], V[j])); if (d < d0) d0 = d;
    }
    var E = [], adj = [];
    for (i = 0; i < n; i++) adj.push([]);
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      if (Math.abs(len(sub(V[i], V[j])) - d0) < 0.06 * d0) {
        E.push([i, j]); adj[i].push(j); adj[j].push(i);
      }
    }
    // triangular faces: mutually adjacent triples
    function isEdge(a, b) { return adj[a].indexOf(b) !== -1; }
    var F = [];
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) for (k = j + 1; k < n; k++)
      if (isEdge(i, j) && isEdge(j, k) && isEdge(i, k)) F.push([i, j, k]);

    // axis families, deduped by line (antipodal-insensitive)
    function dedupe(points, fold) {
      var out = [], seen = {};
      points.forEach(function (p) {
        var u = norm(p);
        // canonical sign: first significant component positive
        var s = 1;
        for (var q = 0; q < 3; q++) { if (Math.abs(u[q]) > 1e-6) { s = u[q] < 0 ? -1 : 1; break; } }
        var c = scale(u, s);
        var key = c.map(function (x) { return Math.round(x * 1000); }).join(",");
        if (seen[key]) return;
        seen[key] = 1;
        out.push({ p: u, fold: fold, color: FOLD_COLOR[fold] });
      });
      return out;
    }
    var axes = [];
    if (folds.vertex) axes = axes.concat(dedupe(V, folds.vertex));
    if (folds.face) axes = axes.concat(dedupe(F.map(function (f) {
      return norm(add(add(V[f[0]], V[f[1]]), V[f[2]]));
    }), folds.face));
    if (folds.edge) axes = axes.concat(dedupe(E.map(function (e) {
      return norm(add(V[e[0]], V[e[1]]));
    }), folds.edge));

    return { V: V, E: E, F: F, adj: adj, axes: axes, folds: folds };
  }

  var PHI = (1 + Math.sqrt(5)) / 2;
  var RAW = {
    tetra: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
    octa: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
    ico: [
      [0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI],
      [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
      [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1]
    ]
  };
  var MODEL = {
    tetra: buildModel(RAW.tetra, { vertex: 3, edge: 2 }),
    octa: buildModel(RAW.octa, { vertex: 4, face: 3, edge: 2 }),
    ico: buildModel(RAW.ico, { vertex: 5, face: 3, edge: 2 })
  };
  var ORDER = { tetra: 12, octa: 24, ico: 60 };
  var SHAPE_LABEL = { tetra: "T — tetrahedral", octa: "O — octahedral", ico: "I — icosahedral" };

  /* ---- 3D convex hull (incremental) ------------------------------------- *
   * For points in convex position on a sphere the hull IS the geodesic
   * polyhedron — every face a triangle, no degeneracies — so its dual gives the
   * exact Goldberg (capsid) tiling. Returns face vertex-index triples. */
  function convexHull(P) {
    var n = P.length, eps = 1e-10, i;
    function normal(f) { return cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]])); }
    function orient(f, inside) {                 // wind so the normal points away from P[inside]
      if (vdot(normal(f), sub(P[inside], P[f[0]])) > 0) { var t = f[1]; f[1] = f[2]; f[2] = t; }
      return f;
    }
    // spread starting tetrahedron
    var i0 = 0, i1 = 1, best = -1;
    for (i = 1; i < n; i++) { var d = len(sub(P[i], P[i0])); if (d > best) { best = d; i1 = i; } }
    var i2 = -1; best = eps;
    for (i = 0; i < n; i++) { if (i === i0 || i === i1) continue; var ar = len(cross(sub(P[i], P[i0]), sub(P[i1], P[i0]))); if (ar > best) { best = ar; i2 = i; } }
    var pn = cross(sub(P[i1], P[i0]), sub(P[i2], P[i0])), i3 = -1; best = eps;
    for (i = 0; i < n; i++) { if (i === i0 || i === i1 || i === i2) continue; var vol = Math.abs(vdot(sub(P[i], P[i0]), pn)); if (vol > best) { best = vol; i3 = i; } }
    var faces = [orient([i0, i1, i2], i3), orient([i0, i1, i3], i2), orient([i0, i2, i3], i1), orient([i1, i2, i3], i0)];
    var used = {}; used[i0] = used[i1] = used[i2] = used[i3] = 1;
    for (var pi = 0; pi < n; pi++) {
      if (used[pi]) continue;
      var p = P[pi], vis = [], keep = [];
      for (var fi = 0; fi < faces.length; fi++) {
        if (vdot(normal(faces[fi]), sub(p, P[faces[fi][0]])) > eps) vis.push(faces[fi]); else keep.push(faces[fi]);
      }
      if (!vis.length) continue;
      var edge = {};                              // directed edges of visible faces
      vis.forEach(function (f) {
        [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(function (e) { edge[e[0] + "_" + e[1]] = e; });
      });
      faces = keep;
      Object.keys(edge).forEach(function (k) {     // horizon edge = one with no visible twin
        var e = edge[k];
        if (!edge[e[1] + "_" + e[0]]) faces.push([e[0], e[1], pi]);
      });
      used[pi] = 1;
    }
    return faces;
  }

  // The 60 rotations of I, built once from the icosahedral axis families
  // (identity + (fold-1) rotations about each axis). Used to replicate one
  // master face's lattice into the full capsid by exact symmetry.
  var ICO_GROUP = (function () {
    var G = [[1, 0, 0, 0, 1, 0, 0, 0, 1]];
    MODEL.ico.axes.forEach(function (ax) {
      for (var m = 1; m < ax.fold; m++) G.push(rotAxis(ax.p, 2 * Math.PI * m / ax.fold));
    });
    return G;                                        // length 60
  })();

  /* ---- Caspar–Klug capsid: capsomer centres for triangulation number (h,k) -
   * Enumerate the (h,k) lattice points of the closed CK triangle — corners
   * (0,0),(h,k),(-k,h+k) in the triangular basis a1,a2 — and map them onto ONE
   * icosahedral face by barycentric interpolation + projection to the sphere.
   * Then replicate that master face with all 60 rotations of I and dedupe. Doing
   * it by exact symmetry (rather than mapping each face independently) is what
   * keeps adjacent faces in phase for chiral classes, so the capsomers stay
   * evenly spaced and the tiling is a proper Goldberg polyhedron. A capsomer is a
   * pentamer iff it lands on an icosahedral vertex. Counts are exact: 12
   * pentamers, 10(T-1) hexamers, T = h^2+hk+k^2. */
  var CK_A1 = [1, 0], CK_A2 = [0.5, Math.sqrt(3) / 2];
  function capsomerGeometry(h, k) {
    if (h === 0 && k === 0) h = 1;
    var V = MODEL.ico.V, F0 = MODEL.ico.F[0];
    var A = V[F0[0]], B = V[F0[1]], C = V[F0[2]];
    function L(i, j) { return [i * CK_A1[0] + j * CK_A2[0], i * CK_A1[1] + j * CK_A2[1]]; }
    var Q1 = L(h, k), Q2 = L(-k, h + k);
    var det = Q1[0] * Q2[1] - Q2[0] * Q1[1];
    function bary(P) {
      var b = (P[0] * Q2[1] - Q2[0] * P[1]) / det, g = (Q1[0] * P[1] - P[0] * Q1[1]) / det;
      return [1 - b - g, b, g];
    }
    // lattice points of the CK triangle, mapped onto the master face
    var lo = Math.min(0, h, -k) - 1, hi = Math.max(0, h, -k) + 1;
    var jlo = Math.min(0, k, h + k) - 1, jhi = Math.max(0, k, h + k) + 1;
    var master = [], e = 1e-9;
    for (var i = lo; i <= hi; i++) for (var j = jlo; j <= jhi; j++) {
      var bc = bary(L(i, j));
      if (bc[0] >= -e && bc[1] >= -e && bc[2] >= -e) {
        master.push(norm([
          bc[0] * A[0] + bc[1] * B[0] + bc[2] * C[0],
          bc[0] * A[1] + bc[1] * B[1] + bc[2] * C[1],
          bc[0] * A[2] + bc[1] * B[2] + bc[2] * C[2]
        ]));
      }
    }
    // replicate the master face across the whole group, dedupe by 3D position
    var caps = [], seen = {};
    ICO_GROUP.forEach(function (g) {
      master.forEach(function (p) {
        var q = mv(g, p);
        var key = Math.round(q[0] * 1000) + "," + Math.round(q[1] * 1000) + "," + Math.round(q[2] * 1000);
        if (seen[key]) return;
        seen[key] = 1;
        var vert = false;
        for (var vi = 0; vi < V.length; vi++) { if (len(sub(V[vi], q)) < 1e-3) { vert = true; break; } }
        caps.push({ c: q, type: vert ? "p" : "h" });
      });
    });
    // Tiles are the exact dual of the geodesic polyhedron. Take the convex hull
    // of the capsomer centres (= the geodesic triangulation); each hull triangle
    // contributes one Goldberg vertex at its spherical circumcentre. A capsomer's
    // tile is the ordered circumcentres of the hull triangles incident to it —
    // shared exactly by the 3 tiles that meet there, so the tiling is seamless.
    // A small inset toward each centre leaves clean grout lines.
    var INSET = 0.14;
    var P = caps.map(function (c) { return c.c; });
    var hull = convexHull(P);
    var cc = hull.map(function (f) {                    // spherical circumcentre per triangle
      var m = cross(sub(P[f[1]], P[f[0]]), sub(P[f[2]], P[f[0]]));
      if (vdot(m, P[f[0]]) < 0) m = scale(m, -1);
      return norm(m);
    });
    var vfaces = P.map(function () { return []; });      // triangles incident to each capsomer
    hull.forEach(function (f, fi) { f.forEach(function (vi) { vfaces[vi].push(fi); }); });
    caps.forEach(function (cap, ci) {
      var nrm = cap.c, fis = vfaces[ci];
      if (!fis.length) { cap.poly = []; return; }
      var t1 = norm(sub(cc[fis[0]], scale(nrm, vdot(cc[fis[0]], nrm)))), t2 = cross(nrm, t1);
      fis.sort(function (a, b) {
        return Math.atan2(vdot(cc[a], t2), vdot(cc[a], t1)) - Math.atan2(vdot(cc[b], t2), vdot(cc[b], t1));
      });
      cap.poly = fis.map(function (fi) {
        var v = cc[fi];
        return norm(add(v, scale(sub(nrm, v), INSET)));  // inset toward the centre
      });
    });
    return caps;
  }
  var CAP1 = capsomerGeometry(1, 0);   // the T=1 shell reused as the section-6 overlay

  // draw a set of capsomers as a translucent tiled shell (depth-sorted)
  function drawCapsomers(v, caps) {
    var ctx = v.ctx;
    caps.map(function (cap) { return { cap: cap, z: v.project(cap.c).z }; })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (it) {
        var f = Math.max(0, Math.min(1, (it.z + 1.05) / 2.1));
        var pts = it.cap.poly.map(function (p) { return v.project(p); });
        ctx.globalAlpha = 0.24 + 0.64 * f;
        ctx.fillStyle = it.cap.type === "p" ? PAL.pent : PAL.hex;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (var m = 1; m < pts.length; m++) ctx.lineTo(pts[m].x, pts[m].y);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.45 + 0.5 * f; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalAlpha = 1;
      });
  }

  /* ---- shared 3D viewer -------------------------------------------------- */
  function Viewer3D(host, opts) {
    opts = opts || {};
    host.classList.add("grab");
    var stage = el("div", "sf-stage");
    var canvas = el("canvas");
    stage.appendChild(canvas);
    host.appendChild(stage);
    var ctx = canvas.getContext("2d");
    var height = opts.height || 340;
    var S = 1, cx = 0, cy = 0, dpr = 1, W = 0, H = 0;

    var userR = mul(rotX(-0.42), rotY(0.6));   // pleasant default tilt
    var spin = 0, spinning = opts.autoSpin !== false, spinSpeed = opts.spinSpeed || 0.16;
    var self = { canvas: canvas, ctx: ctx, stage: stage, scene: opts.scene || function () {} };

    function resize() {
      W = host.clientWidth || 600; H = height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; S = 0.4 * Math.min(W, H) * (opts.zoom || 1);
    }
    // project object-space point -> {x,y,z} using current composed rotation
    var R = userR;
    function project(p) {
      var q = mv(R, p);
      return { x: cx + S * q[0], y: cy - S * q[1], z: q[2] };
    }
    self.project = project;
    self.depthAlpha = function (z) { return 0.28 + 0.72 * Math.max(0, Math.min(1, (z + 1.15) / 2.3)); };

    // trackball
    var drag = false, px = 0, py = 0;
    canvas.addEventListener("pointerdown", function (e) {
      drag = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - px, dy = e.clientY - py; px = e.clientX; py = e.clientY;
      userR = mul(mul(rotY(dx * 0.01), rotX(dy * 0.01)), userR);
    });
    function end() { drag = false; }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);

    self.setSpin = function (on) { spinning = on; };
    self.spinAbout = null; // optional {u:[..], from, to, t0, dur}

    var last = 0;
    function frame(ts) {
      if (!self._visible) { self._raf = requestAnimationFrame(frame); return; }
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0; last = ts;
      if (spinning && !drag) spin += spinSpeed * dt;
      R = mul(rotY(spin), userR);
      // one-shot demo rotation about an arbitrary axis
      if (self.demo) {
        var d = self.demo, pr = Math.min(1, (ts - d.t0) / d.dur);
        var ang = d.total * ease(pr);
        R = mul(R, rotAxis(d.u, ang));
        if (pr >= 1) self.demo = null;
      }
      ctx.clearRect(0, 0, W, H);
      self.scene(self, ts / 1000);
      self._raf = requestAnimationFrame(frame);
    }
    function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
    self.demoSpin = function (u, turns, dur) {
      self.demo = { u: norm(u), total: turns * 2 * Math.PI, t0: performance.now(), dur: dur || 900 };
    };

    // visibility-gated RAF
    self._visible = true;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        self._visible = es[0].isIntersecting;
      }, { threshold: 0.05 });
      io.observe(host);
    }
    window.addEventListener("resize", resize);
    resize();
    self._raf = requestAnimationFrame(frame);
    return self;
  }

  // draw a rod through the origin along unit dir u, length ext each way
  function drawAxis(v, u, color, ext) {
    var ctx = v.ctx;
    var a = v.project(scale(u, ext)), b = v.project(scale(u, -ext));
    // split at origin for depth
    var o = v.project([0, 0, 0]);
    seg(ctx, o, a, color, v.depthAlpha((a.z) * 0.5), 2);
    seg(ctx, o, b, color, v.depthAlpha((b.z) * 0.5), 2);
    // pierce markers at unit sphere
    marker(v, scale(u, 1), color);
    marker(v, scale(u, -1), color);
  }
  function seg(ctx, a, b, color, alpha, w) {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w || 1.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function marker(v, p, color) {
    var s = v.project(p), ctx = v.ctx;
    var f = Math.max(0, Math.min(1, (s.z + 1.15) / 2.3));
    ctx.globalAlpha = 0.35 + 0.65 * f; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 2.6 + 2.4 * f, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function dot(ctx, x, y, r, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }

  /* ---- caption + controls scaffolding ----------------------------------- */
  function scaffold(host, capHTML) {
    var controls = el("div", "sf-controls");
    var cap = el("div", "sf-cap", capHTML || "");
    host.appendChild(controls);
    if (capHTML) host.appendChild(cap);
    return { controls: controls, cap: cap };
  }

  /* ======================================================================= *
   *  3D SOLID: T / O / I with axis families (+ optional capsid overlay)
   * ======================================================================= */
  function buildSolid(host, o) {
    var shape = o.shape || "ico";
    var show = { 2: true, 3: true, 4: true, 5: true };  // which folds are visible
    var showCapsid = false, showFaces = false;

    var v = Viewer3D(host, {
      height: o.height || 360,
      scene: function (vw) { renderSolid(vw, MODEL[shape], show, showFaces, showCapsid); }
    });

    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;

    // shape switch T/O/I
    if (o.switch) {
      ["tetra", "octa", "ico"].forEach(function (s) {
        var b = el("button", "sf-btn" + (s === shape ? " on" : ""), s === "tetra" ? "T" : s === "octa" ? "O" : "I");
        b.title = SHAPE_LABEL[s];
        b.onclick = function () {
          shape = s;
          [].forEach.call(C.querySelectorAll(".sf-shape"), function (x) { x.classList.remove("on"); });
          b.classList.add("on");
          rebuildFamilyChips(); updateOrder();
        };
        b.classList.add("sf-shape");
        C.appendChild(b);
      });
      C.appendChild(sep());
    }

    // family toggle chips (rebuilt per shape)
    var chipWrap = el("span");
    chipWrap.style.display = "inline-flex";
    chipWrap.style.gap = ".4rem";
    chipWrap.style.flexWrap = "wrap";
    C.appendChild(chipWrap);
    function rebuildFamilyChips() {
      chipWrap.innerHTML = "";
      var folds = MODEL[shape].folds;
      var seen = {};
      // order families high->low fold
      [5, 4, 3, 2].forEach(function (f) {
        var has = (folds.vertex === f || folds.face === f || folds.edge === f);
        if (!has || seen[f]) return; seen[f] = 1;
        show[f] = true;
        var label = "C" + f;
        var c = chip(label, FOLD_COLOR[f], true);
        c.onclick = function () { show[f] = !show[f]; c.classList.toggle("on", show[f]); updateOrder(); };
        chipWrap.appendChild(c);
      });
    }
    rebuildFamilyChips();

    C.appendChild(sep());
    // capsid toggle (icosahedral only, when enabled)
    if (o.capsid) {
      var cb = el("button", "sf-btn", "capsomers");
      cb.onclick = function () { showCapsid = !showCapsid; cb.classList.toggle("on", showCapsid); };
      C.appendChild(cb);
    }
    // faces toggle
    var fb = el("button", "sf-btn", "faces");
    fb.onclick = function () { showFaces = !showFaces; fb.classList.toggle("on", showFaces); };
    C.appendChild(fb);
    // spin toggle
    var spb = el("button", "sf-btn on", "spin");
    var spinOn = true;
    spb.onclick = function () { spinOn = !spinOn; v.setSpin(spinOn); spb.classList.toggle("on", spinOn); };
    C.appendChild(spb);

    C.appendChild(sep());
    var order = el("span", "sf-read", "");
    C.appendChild(order);
    function updateOrder() {
      var folds = MODEL[shape].folds, axes = MODEL[shape].axes;
      var parts = [], rot = 0;
      [5, 4, 3, 2].forEach(function (f) {
        var fam = axes.filter(function (a) { return a.fold === f; });
        if (!fam.length) return;
        if (show[f]) rot += fam.length * (f - 1);
        parts.push(fam.length + "×C" + f);
      });
      order.innerHTML = "order |G| = " + ORDER[shape] +
        "  ·  axes " + parts.join(" + ") +
        "  ·  shown: " + rot + "+1 rot.";
    }
    updateOrder();
    function sep() { var s = el("span"); s.style.cssText = "width:1px;height:1.1rem;background:" + PAL.border; return s; }
  }

  function renderSolid(v, M, show, showFaces, showCapsid) {
    var ctx = v.ctx;
    // faces (faint fill, back to front)
    if (showFaces) {
      var faces = M.F.map(function (f) {
        var ps = f.map(function (i) { return v.project(M.V[i]); });
        var z = (ps[0].z + ps[1].z + ps[2].z) / 3;
        return { ps: ps, z: z };
      }).sort(function (a, b) { return a.z - b.z; });
      faces.forEach(function (f) {
        ctx.globalAlpha = 0.10 + 0.16 * Math.max(0, (f.z + 1) / 2);
        ctx.fillStyle = "#8a8064";
        ctx.beginPath(); ctx.moveTo(f.ps[0].x, f.ps[0].y);
        ctx.lineTo(f.ps[1].x, f.ps[1].y); ctx.lineTo(f.ps[2].x, f.ps[2].y);
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      });
    }
    // edges with depth alpha
    M.E.forEach(function (e) {
      var a = v.project(M.V[e[0]]), b = v.project(M.V[e[1]]);
      seg(ctx, a, b, PAL.edge, v.depthAlpha((a.z + b.z) / 2), 1.3);
    });
    // axes
    M.axes.forEach(function (ax) {
      if (!show[ax.fold]) return;
      drawAxis(v, ax.p, ax.color, 1.18);
    });
    // capsomer overlay: the exact T=1 shell (12 pentamers, 0 hexamers)
    if (showCapsid) drawCapsomers(v, CAP1);
  }

  /* ---- 3D capsid: sweep the triangulation number T = h^2+hk+k^2 ---------- */
  function buildCapsid(host, o) {
    var h = 1, k = 1, caps = capsomerGeometry(h, k), spinOn = true;
    var v = Viewer3D(host, {
      height: o.height || 380,
      scene: function (vw) {
        MODEL.ico.E.forEach(function (e) {
          var a = vw.project(MODEL.ico.V[e[0]]), b = vw.project(MODEL.ico.V[e[1]]);
          seg(vw.ctx, a, b, PAL.faint, 0.2, 1);
        });
        drawCapsomers(vw, caps);
      }
    });
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls, vals = [];
    function rebuild() { if (h === 0 && k === 0) h = 1; caps = capsomerGeometry(h, k); refresh(); updateRead(); }
    function refresh() { vals.forEach(function (o) { o.val.textContent = " " + o.get() + " "; }); }
    C.appendChild(el("span", "sf-lab", "h"));
    C.appendChild(stepper(function () { return h; }, function (x) { h = clamp(x); rebuild(); }));
    C.appendChild(el("span", "sf-lab", "k"));
    C.appendChild(stepper(function () { return k; }, function (x) { k = clamp(x); rebuild(); }));
    C.appendChild(sepv());
    [[1, 0], [1, 1], [2, 0], [2, 1], [3, 1]].forEach(function (hk) {
      var Tn = hk[0] * hk[0] + hk[0] * hk[1] + hk[1] * hk[1];
      var b = el("button", "sf-btn", "T=" + Tn);
      b.onclick = function () { h = hk[0]; k = hk[1]; rebuild(); };
      C.appendChild(b);
    });
    var lb = el("button", "sf-btn", "flip hand");
    lb.onclick = function () { var t = h; h = k; k = t; rebuild(); };
    C.appendChild(lb);
    var spb = el("button", "sf-btn on", "spin");
    spb.onclick = function () { spinOn = !spinOn; v.setSpin(spinOn); spb.classList.toggle("on", spinOn); };
    C.appendChild(spb);
    var rd = el("span", "sf-read", "");
    C.appendChild(rd);
    function updateRead() {
      var Tn = h * h + h * k + k * k, chiral = (h !== k && h !== 0 && k !== 0);
      rd.innerHTML = "T = " + Tn + " · " + (60 * Tn) + " subunits · 12 pentamers + "
        + (10 * (Tn - 1)) + " hexamers = " + (12 + 10 * (Tn - 1)) + " capsomers"
        + (chiral ? " · chiral" : "");
    }
    updateRead();
    function clamp(x) { return Math.max(0, Math.min(5, x)); }
    function stepper(get, set) {
      var w = el("span"); w.style.cssText = "display:inline-flex;align-items:center;gap:.25rem";
      var minus = el("button", "sf-btn", "−"), val = el("span", "sf-num", " " + get() + " "), plus = el("button", "sf-btn", "+");
      minus.onclick = function () { set(get() - 1); }; plus.onclick = function () { set(get() + 1); };
      vals.push({ val: val, get: get });
      w.appendChild(minus); w.appendChild(val); w.appendChild(plus); return w;
    }
    function sepv() { var s = el("span"); s.style.cssText = "width:1px;height:1.1rem;background:" + PAL.border; return s; }
  }

  /* ======================================================================= *
   *  3D CYCLIC: Cn — one rotation axis
   * ======================================================================= */
  function subunitGlyph() {
    // a flat chiral "comma/pennant" in local (u=radial, w=tangential) coords
    return [[0.00, -0.10], [0.34, -0.10], [0.30, 0.04], [0.14, 0.02],
            [0.16, 0.20], [0.02, 0.14], [0.00, -0.02]];
  }
  function placeGlyph(v, center, uAxis, wAxis, s, fill) {
    var g = subunitGlyph(), ctx = v.ctx, pts = [], zsum = 0;
    for (var i = 0; i < g.length; i++) {
      var p3 = add(center, add(scale(uAxis, g[i][0] * s), scale(wAxis, g[i][1] * s)));
      var pr = v.project(p3); pts.push(pr); zsum += pr.z;
    }
    var f = Math.max(0, Math.min(1, (zsum / g.length + 1.1) / 2.2));
    ctx.globalAlpha = 0.35 + 0.65 * f; ctx.fillStyle = fill;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAL.subLine; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.4 + 0.6 * f; ctx.stroke();
    ctx.globalAlpha = 1;
    return zsum / g.length;
  }

  function buildCyclic(host, o) {
    var n = o.n || 5;
    var showAxis = true;
    var v = Viewer3D(host, {
      height: o.height || 300, spinSpeed: 0.1,
      scene: function (vw) { renderRing(vw, n, showAxis); }
    });
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;
    C.appendChild(el("span", "sf-lab", "n ="));
    var nread = el("span", "sf-num", " " + n);
    var rng = el("input"); rng.type = "range"; rng.min = 2; rng.max = 8; rng.value = n; rng.step = 1;
    rng.style.width = "120px";
    rng.oninput = function () { n = +rng.value; nread.textContent = " " + n; updateRead(); };
    C.appendChild(rng); C.appendChild(nread);
    var ab = el("button", "sf-btn", "apply rotation");
    ab.onclick = function () { v.demoSpin([0, 0, 1], 1 / n, 850); };
    C.appendChild(ab);
    var axb = el("button", "sf-btn on", "axis");
    axb.onclick = function () { showAxis = !showAxis; axb.classList.toggle("on", showAxis); };
    C.appendChild(axb);
    var rd = el("span", "sf-read", "");
    C.appendChild(rd);
    function updateRead() { rd.textContent = "C" + n + " · one axis · order " + n; }
    updateRead();
  }
  function renderRing(v, n, showAxis) {
    var ctx = v.ctx, R = 0.72;
    if (showAxis) drawAxis(v, [0, 0, 1], PAL.c5, 1.25);
    var items = [];
    for (var k = 0; k < n; k++) {
      var th = 2 * Math.PI * k / n;
      var c = [R * Math.cos(th), R * Math.sin(th), 0];
      var uAx = norm(c);                 // radial (in-plane, outward)
      var wAx = [0, 0, 1];               // glyph "up" along axis
      items.push({ c: c, u: uAx, w: wAx });
    }
    // sort by depth
    items.map(function (it) { it.z = v.project(it.c).z; return it; })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (it) { placeGlyph(v, it.c, it.u, it.w, 0.85, PAL.sub); });
  }

  /* ======================================================================= *
   *  3D DIHEDRAL: Dn — principal axis + n perpendicular 2-folds
   * ======================================================================= */
  function buildDihedral(host, o) {
    var n = o.n || 4;
    var showPrincipal = true, show2 = true;
    var v = Viewer3D(host, {
      height: o.height || 320, spinSpeed: 0.1,
      scene: function (vw) { renderDihedral(vw, n, showPrincipal, show2); }
    });
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;
    C.appendChild(el("span", "sf-lab", "n ="));
    var nread = el("span", "sf-num", " " + n);
    var rng = el("input"); rng.type = "range"; rng.min = 2; rng.max = 7; rng.value = n; rng.step = 1;
    rng.style.width = "110px";
    rng.oninput = function () { n = +rng.value; nread.textContent = " " + n; updateRead(); };
    C.appendChild(rng); C.appendChild(nread);
    var c1 = chip("Cn (principal)", PAL.c5, true);
    c1.onclick = function () { showPrincipal = !showPrincipal; c1.classList.toggle("on", showPrincipal); };
    C.appendChild(c1);
    var c2 = chip("n × C2", PAL.c2, true);
    c2.onclick = function () { show2 = !show2; c2.classList.toggle("on", show2); };
    C.appendChild(c2);
    var rd = el("span", "sf-read", "");
    C.appendChild(rd);
    function updateRead() { rd.textContent = "D" + n + " · order " + (2 * n); }
    updateRead();
  }
  function renderDihedral(v, n, showP, show2) {
    var R = 0.72, zTop = 0.34;
    if (showP) drawAxis(v, [0, 0, 1], PAL.c5, 1.28);
    if (show2) for (var m = 0; m < n; m++) {
      var a = Math.PI * m / n;
      drawAxis(v, [Math.cos(a), Math.sin(a), 0], PAL.c2, 1.12);
    }
    var items = [];
    for (var k = 0; k < n; k++) {
      var th = 2 * Math.PI * k / n;
      // top ring
      var ct = [R * Math.cos(th), R * Math.sin(th), zTop];
      items.push({ c: ct, u: norm([Math.cos(th), Math.sin(th), 0]), w: [0, 0, 1] });
      // bottom ring = C2 about x-axis applied: (x,y,z)->(x,-y,-z)
      var cb = [ct[0], -ct[1], -ct[2]];
      items.push({ c: cb, u: norm([Math.cos(th), -Math.sin(th), 0]), w: [0, 0, -1] });
    }
    items.map(function (it) { it.z = v.project(it.c).z; return it; })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (it) { placeGlyph(v, it.c, it.u, it.w, 0.7, PAL.sub); });
  }

  /* ======================================================================= *
   *  3D HELICAL: a screw axis (infinite group)
   * ======================================================================= */
  function buildHelical(host, o) {
    var run = { on: true, phase: 0, last: 0 };
    var v = Viewer3D(host, {
      height: o.height || 360, autoSpin: false, zoom: 1.0,
      scene: function (vw, t) { renderHelix(vw, t, run); }
    });
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;
    var b = el("button", "sf-btn on", "screw");
    b.onclick = function () { run.on = !run.on; b.classList.toggle("on", run.on); };
    C.appendChild(b);
    C.appendChild(el("span", "sf-read", "one step = rotate Δφ + rise Δz, repeated forever"));
  }
  function renderHelix(v, t, run) {
    if (run.on) {
      var dt = run.last ? Math.min(0.05, t - run.last) : 0; run.last = t;
      run.phase += dt * 0.6;
    } else { run.last = t; }
    var ctx = v.ctx, N = 26, R = 0.5, dPhi = 2.399, dZ = 0.115, zSpan = N * dZ;
    // axis
    drawAxis(v, [0, 0, 1], PAL.axis, 1.55);
    var items = [];
    for (var i = 0; i < N; i++) {
      var s = i + (run.phase % 1);       // continuous drift; fractional part animates
      var z = s * dZ - zSpan / 2;
      var ph = s * dPhi;
      var c = [R * Math.cos(ph), R * Math.sin(ph), z];
      items.push({ c: c, u: norm([Math.cos(ph), Math.sin(ph), 0]), w: [0, 0, 1],
        fade: i < 1 ? s % 1 : (i > N - 2 ? 1 - (s % 1) : 1) });
    }
    items.map(function (it) { it.z = v.project(it.c).z; return it; })
      .sort(function (a, b) { return a.z - b.z; })
      .forEach(function (it) {
        ctx.globalAlpha = it.fade;
        placeGlyph(v, it.c, it.u, it.w, 0.62, PAL.hex);
        ctx.globalAlpha = 1;
      });
  }

  /* ======================================================================= *
   *  2D SQUARE: an operation that leaves a shape unchanged
   * ======================================================================= */
  function build2D(host, height) {
    var stage = el("div", "sf-stage");
    var canvas = el("canvas");
    stage.appendChild(canvas); host.appendChild(stage);
    var ctx = canvas.getContext("2d");
    var W = 0, H = height, dpr = 1;
    function resize() {
      W = host.clientWidth || 600; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", function () { resize(); host.__draw && host.__draw(); });
    resize();
    return { canvas: canvas, ctx: ctx, w: function () { return W; }, h: function () { return H; } };
  }

  function buildSquare(host, o) {
    var g = build2D(host, o.height || 260);
    var ctx = g.ctx;
    var angle = 0, target = 0, anim = null;
    var CORNER = ["#c85a2b", "#0f8060", "#2f6db0", "#6b4fbb"];
    function draw() {
      var W = g.w(), H = g.h(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.3;
      ctx.clearRect(0, 0, W, H);
      // ghost of original
      drawSquare(cx, cy, R, 0, 0.12, true);
      drawSquare(cx, cy, R, angle, 1, false);
      // readout
      var norm = ((angle % 360) + 360) % 360;
      var snap = Math.min(norm % 90, 90 - (norm % 90));
      var same = snap < 1.2;
      ctx.font = "600 14px 'IBM Plex Mono',monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = same ? PAL.c3 : "#a05a2a";
      ctx.fillText(same ? "identical to the original ✓" : "rotated by " + Math.round(norm) + "° — you can tell it moved",
        cx, H - 16);
    }
    function drawSquare(cx, cy, R, deg, alpha, ghost) {
      var a = deg * Math.PI / 180;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ghost ? "#b7b0a4" : PAL.ink; ctx.lineWidth = ghost ? 1 : 1.6;
      ctx.fillStyle = ghost ? "transparent" : "#f4eee1";
      ctx.beginPath(); ctx.rect(-R, -R, 2 * R, 2 * R); if (!ghost) ctx.fill(); ctx.stroke();
      if (!ghost) {
        var cs = [[-R, -R], [R, -R], [R, R], [-R, R]];
        for (var i = 0; i < 4; i++) { dot(ctx, cs[i][0], cs[i][1], 6, CORNER[i]); }
      }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    function to(delta) {
      target = angle + delta; var t0 = performance.now(), a0 = angle, d = target - a0;
      cancelAnimationFrame(anim);
      (function step(ts) {
        var p = Math.min(1, (ts - t0) / 520), e = 1 - Math.pow(1 - p, 3);
        angle = a0 + d * e; draw();
        if (p < 1) anim = requestAnimationFrame(step);
      })(t0);
    }
    host.__draw = draw;
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;
    var b1 = el("button", "sf-btn", "rotate 90°"); b1.onclick = function () { to(90); }; C.appendChild(b1);
    var b2 = el("button", "sf-btn", "rotate 45°"); b2.onclick = function () { to(45); }; C.appendChild(b2);
    var b3 = el("button", "sf-btn", "reset"); b3.onclick = function () { angle = 0; target = 0; draw(); }; C.appendChild(b3);
    C.appendChild(el("span", "sf-read", "coloured corners reveal which operation happened"));
    // drag to rotate
    var drag = false, lastA = 0;
    g.canvas.style.cursor = "grab";
    g.canvas.addEventListener("pointerdown", function (e) {
      drag = true; lastA = ptAngle(e); g.canvas.setPointerCapture(e.pointerId);
    });
    g.canvas.addEventListener("pointermove", function (e) {
      if (!drag) return; var a = ptAngle(e); angle += (a - lastA) * 180 / Math.PI; lastA = a; draw();
    });
    g.canvas.addEventListener("pointerup", function () { drag = false; });
    function ptAngle(e) {
      var r = g.canvas.getBoundingClientRect();
      return Math.atan2(e.clientY - r.top - g.h() / 2, e.clientX - r.left - g.w() / 2);
    }
    draw();
  }

  /* ======================================================================= *
   *  2D COMPOSE: composing two rotations of a C5 pinwheel (group axioms)
   * ======================================================================= */
  function buildCompose(host, o) {
    var g = build2D(host, o.height || 300);
    var ctx = g.ctx, n = 5, gi = 1, hj = 2, resDeg = 0, anim = null;
    function pinwheel(cx, cy, R, offsetTurns, alpha, labelActive) {
      for (var k = 0; k < n; k++) {
        var th = 2 * Math.PI * (k / n) + offsetTurns * 2 * Math.PI / n - Math.PI / 2;
        var c = [cx + R * Math.cos(th), cy + R * Math.sin(th)];
        ctx.globalAlpha = alpha;
        // blade
        ctx.fillStyle = k === 0 ? PAL.c5 : "#d9cbb0";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + R * Math.cos(th - 0.32), cy + R * Math.sin(th - 0.32));
        ctx.lineTo(c[0], c[1]);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
        // index label
        ctx.fillStyle = "#3a352e"; ctx.font = "600 12px 'IBM Plex Mono',monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(String(k), cx + (R + 14) * Math.cos(th), cy + (R + 14) * Math.sin(th));
      }
    }
    function draw() {
      var W = g.w(), H = g.h(), cx = W / 2, cy = H / 2 - 6, R = Math.min(W, H) * 0.3;
      ctx.clearRect(0, 0, W, H);
      pinwheel(cx, cy, R, resDeg, 1, true);
      dot(ctx, cx, cy, 4, PAL.ink);
      var res = ((gi + hj) % n + n) % n;
      ctx.textAlign = "center"; ctx.font = "13px 'IBM Plex Serif',Georgia,serif"; ctx.fillStyle = "#4a453e";
      ctx.fillText("g = r" + sup(gi) + "  ∘  h = r" + sup(hj) + "   =   r" + sup(res)
        + "   (indices add mod " + n + ")", cx, H - 14);
    }
    function sup(k) { return "^" + k; }
    function apply() {
      var res = ((gi + hj) % n + n) % n, t0 = performance.now(), from = resDeg;
      cancelAnimationFrame(anim);
      (function step(ts) {
        var p = Math.min(1, (ts - t0) / 700), e = 1 - Math.pow(1 - p, 3);
        resDeg = from + (res - from) * e; draw();
        if (p < 1) anim = requestAnimationFrame(step); else resDeg = res;
      })(t0);
    }
    host.__draw = draw;
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls;
    C.appendChild(el("span", "sf-lab", "g = r"));
    var gs = stepper(function () { return gi; }, function (x) { gi = (x % n + n) % n; draw(); });
    C.appendChild(gs);
    C.appendChild(el("span", "sf-lab", "h = r"));
    var hs = stepper(function () { return hj; }, function (x) { hj = (x % n + n) % n; draw(); });
    C.appendChild(hs);
    var ab = el("button", "sf-btn", "apply h then g"); ab.onclick = apply; C.appendChild(ab);
    var rb = el("button", "sf-btn", "reset"); rb.onclick = function () { resDeg = 0; draw(); }; C.appendChild(rb);
    function stepper(get, set) {
      var w = el("span"); w.style.cssText = "display:inline-flex;align-items:center;gap:.25rem";
      var minus = el("button", "sf-btn", "−"), val = el("span", "sf-num", " " + get() + " "), plus = el("button", "sf-btn", "+");
      minus.onclick = function () { set(get() - 1); val.textContent = " " + get() + " "; };
      plus.onclick = function () { set(get() + 1); val.textContent = " " + get() + " "; };
      w.appendChild(minus); w.appendChild(val); w.appendChild(plus); return w;
    }
    draw();
  }

  /* ======================================================================= *
   *  2D CASPAR–KLUG: the (h,k) lattice and the T-number
   * ======================================================================= */
  function buildCK(host, o) {
    var g = build2D(host, o.height || 400);
    var ctx = g.ctx, h = 1, k = 1, laevo = false;
    var a1 = [1, 0], a2 = [0.5, Math.sqrt(3) / 2];
    function lp(i, j) { return [i * a1[0] + j * a2[0], i * a1[1] + j * a2[1]]; }
    function T() { return h * h + h * k + k * k; }
    function draw() {
      var W = g.w(), H = g.h(), U = Math.min(W, H) * 0.13;
      ctx.clearRect(0, 0, W, H);
      // origin lower-left-ish
      var ox = W * 0.28, oy = H * 0.72;
      function px(p) { return [ox + p[0] * U, oy - p[1] * U]; }
      // draw triangular lattice
      ctx.strokeStyle = "#e3ddd0"; ctx.lineWidth = 1;
      for (var i = -2; i <= 7; i++) for (var j = -2; j <= 7; j++) {
        var A = px(lp(i, j));
        [[1, 0], [0, 1], [1, -1]].forEach(function (d) {
          var B = px(lp(i + d[0], j + d[1]));
          ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke();
        });
      }
      // the CK triangle: origin, (h,k), and its 60° rotation
      var hh = h, kk = k;
      if (laevo) { hh = k; kk = h; }
      var P0 = [0, 0], P1 = lp(hh, kk);
      // rotate P1 by +60°
      var c60 = Math.cos(Math.PI / 3), s60 = Math.sin(Math.PI / 3);
      var P2 = [P1[0] * c60 - P1[1] * s60, P1[0] * s60 + P1[1] * c60];
      var t = [px(P0), px(P1), px(P2)];
      ctx.fillStyle = "rgba(200,90,43,0.12)"; ctx.strokeStyle = PAL.c5; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(t[0][0], t[0][1]);
      ctx.lineTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // pentamer at origin + the (h,k) vector
      ctx.strokeStyle = PAL.c5; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(px(P0)[0], px(P0)[1]); ctx.lineTo(px(P1)[0], px(P1)[1]); ctx.stroke();
      // lattice points: pentamers at triangle corners (5-folds), else hexamers
      var corners = [P0.join(","), lp(hh, kk).join(",")];
      for (i = -1; i <= 6; i++) for (j = -1; j <= 6; j++) {
        var p = lp(i, j), sp = px(p);
        var isCorner = (i === 0 && j === 0) || (i === hh && j === kk);
        dot(ctx, sp[0], sp[1], isCorner ? 6 : 3.4, isCorner ? PAL.pent : PAL.hex,
          isCorner ? 1 : 0.55);
      }
      // labels
      ctx.fillStyle = "#3a352e"; ctx.font = "600 12px 'IBM Plex Mono',monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      var mid = px([P1[0] * 0.5, P1[1] * 0.5]);
      ctx.fillText("(h,k) = (" + h + "," + k + ")", mid[0] + 8, mid[1] - 6);
    }
    host.__draw = draw;
    var sc = scaffold(host, o.caption || "");
    var C = sc.controls, vals = [];
    function refresh() { vals.forEach(function (o) { o.val.textContent = " " + o.get() + " "; }); }
    C.appendChild(el("span", "sf-lab", "h"));
    C.appendChild(stepper(function () { return h; }, function (x) { h = clamp(x); draw(); updateRead(); }));
    C.appendChild(el("span", "sf-lab", "k"));
    C.appendChild(stepper(function () { return k; }, function (x) { k = clamp(x); draw(); updateRead(); }));
    C.appendChild(sepv());
    [[1, 0], [1, 1], [2, 0], [2, 1], [3, 1]].forEach(function (hk) {
      var Tn = hk[0] * hk[0] + hk[0] * hk[1] + hk[1] * hk[1];
      var b = el("button", "sf-btn", "T=" + Tn);
      b.onclick = function () { h = hk[0]; k = hk[1]; draw(); updateRead(); refresh(); };
      C.appendChild(b);
    });
    var lb = el("button", "sf-btn", "flip hand");
    lb.onclick = function () { laevo = !laevo; lb.classList.toggle("on", laevo); draw(); };
    C.appendChild(lb);
    var rd = el("span", "sf-read", "");
    C.appendChild(rd);
    function updateRead() {
      var Tn = T();
      var chiral = (h !== k && h !== 0 && k !== 0);
      rd.innerHTML = "T = " + Tn + "  ·  " + (60 * Tn) + " subunits  ·  12 pentamers + "
        + (10 * (Tn - 1)) + " hexamers  ·  " + (12 + 10 * (Tn - 1)) + " capsomers"
        + (chiral ? "  ·  chiral (laevo/dextro)" : "");
    }
    updateRead(); draw();
    function clamp(x) { return Math.max(0, Math.min(5, x)); }
    function stepper(get, set) {
      var w = el("span"); w.style.cssText = "display:inline-flex;align-items:center;gap:.25rem";
      var minus = el("button", "sf-btn", "−"), val = el("span", "sf-num", " " + get() + " "), plus = el("button", "sf-btn", "+");
      minus.onclick = function () { set(get() - 1); val.textContent = " " + get() + " "; };
      plus.onclick = function () { set(get() + 1); val.textContent = " " + get() + " "; };
      vals.push({ val: val, get: get });
      w.appendChild(minus); w.appendChild(val); w.appendChild(plus); return w;
    }
    function sepv() { var s = el("span"); s.style.cssText = "width:1px;height:1.1rem;background:" + PAL.border; return s; }
  }

  /* ---- dispatch ---------------------------------------------------------- */
  var BUILDERS = {
    square: buildSquare, compose: buildCompose, cyclic: buildCyclic,
    dihedral: buildDihedral, solid: buildSolid, helical: buildHelical,
    ck: buildCK, capsid: buildCapsid
  };
  function init() {
    var nodes = document.querySelectorAll("[data-sym]");
    [].forEach.call(nodes, function (host) {
      if (host.__symDone) return; host.__symDone = true;
      var kind = host.getAttribute("data-sym");
      var b = BUILDERS[kind];
      if (!b) return;
      host.classList.add("symfig");
      var opts = {
        n: +host.getAttribute("data-n") || undefined,
        shape: host.getAttribute("data-shape") || undefined,
        switch: host.hasAttribute("data-switch"),
        capsid: host.hasAttribute("data-capsid"),
        height: +host.getAttribute("data-height") || undefined,
        caption: host.getAttribute("data-cap") || ""
      };
      try { b(host, opts); } catch (e) { console.error("[symmetry] " + kind, e); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
