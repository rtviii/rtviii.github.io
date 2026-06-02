# Handoff — Duino / mmCIF blog reorganization

A working note for the next session (Claude Code, which can run `quarto preview` and
iterate visually — the previous session could not render). Read the repo-root
`CLAUDE.md` section "Blog authoring conventions (Duino / structural-bio series)"
first; it is the source of truth for conventions and this note only covers state
and open work.

## What this is

Personal Quarto website (rtviii.xyz). The structural-bio post under `posts/mmcif/`
— the "Duino" series — argues for an ensemble-native successor to the mmCIF
structural-biology format. It grew chapter-by-chapter out of long exploratory
sessions, so the prose carries a lot of session residue and the infrastructure
needed a stable spine. The reorganization goal is two things: a clear
organizational structure that can keep growing, and consistent authoring
conventions so new chapters don't drift.

The organizing idea is a two-tier split. The Core is the Duino fundamentals and
the foremost citizen: Track A (ensemble representation — Hierarchy, Groupings,
Heterogeneity with regimes R1/R2/R3, Materialization with modes A/B/C), Track B
(forward-operator infrastructure), and the evaluation model that composes
descriptors into coordinates. The Secondary tier (problems with mmCIF, annotations
engine, technology survey, ML-native access, appendices) supports the mission but
must never pollute Core prose — the Core links out to it instead. A prerequisite
Primer (statistical-mechanics and Bayesian background) is linked, not inlined.
Concept definitions live in one Glossary page. We deliberately stayed a multi-page
website rather than converting to a Quarto book, to avoid fighting the custom
two-column layout — but see the citations section below, which may force that
decision back open.

## Current state (done in the previous session)

Chapters are separate `.qmd` pages linked from `index.qmd` (the overview) and from
the left-rail nav `_glossary.qmd` (misnamed — it is navigation, not the glossary),
which is now grouped Core / Prerequisite / Secondary and links to the real glossary.

Chapter 0 was split into `forward-operators.qmd` (Track B, Core) and `primer.qmd`
(background). Figures were moved to Quarto cross-references (`%| label: fig-…`
referenced with `@fig-…`), rendered by the `pandoc-ext/diagram` TikZ filter against
the shared preamble `data/_tikz-preamble.tex` (fixed semantic palette: grey =
hierarchy, teal = groupings, orange = discrete/R1, olive = trajectory/R2, violet =
operators/Mode C). All `.def` insets were removed; their definitions now live in
`posts/glossary/index.qmd` with explicit `#gloss-<slug>` anchors, and the first use
of about eleven terms is bolded and linked there. Citations were consolidated into
one `references.bib` (42 entries — real tool papers as `@article`, infrastructure
projects as `@misc`), every last-name attribution was removed, and all `[@key]`
references resolve. The concept map is a TikZ figure factored into
`_concept-map.qmd`, embedded on the overview and shown on hover from every page via
a static `data/concept-map.svg` wired in `scripts.js`.

## Open work

### 1. Sidenotes — rebuild the interaction (this was not what Artem wanted)

What exists now: `::: {.sidenote}` blocks are hidden, a small "+" marker is dropped
at the anchor, and clicking it shows the content in a transient tippy popover to the
right. That is the wrong model.

What Artem wants: the secondary block should be displayed on the right side —
anchored to the specific "meat" sentence it elaborates — as a persistent margin
note, not a popover that appears and vanishes. Think Tufte-style sidenotes that sit
in the right margin next to the line they elaborate (collapsing to click-to-expand
on narrow viewports), or a pinned right rail that repurposes the old `.def-stack`
machinery. Confirm the exact interaction with Artem before building — persistent
margin vs. click-to-pin-in-rail is his call — then iterate it live.

Implementation notes: the layout is a hand-rolled two-column grid (left nav
`g-col-md-3`, content `g-col-md-9`) under `page-layout: custom`, so there is no
native Quarto margin column to lean on — the right-margin placement has to be built
(a third column, or absolute/fixed positioning aligned to each anchor's vertical
position, recomputed on resize). The current `installSidenotes` in `scripts.js` and
the `.sidenote*` rules in `styles/custom.css` are the thing to replace, not keep.
The authoring shape (`::: {.sidenote}` after the meat, optional `[phrase]{.sn-anchor}`
to pin the marker to a phrase) can stay; it's the rendering that changes.

