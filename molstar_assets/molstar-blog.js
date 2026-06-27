/*
 * molstar-blog.js — a thin, reusable layer over the official Mol* viewer build
 * for embedding 3D structure viewers in Quarto blog posts.
 *
 * Load order on a page:
 *   <script src="/molstar_assets/molstar.js"></script>        (the official build; defines window.molstar)
 *   <script src="/molstar_assets/molstar-blog.js"></script>   (this file; defines window.MolstarBlog)
 *   <script src="/molstar_assets/addons/*.js"></script>       (optional custom elements built on top)
 *
 * The official viewer build exposes the granular Mol* API under `molstar.lib.*`;
 * this file normalizes the pieces an add-on author needs (StructureProperties,
 * StructureElement, Vec3, ...) onto a clean `MolstarBlog` surface, and ships the
 * generic plumbing that is annoying to rewrite per post — chiefly a clean embed
 * and the "right-click a residue -> here is its identity" seam (onResidueContext).
 */
(function (global) {
  'use strict';

  function molstar() {
    if (!global.molstar) {
      throw new Error('[MolstarBlog] window.molstar not found — load molstar.js before molstar-blog.js');
    }
    return global.molstar;
  }

  // Mol* primitives live under molstar.lib.* in the official build; resolve lazily
  // so this file can be parsed before molstar.js has finished (it never is in
  // practice, but the indirection keeps things order-independent).
  function lib()  { return molstar().lib; }
  function SP()   { return lib().structure.StructureProperties; }
  function SE()   { return lib().structure.StructureElement; }
  function Vec3() { return lib().math.LinearAlgebra.Vec3; }
  function Vec4() { return lib().math.LinearAlgebra.Vec4; }

  // Semantic palette aligned with the blog's hues (hex numbers double as Mol* Color).
  var palette = {
    blue:   0x2563eb,
    green:  0x059669,
    grey:   0x6b7280,
    orange: 0xe07850,
    violet: 0x8b5cf6,
    teal:   0x0ea5a4
  };

  // Illustrative rendering: black outline + ambient occlusion, no shadows.
  // Ported from fend_tubulinxyz (Color(0x000000) is just the number 0 at runtime).
  var STYLIZED_POSTPROCESSING = {
    outline: { name: 'on', params: { scale: 0.5, color: 0x000000, threshold: 0.33, includeTransparent: true } },
    occlusion: { name: 'on', params: {
      multiScale: { name: 'off', params: {} }, radius: 5, bias: 0.8,
      blurKernelSize: 15, blurDepthBias: 0.5, samples: 32, resolutionScale: 1, color: 0x000000
    } },
    shadow: { name: 'off', params: {} }
  };

  // Strip the Mol* UI down to a bare viewport — these are Viewer.create() options.
  var CLEAN_LAYOUT = {
    layoutIsExpanded: false,
    layoutShowControls: false,
    layoutShowRemoteState: false,
    layoutShowSequence: false,
    layoutShowLog: false,
    layoutShowLeftPanel: false,
    viewportShowControls: false,
    viewportShowExpand: false,
    viewportShowSelectionMode: false,
    viewportShowAnimation: false,
    viewportShowTrajectoryControls: false,
    viewportShowSettings: false,
    viewportShowReset: false,
    viewportShowScreenshotControls: false,
    viewportShowToggleFullscreen: false
  };

  /**
   * Create a clean embedded viewer in `selector` and (optionally) load a structure.
   *   opts.url        structure URL (e.g. https://files.rcsb.org/download/1EJG.cif)
   *   opts.format     'mmcif' (default) | 'pdb' | ...
   *   opts.isBinary   true for .bcif
   *   opts.background Mol* Color / hex number for the canvas (default white)
   *   opts.viewer     extra Viewer.create() options, merged over the clean defaults
   * Resolves to { viewer, plugin, container }.
   */
  async function create(selector, opts) {
    opts = opts || {};
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) throw new Error('[MolstarBlog] container not found: ' + selector);

    var viewerOpts = Object.assign({}, CLEAN_LAYOUT, opts.viewer || {});
    var viewer = await molstar().Viewer.create(el, viewerOpts);
    var plugin = viewer.plugin;

    // Background defaults to the page's own colour so the viewer dissolves into
    // the post; illustrative styling (flat shading + outline + AO) unless opted out.
    var bg = (opts.background == null) ? pageBackground(el) : opts.background;
    var illustrative = opts.style !== 'plain';
    if (plugin.canvas3d) {
      var props = { renderer: { backgroundColor: bg, pickingAlphaThreshold: 0.1 } };
      if (illustrative) props.postprocessing = STYLIZED_POSTPROCESSING;
      plugin.canvas3d.setProps(props);
    }

    if (opts.url) {
      await viewer.loadStructureFromUrl(opts.url, opts.format || 'mmcif', !!opts.isBinary);
      if (illustrative) applyIllustrative(plugin);
      frameStructure(plugin); // frame what we just loaded
    }

    // Keep the canvas sized to its container (tabs, accordions, responsive layouts),
    // and re-frame the first time it gains real size — handles a viewer that
    // initialized while hidden or zero-width (e.g. below the fold). The reframe
    // fires only on the first 0 -> sized transition, so it never disrupts a user
    // who has already rotated/zoomed.
    observeResize(el, plugin);

    return { viewer: viewer, plugin: plugin, container: el };
  }

  function frameStructure(plugin) {
    function reset() {
      // requestCameraReset() frames the scene bounding sphere; managers.camera.reset()
      // only restores a default camera and does NOT fit the structure.
      try {
        if (plugin.canvas3d) plugin.canvas3d.requestCameraReset();
        else plugin.managers.camera.reset();
      } catch (e) {}
    }
    reset();
    // Representation geometry can still be building when the load promise resolves,
    // so the scene bounds aren't final yet and the reset above frames an empty
    // scene. Reset again once the first frame with the new geometry has drawn.
    try {
      if (plugin.canvas3d && plugin.canvas3d.didDraw) {
        var sub = plugin.canvas3d.didDraw.subscribe(function () { sub.unsubscribe(); reset(); });
      }
    } catch (e) {}
  }

  function observeResize(el, plugin) {
    if (typeof ResizeObserver === 'undefined') return;
    var hadSize = el.clientWidth > 1 && el.clientHeight > 1;
    var ro = new ResizeObserver(function () {
      if (!plugin.canvas3d) return;
      try { plugin.handleResize ? plugin.handleResize() : plugin.canvas3d.handleResize(); } catch (e) {}
      var nowSize = el.clientWidth > 1 && el.clientHeight > 1;
      if (!hadSize && nowSize) { hadSize = true; frameStructure(plugin); }
    });
    ro.observe(el);
  }

  function applyIllustrative(plugin) {
    // Flat, "molecular illustration" shading (no specular highlights).
    try {
      var cm = plugin.managers.structure.component;
      cm.setOptions(Object.assign({}, cm.state.options, { ignoreLight: true }));
    } catch (e) {}
  }

  function cssColorToNumber(str) {
    if (!str) return null;
    var m = str.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (s) { return parseFloat(s); });
    if (p.length >= 4 && p[3] === 0) return null; // transparent: keep walking up
    return (Math.round(p[0]) << 16) | (Math.round(p[1]) << 8) | Math.round(p[2]);
  }

  // Walk up from the viewer container to the first opaque background colour, so the
  // canvas can paint the same colour as the surrounding page.
  function pageBackground(el) {
    try {
      var node = el;
      while (node && node !== document.documentElement) {
        var n = cssColorToNumber(getComputedStyle(node).backgroundColor);
        if (n != null) return n;
        node = node.parentElement;
      }
      var b = cssColorToNumber(getComputedStyle(document.body).backgroundColor);
      if (b != null) return b;
    } catch (e) {}
    return 0xfafaf7;
  }

  /**
   * Resolve a Mol* interaction loci to a plain residue record:
   *   { chainId, entityId, authSeqId, compId, altId, occupancy, bFactor, x, y, z,
   *     alts: [{ altId, occupancy }], loci }
   * `alts` lists the distinct alternate-location letters across the whole residue
   * with a representative occupancy — the bit the altloc discussion cares about.
   * Returns null for empty / non-structure loci.
   */
  function residueFromLoci(loci) {
    var _SE = SE(), _SP = SP();
    if (!_SE.Loci.is(loci) || _SE.Loci.isEmpty(loci)) return null;

    var rec = null;
    _SE.Loci.forEachLocation(loci, function (loc) {
      if (rec) return; // representative atom = first location
      rec = {
        chainId:   _SP.chain.auth_asym_id(loc),
        entityId:  _SP.chain.label_entity_id(loc),
        authSeqId: _SP.residue.auth_seq_id(loc),
        compId:    _SP.atom.label_comp_id(loc),
        altId:     _SP.atom.label_alt_id(loc),
        occupancy: _SP.atom.occupancy(loc),
        bFactor:   _SP.atom.B_iso_or_equiv(loc),
        x: _SP.atom.x(loc), y: _SP.atom.y(loc), z: _SP.atom.z(loc),
        alts: [],
        loci: loci
      };
    });
    if (!rec) return null;

    try {
      var whole = _SE.Loci.extendToWholeResidues(loci);
      var seen = Object.create(null);
      _SE.Loci.forEachLocation(whole, function (loc) {
        var a = _SP.atom.label_alt_id(loc);
        if (!a) return;                 // '' = atom has no alternate
        if (seen[a] != null) return;    // first occupancy seen per letter is representative
        seen[a] = _SP.atom.occupancy(loc);
      });
      rec.alts = Object.keys(seen).sort().map(function (a) {
        return { altId: a, occupancy: seen[a] };
      });
      rec.loci = whole;
    } catch (e) { /* keep the single-atom loci on any failure */ }

    return rec;
  }

  /**
   * Wire "right-click a residue" -> handler(residue, { clientX, clientY }).
   * Tracks the hovered residue and fires only on a right-click *release* that
   * moved < 5px, so right-drag camera moves never spawn anything. The native
   * context menu is suppressed over the canvas. Returns an unsubscribe function.
   *   opts.container  DOM element to listen on (default: the Mol* canvas's parent)
   */
  function onResidueContext(plugin, handler, opts) {
    opts = opts || {};
    var hovered = null;

    var hoverSub = plugin.behaviors.interaction.hover.subscribe(function (e) {
      var loci = e && e.current && e.current.loci;
      hovered = loci ? residueFromLoci(loci) : null;
    });

    var canvas = plugin.canvas3d && plugin.canvas3d.webgl && plugin.canvas3d.webgl.gl.canvas;
    var container = opts.container || (canvas && canvas.parentElement) || canvas || document;

    var downPos = null;
    function onDown(e) { if (e.button === 2) downPos = { x: e.clientX, y: e.clientY }; }
    function onUp(e) {
      if (e.button !== 2) return;
      var d = downPos; downPos = null;
      if (!d) return;
      var dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (dx * dx + dy * dy > 25) return; // moved > 5px -> camera drag, not a click
      if (!hovered) return;
      handler(hovered, { clientX: e.clientX, clientY: e.clientY });
    }
    function onMenu(e) { e.preventDefault(); }

    container.addEventListener('mousedown', onDown);
    container.addEventListener('mouseup', onUp);
    container.addEventListener('contextmenu', onMenu);

    return function unsubscribe() {
      hoverSub.unsubscribe();
      container.removeEventListener('mousedown', onDown);
      container.removeEventListener('mouseup', onUp);
      container.removeEventListener('contextmenu', onMenu);
    };
  }

  // --- highlight / focus helpers (operate on a loci, e.g. residue.loci) -------
  function highlightLoci(plugin, loci) {
    if (!loci || SE().Loci.isEmpty(loci)) {
      plugin.managers.interactivity.lociHighlights.clearHighlights();
    } else {
      plugin.managers.interactivity.lociHighlights.highlight({ loci: loci }, false);
    }
  }
  function clearHighlight(plugin) {
    plugin.managers.interactivity.lociHighlights.clearHighlights();
  }
  function focusLoci(plugin, loci, durationMs) {
    if (!loci || SE().Loci.isEmpty(loci)) return;
    plugin.managers.camera.focusLoci(loci, { durationMs: durationMs == null ? 250 : durationMs });
  }

  // --- 3D -> page-pixel projection (for cards that stay glued to a residue) ----
  function projectToScreen(plugin, xyz) {
    var canvas3d = plugin.canvas3d;
    if (!canvas3d) return null;
    var camera = canvas3d.camera, viewport = camera.viewport;
    var out = Vec4().create(0, 0, 0, 0);
    camera.project(out, Vec3().create(xyz[0], xyz[1], xyz[2]));
    var canvasEl = canvas3d.webgl.gl.canvas;
    if (!canvasEl.getBoundingClientRect) return null;
    var rect = canvasEl.getBoundingClientRect();
    var scale = viewport.width / rect.width; // project() yields device px, Y up
    return {
      x: out[0] / scale + rect.left + window.scrollX,
      y: (viewport.height - out[1]) / scale + rect.top + window.scrollY
    };
  }
  function onDidDraw(plugin, cb) {
    var canvas3d = plugin.canvas3d;
    if (!canvas3d) return function () {};
    var sub = canvas3d.didDraw.subscribe(cb);
    return function () { sub.unsubscribe(); };
  }

  global.MolstarBlog = {
    version: '0.1.0',
    create: create,
    onResidueContext: onResidueContext,
    residueFromLoci: residueFromLoci,
    highlightLoci: highlightLoci,
    clearHighlight: clearHighlight,
    focusLoci: focusLoci,
    projectToScreen: projectToScreen,
    onDidDraw: onDidDraw,
    palette: palette,
    // raw primitives for add-on authors
    get SP()   { return SP(); },
    get SE()   { return SE(); },
    get Vec3() { return Vec3(); },
    get Vec4() { return Vec4(); },
    get molstar() { return molstar(); }
  };
})(window);
