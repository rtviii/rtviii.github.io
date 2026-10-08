/* ============================================================================
 * capsids.js — lazy Mol* viewers for "Biological symmetries".
 *
 * Each container:
 *   <div class="msb-embed" data-msb-pdb="1lp3" data-msb-mode="assembly">
 *     <div class="msb-viewer"></div>
 *     <p class="msb-viewer-caption">...</p>
 *   </div>
 *
 *   data-msb-mode="assembly"   biological assembly via RCSB ModelServer (bcif)
 *   data-msb-mode="deposited"  the deposited coordinates via files.rcsb.org (cif)
 *   data-msb-color="off"       keep Mol*'s default colouring (else colour by copy)
 *
 * The heavy Mol* bundle (~4.8 MB) is injected only when the first viewer nears
 * the viewport, and each structure downloads only when its own card does. So a
 * reader who never scrolls to section 10 pays nothing.
 * ========================================================================== */
(function () {
  "use strict";
  if (window.__capsidsInit) return;
  window.__capsidsInit = true;

  var CSS =
    ".msb-embed{position:relative}" +
    ".msb-embed.msb-loading .msb-viewer::after{content:'loading structure…';position:absolute;" +
      "inset:0;display:flex;align-items:center;justify-content:center;color:#9aa0a6;" +
      "font:13px/1 'IBM Plex Sans',system-ui,sans-serif;pointer-events:none}" +
    ".msb-fail{display:flex;align-items:center;justify-content:center;height:100%;" +
      "color:#b4552e;font:13px 'IBM Plex Sans',system-ui,sans-serif}";
  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  function loadScript(src, cb) {
    var s = document.createElement("script");
    s.src = src; s.onload = cb;
    s.onerror = function () { console.error("[capsids] failed to load", src); };
    document.head.appendChild(s);
  }
  var molstarReady = false, waiters = [];
  function ensureMolstar(cb) {
    if (window.MolstarBlog) return cb();
    waiters.push(cb);
    if (molstarReady) return;
    molstarReady = true;
    ["/molstar_assets/molstar.css", "/molstar_assets/molstar-blog.css"].forEach(function (href) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l);
    });
    loadScript("/molstar_assets/molstar.js", function () {
      loadScript("/molstar_assets/molstar-blog.js", function () {
        var t = setInterval(function () {
          if (window.MolstarBlog) { clearInterval(t); waiters.splice(0).forEach(function (f) { f(); }); }
        }, 40);
      });
    });
  }

  function specFor(el) {
    var pdb = (el.getAttribute("data-msb-pdb") || "").toLowerCase();
    if (el.getAttribute("data-msb-mode") === "deposited")
      return { url: "https://files.rcsb.org/download/" + pdb.toUpperCase() + ".cif", isBinary: false };
    return { url: "https://models.rcsb.org/v1/" + pdb + "/assembly?name=1&encoding=bcif", isBinary: true };
  }

  // Colour each symmetry copy distinctly so the individual subunits / capsomers read.
  function colourByCopies(plugin) {
    try {
      var structs = (plugin.managers.structure.hierarchy.current.structures) || [];
      var comps = [];
      structs.forEach(function (s) { comps = comps.concat(s.components || []); });
      if (comps.length)
        Promise.resolve(plugin.managers.structure.component.updateRepresentationsTheme(comps, { color: "unit-index" }))
          .catch(function () {});
    } catch (e) { /* leave the default colouring */ }
  }

  function init(el) {
    if (el.__done) return;
    el.__done = true;
    var target = el.querySelector(".msb-viewer");
    var spec = specFor(el);
    el.classList.add("msb-loading");
    ensureMolstar(function () {
      MolstarBlog.create(target, { url: spec.url, isBinary: spec.isBinary })
        .then(function (v) {
          el.classList.remove("msb-loading");
          if (el.getAttribute("data-msb-color") !== "off") colourByCopies(v.plugin);
        })
        .catch(function (err) {
          console.error("[capsids]", el.getAttribute("data-msb-pdb"), err);
          el.classList.remove("msb-loading");
          target.innerHTML = '<div class="msb-fail">could not load ' +
            (el.getAttribute("data-msb-pdb") || "structure") + '</div>';
        });
    });
  }

  function boot() {
    var els = [].slice.call(document.querySelectorAll(".msb-embed[data-msb-pdb]"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) { els.forEach(init); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); init(e.target); } });
    }, { rootMargin: "400px" });
    els.forEach(function (el) { io.observe(el); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