### 2. Citations — one references page, not per-chapter bottom lists

The pain: every chapter page renders its own bibliography at the bottom, numbered
independently, so chapter 2's [1] is a different paper than chapter 5's [1]. Artem
wants all references listed in a single file that the chapters cross-link into.

The constraint to understand before touching this: numeric-superscript citations
plus separate website pages cannot have globally consistent numbers, because
citeproc numbers references per rendered document. Globally consistent numbering
requires a single rendered document. So there is a real trade-off, and it is worth
laying the options in front of Artem rather than picking silently.

Path B (closest to what he asked — separate chapters, one references file). Create a
`references.qmd` page that lists every entry, using `nocite` to force all of them to
appear:

```
---
title: References
nocite: |
  @*
---
::: {#refs}
:::
```

Set `suppress-bibliography: true` on the chapters (probably in `_metadata.yml`) so
no per-chapter list renders, and redirect the in-text citation links to the
references page — citeproc gives every entry a `#ref-<key>` anchor, so this is a
short Lua filter (run after citeproc) or a post-render HTML pass rewriting
`href="#ref-key"` to `href="…/references.html#ref-key"`. Caveat to flag: the in-text
superscript numbers stay per-page, so they will not match the numbering on the
references page (the link still lands on the right entry). If that mismatch is
unacceptable, switch the CSL away from numeric-superscript to a stable author-year
or keyed marker that reads fine without consistent numbering.

Path A (consistent numbers, fewer pages). Render the Core as a single document —
`index.qmd` pulls its sections in with `{{< include >}}` — so the whole Core has one
bibliography and one numbering and native citation links. Cleanest numbering;
trade-off is one long Core page and Secondary still separate.

Path C (the native answer). A Quarto book gives a single bibliography and consistent
cross-chapter numbering for free. We rejected it earlier over the custom layout, but
if the citation pain is the priority, reconsidering it — and doing the work to
reconcile the custom two-column layout with book chrome — is legitimately on the
table.

Relevant knobs: `bibliography`, `csl` (currently `styles/numeric-superscript.csl`),
`suppress-bibliography`, `nocite`, `link-citations`, `citations-hover`, and the
`#ref-<key>` anchors citeproc emits. The bib is already one file:
`posts/mmcif/references.bib`. Prototype Path A and Path B in live preview and let
Artem choose.

### 3. Prose — tighten chapter by chapter (deferred, by Artem's choice)

Artem finds the prose still too vague and lumbering. This is deliberate future work,
one chapter at a time. The discipline (from CLAUDE.md): the main column carries only
load-bearing claims and definitions; elaboration, examples, motivating asides, and
the residue of exploratory sessions move into sidenotes (once #1 is rebuilt) or get
cut; first-person voice stays but disciplined. Start with the Core (Layout, Forward
operators, Evaluation model), which is where the real content is.

### 4. Smaller polish

The math-dropdown convention is written in CLAUDE.md but applied nowhere yet: every
non-trivial formula should carry a subtle collapsed dropdown beneath it spelling out
each symbol (exempt elementary cases). Standardize it — a `.fold`-style block under
each display equation, or a per-chapter notation table.

First-use glossary links are missing for ch3's heading-defined terms (the
discrete-nesting and continuous-additive stacks, Sample axes, Operator interface,
Reference structure) and for 06's Model-side artifact. They were skipped because
threading a link through a section heading risks the auto-generated `#…` anchor that
other links depend on; do them by linking a body occurrence, or by giving those
headings explicit `{#…}` anchors first.

`08-ml-native.qmd` is still thin and marked draft; it needs real data-structure
content.

## How to work

Run `quarto preview` and verify the things the previous session could not see:
figure auto-numbering and `@fig-` links, the sidenote and concept-map popovers,
glossary cross-links, and the bibliography. TikZ figures need `pdflatex` plus the
`pandoc-ext/diagram` extension already in `_extensions/`. Key files:
repo-root `CLAUDE.md` (conventions), `posts/mmcif/_metadata.yml` (bibliography / CSL
/ diagram-filter config), `posts/mmcif/_glossary.qmd` (nav), `posts/glossary/index.qmd`
(definitions), `scripts.js` and `styles/custom.css` (sidenote, rail, and hover
infra), `posts/mmcif/references.bib`.
