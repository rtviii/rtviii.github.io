# Mol* in the blog — a reusable 3D-structure library

This directory holds a small, reusable layer over [Mol*](https://molstar.org) for
embedding interactive 3D molecular structure viewers in the Quarto blog posts,
plus a couple of add-ons built on top of it. It is deliberately a thin, plain-JS
layer — there is no Node/build toolchain in this repo, and adding one is not
wanted (see the root `CLAUDE.md`). This document explains what is here, why it is
shaped this way, how to use it, the Mol* mechanics that were non-obvious, and
what is still to do.

The first place this is used is `posts/mmcif-primer/index.qmd` (Part 2, the
altloc/occupancy section), which loads crambin (PDB 1EJG) and shows the
`atom_site` table side-by-side with the structure.

## Goal and the packaging decision

The aim is a minimal core that is reusable across posts with little ceremony
(color presets, highlight/focus helpers, a clean embed function), plus a clear
seam for layering post-specific custom UI on top — the motivating example being a
right-click "residue context card" and, later, a Compiler-Explorer-style link
between the mmCIF file text and the 3D view.

The chosen approach is: vendor the official prebuilt Mol* bundle and write a
hand-authored plain-JS layer against the `window.molstar` global it exposes. The
alternative — owning a custom esbuild bundle (the old `index.js` here was one) —
was rejected because it means maintaining a Node build, and we verified the
official build does not meaningfully constrain control:

- `molstar.Viewer.create(el, opts)` gives a clean embeddable viewer; `opts` can
  strip all chrome down to a bare canvas.
- `molstar.lib.plugin.*` exposes `PluginContext`, `DefaultPluginSpec`,
  `PluginConfig`, `PluginBehavior`, `StateTransforms` — full control of spec,
  settings, and behaviors at runtime.
- `molstar.lib.structure.*` re-exports the whole `mol-model/structure` barrel, so
  `StructureProperties`, `StructureElement`, `Queries`, `StructureSelection`,
  `StructureQuery`, `QueryContext` are all reachable.
- `molstar.lib.math.LinearAlgebra.*` gives `Vec3`/`Vec4`.

What is NOT on the official global (and the workarounds we use): `MolScriptBuilder`
(use `Queries` instead), `Color` (hex numbers are valid `Color` at runtime),
`OrderedSet` (build loci via `Queries`, not by hand), `createPluginUI` (use
`Viewer.create` or `lib.plugin.PluginContext`), and `LabelRepresentation` from
`mol-repr` (we draw labels as HTML chips instead).

The vendored bundle is Mol* 5.6.0, copied verbatim from
`fend_tubulinxyz/node_modules/molstar/build/viewer/`. The styling and several
patterns (residue resolution, illustrative lighting, labels) were ported from the
`fend_tubulinxyz` project, dropping its React/Redux shell.

## Files

| File | What it is |
|------|------------|
| `molstar.js`, `molstar.css` | Vendored official Mol* 5.6.0 viewer build. Defines `window.molstar`. ~4.8 MB. Do not edit. |
| `molstar-blog.js` | The core. Defines `window.MolstarBlog`. Hand-written plain JS over `window.molstar`. |
| `molstar-blog.css` | Styles for the viewer container, the residue card, and the explorer layout. |
| `addons/residue-card.js` | Add-on: right-click a residue → a draggable DOM card with its altlocs/occupancy/B-factor. Defines `window.ResidueCard`. |
| `addons/mmcif-explorer.js` | Add-on: hover an `atom_site` row → highlight the chain/residue/atom in 3D with a label. Defines `window.MmcifExplorer`. |
| `index.js` | Dead. The old custom esbuild bundle (`initViewer`/`loadStructure`), superseded by the above. Safe to `git rm`. |

For these to ship, `molstar_assets/` is listed under `project: resources:` in
`_quarto.yml` (otherwise Quarto does not copy it into `_site/`).

## How a post embeds a viewer

Mol* is large (~4.8 MB), so it is loaded per-post, not in the global header. A
post embeds a viewer with a raw HTML block. Two Quarto/Pandoc constraints matter:

- Do not wrap it in a ` ```{=html} ` fenced block inside a `:::` fenced div —
  Quarto silently drops the whole thing. Write a plain inline `<div>…</div>`.
- Keep no blank lines inside that `<div>` (a blank line ends the raw HTML block
  and the rest gets parsed as Markdown).

The pattern (this is roughly what `posts/mmcif-primer/index.qmd` Part 2 contains):

```html
<div class="msb-embed">
<link rel="stylesheet" href="/molstar_assets/molstar.css">
<link rel="stylesheet" href="/molstar_assets/molstar-blog.css">
<div class="msb-split">
<div id="cif-x" class="msb-cif"></div>
<div class="msb-viewer-wrap"><div id="mv-x" class="msb-viewer"></div></div>
</div>
<script defer src="/molstar_assets/molstar.js"></script>
<script defer src="/molstar_assets/molstar-blog.js"></script>
<script defer src="/molstar_assets/addons/residue-card.js"></script>
<script defer src="/molstar_assets/addons/mmcif-explorer.js"></script>
<script>
(function () {
  function boot() {
    if (!window.MolstarBlog || !window.ResidueCard || !window.MmcifExplorer) { setTimeout(boot, 30); return; }
    MolstarBlog.create('#mv-x', { url: 'https://files.rcsb.org/download/1EJG.cif' })
      .then(function (v) {
        ResidueCard.attach(v.plugin, { single: true });
        MmcifExplorer.attach(v.plugin, '#cif-x');
      })
      .catch(function (e) { console.error(e); });
  }
  boot();
})();
</script>
</div>
```

The scripts are `defer`red so the 4.8 MB bundle does not block page render; the
inline boot polls until the globals exist. A viewer that does not need the
explorer just drops the `msb-split`/`msb-cif` wrappers and uses a bare
`<div id="…" class="msb-viewer">`.

## The core: `window.MolstarBlog`

`create(selector, opts)` → `Promise<{ viewer, plugin, container }>`. Builds a
chrome-less `molstar.Viewer` in `selector`, applies illustrative styling and a
page-matched background, loads a structure, and frames it. Options:

- `url`, `format` (default `'mmcif'`), `isBinary` (true for `.bcif`).
- `background` — a hex number; defaults to the page's own background color
  (resolved by `pageBackground()`, which walks up the DOM to the first opaque
  CSS background; the blog body is `#fafaf7`).
- `style` — `'plain'` disables the illustrative postprocessing/flat shading.
- `viewer` — extra `Viewer.create` options merged over the clean defaults.

Other functions:

- `onResidueContext(plugin, handler, opts?)` → unsubscribe. The reusable
  right-click seam. Tracks the hovered residue and calls `handler(residue, {clientX, clientY})`
  on a right-click release that moved < 5 px (so right-drag camera moves are
  ignored); suppresses the native context menu. `residue` is the record from
  `residueFromLoci`.
- `residueFromLoci(loci)` → a plain record `{ chainId, entityId, authSeqId, compId,
  altId, occupancy, bFactor, x, y, z, alts: [{altId, occupancy}], loci }`. `alts`
  lists the residue's distinct altloc letters (it extends the loci to the whole
  residue). Returns `null` for empty/non-structure loci.
