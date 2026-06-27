-- citenum.lua — global, cross-chapter citation numbering for the Duino series.
--
-- The series is a multi-page Quarto website, so citeproc numbers references
-- per page: chapter 2's [1] is a different paper than chapter 5's [1]. We want
-- ONE global enumeration — [17] is the same paper everywhere — plus a single
-- references page the chapters link into instead of a list at the bottom of
-- each chapter.
--
-- This filter runs BEFORE citeproc (Quarto runs user `filters:` ahead of its
-- built-in citeproc). It rewrites each `[@key]` citation itself, emitting the
-- same markup citeproc would — a <span class="citation"> wrapping one
-- <a role="doc-biblioref"> per key — but with the GLOBAL number as the visible
-- text and the shared references page as the target. Because the citations are
-- already resolved, citeproc then finds nothing to do in the chapters and emits
-- no per-chapter bibliography. The references page builds its list from `nocite`
-- instead, which citeproc still handles.
--
-- The global number is the key's position in references.bib. Regenerate `order`
-- when the bib changes:
--   grep -nE '^@' posts/mmcif/references.bib | sed -E 's/\{/ /; s/,.*//'
--
-- Per-chapter bibliographies are turned off with `suppress-bibliography: true`
-- (in _metadata.yml); the references page overrides it back to false.

local order = {
  "wankowicz2024encoding", "rosenberg2024altlocs", "kuzmanic2014xray",
  "wankowicz2022ligand", "ploscariu2021ensemble", "pearce2021echt",
  "lane2023frontier", "raghu2025cryoboltz", "levy2025inverse",
  "chung2024dps", "flowers2025qfit", "wankowicz2025entropy",
  "bozovic2020pdz", "winn2001tls", "painter2006tlsmd",
  "urzhumtsev2013adp", "wankowicz2026possibility", "wankowicz2024automated",
  "riley2021qfit", "singhal2025fk", "ingraham2023illuminating",
  "venkatakrishnan2013plug", "vandenbedem2015integrative", "hilser2007statistical",
  "wojdyr2022gemmi", "emsley2010coot", "williams2018molprobity",
  "liebschner2019phenix", "joosten2014pdbredo", "pettersen2021chimerax",
  "zhong2021cryodrgn", "sehnal2021molstar", "zarr",
  "omezarr", "copick", "tiledb",
  "datafusion", "llvm", "onnx",
  "h5md", "ihmcif", "naef2026blackbox",
  "chrispens2026sampleworks", "passaro2025boltz", "protenix2025advancing",
  "corley2025rf3", "kim2026crystalboltz", "li2026embedopt",
  "fadini2026rocket",
}

local num = {}
for i, key in ipairs(order) do num[key] = i end

-- Where the single references page lives, relative to a chapter page (they are
-- siblings under posts/mmcif/).
local REF_PAGE = "references.html"

-- Rebuild a citation as a <span class="citation"> of doc-biblioref links, one
-- per key, comma-separated — matching citeproc's structure so the existing
-- `.citation` CSS (numeric superscript) styles it unchanged.
local function rewrite_cite(el)
  -- Quarto cross-references (@fig-…, @sec-…, @tbl-…, @eq-…) are also parsed as
  -- Cite nodes. Only touch citations whose keys are ALL real bibliography
  -- entries; return nil otherwise so Quarto's crossref filter handles them.
  for _, c in ipairs(el.citations) do
    if not num[c.id] then return nil end
  end

  local inlines = pandoc.List()
  local ids = {}
  for i, c in ipairs(el.citations) do
    ids[#ids + 1] = c.id
    if i > 1 then inlines:insert(pandoc.Str(",")) end
    local n = num[c.id]
    local label = n and tostring(n) or "?"   -- "?" flags an unknown key
    local link = pandoc.Link(
      { pandoc.Str(label) },
      REF_PAGE .. "#ref-" .. c.id,
      "",
      pandoc.Attr("", {}, { role = "doc-biblioref" })
    )
    inlines:insert(link)
  end
  return pandoc.Span(inlines, pandoc.Attr("", { "citation" }, { ["data-cites"] = table.concat(ids, " ") }))
end

-- Walk only the document BODY. A top-level `Cite` function would also fire on
-- the Cite nodes inside the `nocite` metadata on the references page, deleting
-- them before citeproc can build the consolidated list — so we leave meta alone.
function Pandoc(doc)
  doc.blocks = doc.blocks:walk({ Cite = rewrite_cite })
  return doc
end