- `highlightLoci(plugin, loci)`, `clearHighlight(plugin)`, `focusLoci(plugin, loci, durationMs?)`.
- `projectToScreen(plugin, [x,y,z])` → `{x, y}` in page coordinates (includes
  scroll offset; subtract `window.scrollX/Y` for `position: fixed`).
- `onDidDraw(plugin, cb)` → unsubscribe; fires every rendered frame.
- `palette` — semantic hex colors (`blue green grey orange violet teal`).
- Getters `SP`, `SE`, `Vec3`, `Vec4`, `molstar` for add-on authors who need the
  raw primitives.

## Add-ons (the "element on top" pattern)

Add-ons are kept separate from the core to model how a post layers custom UI.
They consume the core's seams; they do not reach into Mol* internals themselves
except through what `MolstarBlog` re-exports.

`ResidueCard.attach(plugin, { single? })` → detach. Wires
`MolstarBlog.onResidueContext` to render a draggable DOM card showing the
residue's chain/number/type, its alternate-location letters with occupancy bars,
and B-factor. `single: true` keeps only the most recent card open.

`MmcifExplorer.attach(plugin, panelSelector)` → detach. The Compiler-Explorer
link. It reads the loaded structure, builds the `atom_site` table grouped
chain → residue → atom, renders it into `panelSelector`, and on hover of any row
highlights the corresponding 3D element (`highlightLoci`) and shows an HTML label
positioned at the loci centroid (`projectToScreen`). The CSS classes
(`.msb-split`, `.msb-cif`, `.msb-3dlabel`) live in `molstar-blog.css`.

## Mol* mechanics worth knowing (the hard parts)

Building a loci for an arbitrary atom/residue/chain from the global, without
MolScript or OrderedSet. Every atom carries `StructureProperties.atom.sourceIndex`
— its row index in the source `atom_site` loop — which is how a text row maps to a
3D element. The recipe:

```js
var S = molstar.lib.structure, SP = S.StructureProperties;
function lociForAtom(structure, srcIndex) {
  var q = S.Queries.generators.atoms({ atomTest: function (c) { return SP.atom.sourceIndex(c.element) === srcIndex; } });
  return S.StructureSelection.toLociWithSourceUnits(S.StructureQuery.run(q, structure));
}
// residue: add chainTest (auth_asym_id) + residueTest (auth_seq_id)
// chain:   chainTest (auth_asym_id) only
```

Iterating the model to read atoms: `var loc = S.StructureElement.Location.create(structure);`
then for each `unit` in `structure.units` set `loc.unit = unit` and for each
`loc.element = unit.elements[i]`, read `SP.atom.*` / `SP.residue.*` / `SP.chain.*`.

Camera framing. After a structure loads you must frame it explicitly with
`plugin.canvas3d.requestCameraReset()` — `plugin.managers.camera.reset()` only
restores a default camera and does NOT fit the structure (leaves
`camera.state.radius` at 0 → blank). Representation geometry builds
asynchronously, so the `loadStructureFromUrl` promise resolves before the scene
bounds are final; `frameStructure()` therefore resets immediately and again on the
first `canvas3d.didDraw`. There is also a `ResizeObserver` that re-frames the first
time a zero-width/hidden container gains real size (viewers below the fold or in
tabs initialize at 0 width and otherwise never frame).

Illustrative styling. `STYLIZED_POSTPROCESSING` (black outline scale 0.5 /
threshold 0.33 + SSAO occlusion radius 5, no shadows) + component
`ignoreLight: true` (flat shading) + `pickingAlphaThreshold: 0.1`, applied via
`plugin.canvas3d.setProps`. All Mol* viewport tools are hidden via the
`viewportShow*: false` flags (including `viewportShowControls`). Note `Color(0xRRGGBB)`
is just the number at runtime, so hex literals work directly as Mol* colors.

Hover → residue identity (used by the residue card) and labels. Subscribe to
`plugin.behaviors.interaction.hover`, check `StructureElement.Loci.is`, iterate
with `forEachLocation`, read `StructureProperties`. Labels are HTML chips because
Mol*'s own `LabelRepresentation` is in `mol-repr`, which is not on the official
global.

## Verifying changes (and the traps)

`quarto preview` serves the site; open the embedding post. To prove a change
works:

- The headless preview browser CANNOT screenshot a live WebGL canvas — it comes
  back white. Verify rendering by sampling pixels of
  `plugin.helpers.viewportScreenshot.getImageDataUri()` (Mol*'s own
  readPixels-based capture), or by checking `camera.state.radius` (≈ framed) and
  loci element counts. The browser's GPU also saturates after ~10 created viewers,
  so later eval-created viewers render blank even though the data is fine — reload
  to free contexts, and prefer testing one viewer at a time.
- The browser caches `molstar-blog.js` (the `<script src>` has no query string),
  so after editing it a normal reload may keep running the old version. The dev
  server does serve the fresh file (a `fetch(url + '?b=' + Date.now())` gets it),
  so for verification you can re-`eval` the freshly fetched source. For a real
  visit it is a non-issue; during iteration, hard-refresh (Cmd-Shift-R).
- Quarto raw-HTML gotcha: see "How a post embeds a viewer" above.

The non-visual checks that gave confidence this session: `create()` auto-frames
(`camRadius ≈ 17.8` for crambin), the structure renders (3.58% non-white pixels
when framed), the explorer renders 843 atom / 46 residue / 1 chain rows, and the
loci queries return correct element counts (atom → 1, residue → its atoms incl.
altlocs+H, chain → all). The viewport config reads
`ShowControls/ShowExpand/ShowSettings/ShowSelectionMode: false`.

## State and what is next

Done: the core (`MolstarBlog`), the residue card, the mmCIF explorer (text → 3D),
illustrative styling matched to `fend_tubulinxyz`, page-matched background, all
viewport tools hidden, and the side-by-side PoC in `posts/mmcif-primer/`.

Discussed but not yet built:

- Reverse direction of the explorer: 3D hover → highlight/scroll the matching
  `atom_site` text row. Mol*'s hover gives a loci → read `sourceIndex` → find the
  row by its `data-k="atom:<srcIndex>"`.
- Extend the explorer beyond `atom_site` to the header categories from the Part 1
  diagram: link an `_struct_asym` row to a whole chain, an `_entity` row to
  everything it owns. Same `Queries` mechanism, coarser selections.
- A reverse-mapping index (`sourceIndex` → row element) so 3D→text is O(1).
- Decide on a cache-busting story for the assets if rapid iteration continues
  (e.g. a version query), or leave it (readers load fresh on first visit).
- Remove the dead `index.js`.
- Generalize: the current explorer reconstructs `atom_site` from the Mol* model
  (guaranteed in sync with the 3D). A future variant could show the actual raw
  `.cif` file text instead, parsed and row-linked the same way.

Reference notes also live in the auto-memory at
`~/.claude/projects/-Users-rtviii-dev-rtviii-github-io/memory/blog-molstar-embedding.md`.
