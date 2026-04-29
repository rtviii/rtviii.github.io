document.addEventListener("DOMContentLoaded", function () {
  // 1. Image Zoom
  const images = document.querySelectorAll(".zoomable");
  images.forEach((img) => {
    img.addEventListener("click", function () {
      this.classList.toggle("zoomed");
    });
  });

  // 2. Rich Previews
  if (typeof tippy === "function") {
    const links = document.querySelectorAll(".listing-section a");

    links.forEach((link) => {
      const url = link.href;

      tippy(link, {
        content: "Loading preview...",
        allowHTML: true,
        theme: "light-border",
        placement: "right",
        interactive: true,
        maxWidth: 450, // Larger width for "rich" look
        delay: [400, 0],
        onShow(instance) {
          // --- YouTube Previews ---
          if (url.includes("youtube.com") || url.includes("youtu.be")) {
            const urlObj = new URL(url);
            let videoId = "";

            if (url.includes("youtu.be")) {
              videoId = urlObj.pathname.slice(1);
            } else {
              videoId = urlObj.searchParams.get("v");
            }

            if (videoId) {
              // Fetch title via oEmbed
              fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
              )
                .then((res) => res.json())
                .then((data) => {
                  // Check for maxres (high quality) thumbnail, fallback to mq (medium)
                  const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

                  instance.setContent(`
                <div style="width: 400px; font-family: 'IBM Plex Sans', sans-serif;">
                    <img src="${thumbUrl}" onerror="this.src='https://img.youtube.com/vi/${videoId}/mqdefault.jpg'" style="width:100%; border-radius:4px; border: 1px solid #eee;">
                    <div style="padding: 10px;">
                        <strong style="display:block; font-size:15px; line-height:1.3; color:#1a1a1a;">${data.title}</strong>
                        <span style="font-size:12px; color:#666; margin-top:4px; display:block;">${data.author_name} • YouTube</span>
                    </div>
                </div>
            `);
                })
                .catch(() => {
                  instance.setContent(
                    `<div style="padding:10px;">Could not load preview for ${videoId}</div>`
                  );
                });
            }
          } else {
            // For Blogs: We simulate a "Rich Card"
            // Note: True metadata scraping usually requires a backend, but we can style the link beautifully
            const domain = new URL(url).hostname.replace("www.", "");
            instance.setContent(`
              <div style="width: 350px; padding: 12px; font-family: 'IBM Plex Sans', sans-serif;">
                <div style="text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #007bff; margin-bottom: 4px;">${domain}</div>
                <div style="font-size: 14px; font-weight: 600; line-height: 1.4; color: #222; margin-bottom: 8px;">
                  ${link.innerText || "External Article"}
                </div>
                <div style="font-size: 12px; color: #666; word-break: break-all;">${url}</div>
              </div>
            `);
          }
        },
      });
    });
  }

  // 3. Per-chapter behaviours for the mmCIF series.
  //    Scoped to pages under /posts/mmcif/ so this is harmless elsewhere.
  //    The order matters:
  //      a) snapshot heading text BEFORE we add the anchor mark to it
  //      b) inject anchor links so headings are linkable
  //      c) wrap H2/H3 in collapsible bodies (the click handler ignores
  //         clicks landing on the anchor mark)
  //      d) build the per-chapter mini-TOC in the left rail
  //      e) wire current-chapter highlight in the chapter glossary
  //      f) install Gwern-style hover previews on in-doc links
  if (window.location.pathname.indexOf("/posts/mmcif/") !== -1) {
    var headingTextById = snapshotHeadingText();
    installHeadingAnchors();
    installCollapsibleHeadings();
    injectChapterSectionList(headingTextById);
    highlightCurrentChapter();
    installLinkPreviews();
    expandTargetIfCollapsed();
    installScrollSpy();
    wireAsideToggles();
    installDefStack();
  }

  // Post pages outside the mmcif series still need the appendix alignment
  // and current-chapter highlight in their own .post-glossary.
  if (document.querySelector(".right-column") && document.querySelector(".post-glossary")) {
    alignAppendixToBody();
    highlightCurrentChapter();
  }
});

/* -----------------------------------------------------------------------------
 * Article root selector with fallbacks.
 *
 * Quarto's `page-layout: custom` does NOT always emit `main#quarto-document-content`;
 * what gets rendered depends on the template and the include partials. Falling
 * back to `.right-column` (the post body wrapper from _post_mid.qmd) and finally
 * to `<main>` keeps every per-article behaviour from silently no-op'ing on a
 * minor template change.
 * ---------------------------------------------------------------------------*/
function getArticleRoot() {
  return document.querySelector("main#quarto-document-content")
      || document.querySelector(".right-column")
      || document.querySelector("main")
      || document.body;
}

/* -----------------------------------------------------------------------------
 * If the URL has a fragment that points at a heading inside a collapsed body,
 * expand all enclosing collapsed bodies and re-scroll the target into view.
 * Without this, deep-linking into a section that happens to live below a
 * default-collapsed h2 silently lands somewhere else on the page.
 * ---------------------------------------------------------------------------*/
function expandTargetIfCollapsed() {
  var hash = window.location.hash;
  if (!hash || hash.length < 2) return;

  var target;
  try { target = document.querySelector(hash); } catch (e) { return; }
  if (!target) return;

  // Walk up from the target, expanding any enclosing .collapsible-body and
  // un-collapsing the heading just before it.
  var node = target.parentElement;
  while (node) {
    if (node.classList && node.classList.contains("collapsible-body")) {
      node.classList.remove("is-hidden");
      var heading = node.previousElementSibling;
      if (heading && heading.classList) heading.classList.remove("is-collapsed");
    }
    node = node.parentElement;
  }

  // Re-scroll: the layout has shifted, so the original :target jump landed
  // before the expansion finished.
  setTimeout(function () { target.scrollIntoView({ block: "start" }); }, 0);
}

/* -----------------------------------------------------------------------------
 * Mini-TOC scrollspy. Highlights the post-sections-item whose target heading
 * is currently the topmost in the viewport. Quiet — just bold + ink-900 on
 * the matching entry, plus removal on the previously-active one.
 *
 * Uses IntersectionObserver because it's the cheap-to-fire option; falls
 * through silently on browsers without it (target stays untagged).
 * ---------------------------------------------------------------------------*/
function installScrollSpy() {
  if (typeof IntersectionObserver !== "function") return;

  var article = getArticleRoot();
  var sectionLinks = document.querySelectorAll(".post-sections a[href^='#']");
  if (!article || sectionLinks.length === 0) return;

  // Map heading id -> .post-sections-item (the LI wrapping the link).
  var itemByTargetId = {};
  sectionLinks.forEach(function (a) {
    var href = a.getAttribute("href");
    if (!href || href.length < 2) return;
    var id = href.slice(1);
    var li = a.closest(".post-sections-item");
    if (li) itemByTargetId[id] = li;
  });

  var headings = Array.prototype.slice.call(
    article.querySelectorAll("h2[id], h3[id]")
  ).filter(function (h) { return itemByTargetId[h.id]; });
  if (headings.length === 0) return;

  var visible = {};
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      visible[e.target.id] = e.isIntersecting ? e.boundingClientRect.top : null;
    });

    // Pick the topmost intersecting heading; fall back to the last one above
    // the viewport so something is always lit while you're past the last h2.
    var current = null;
    var bestTop = Infinity;
    headings.forEach(function (h) {
      var top = visible[h.id];
      if (top !== null && top !== undefined && top < bestTop) {
        current = h.id;
        bestTop = top;
      }
    });

    Object.keys(itemByTargetId).forEach(function (id) {
      itemByTargetId[id].classList.toggle("is-current", id === current);
    });
  }, {
    // Trigger transition once a heading is in the upper portion of the viewport.
    rootMargin: "-10% 0px -70% 0px",
    threshold: [0, 1]
  });

  headings.forEach(function (h) { observer.observe(h); });
}

/* -----------------------------------------------------------------------------
 * Snapshot the rendered text of every H1/H2/H3/H4 in the article BEFORE we
 * mutate them. Used by `injectChapterSectionList` so its labels don't pick
 * up the "#" anchor mark we inject in the next step.
 * ---------------------------------------------------------------------------*/
function snapshotHeadingText() {
  var article = getArticleRoot();
  var map = {};
  if (!article) return map;
  article.querySelectorAll("h1, h2, h3, h4").forEach(function (h) {
    promoteAnchorId(h);
    if (h.id) map[h.id] = (h.textContent || "").trim();
  });
  return map;
}

/* Quarto with `page-layout: custom` emits `data-anchor-id="slug"` on
 * headings rather than a real `id` attribute. Promote it to `id` so every
 * downstream selector (`h2[id]`, IntersectionObserver targets, fragment
 * scrolling, the "#" anchor link) works without special-casing. */
function promoteAnchorId(el) {
  if (!el || el.id) return;
  var anchor = el.getAttribute && el.getAttribute("data-anchor-id");
  if (anchor) el.id = anchor;
}

/* -----------------------------------------------------------------------------
 * Add a hover-visible "#" anchor mark to every heading that has an id.
 * Independent of Quarto's built-in anchor mechanism so it works regardless
 * of theme defaults. The anchor is a <a class="heading-anchor"> appended
 * inside the heading; CSS controls its hover-only visibility.
 * ---------------------------------------------------------------------------*/
function installHeadingAnchors() {
  var article = getArticleRoot();
  if (!article) return;
  // Promote any data-anchor-id headings to real ids before selecting.
  article.querySelectorAll("h2, h3, h4").forEach(promoteAnchorId);
  article.querySelectorAll("h2[id], h3[id], h4[id]").forEach(function (h) {
    if (h.querySelector(".heading-anchor")) return; // idempotent
    var a = document.createElement("a");
    a.className = "heading-anchor";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", "Link to this section");
    a.textContent = "#";
    a.addEventListener("click", function (ev) {
      // Stop the parent heading's collapse handler from firing on this click.
      ev.stopPropagation();
    });
    h.appendChild(a);
  });
}

/* -----------------------------------------------------------------------------
 * Collapsible H2/H3 sections.
 *
 * Visual treatment lives in styles/homepage.css. This function only injects
 * the wrappers and click handlers. Clicks landing on the heading-anchor (the
 * "#" mark) are ignored so the anchor stays usable.
 * ---------------------------------------------------------------------------*/
function installCollapsibleHeadings() {
  var article = getArticleRoot();
  if (!article) return;

  function wrapHeading(heading, stopTags) {
    var siblings = [];
    var el = heading.nextElementSibling;
    while (el && stopTags.indexOf(el.tagName) === -1) {
      siblings.push(el);
      el = el.nextElementSibling;
    }
    if (siblings.length === 0) return;

    var wrapper = document.createElement("div");
    wrapper.className = "collapsible-body";
    siblings.forEach(function (s) { wrapper.appendChild(s); });
    heading.insertAdjacentElement("afterend", wrapper);
    heading.classList.add("collapsible-heading");

    heading.addEventListener("click", function (event) {
      // Don't collapse when the click is on the heading anchor, an inline
      // link, or other interactive content inside the heading.
      if (event.target.closest(".heading-anchor")) return;
      if (event.target.closest("a") && event.target.closest("a") !== heading) return;
      wrapper.classList.toggle("is-hidden");
      heading.classList.toggle("is-collapsed");
    });
  }

  // Process H3 first so H3 wrappers exist before the surrounding H2 sweeps
  // them into its own body (the H2 wrapper then contains the H3 wrapper as
  // a child; both toggle independently).
  article.querySelectorAll("h3").forEach(function (h) {
    wrapHeading(h, ["H2", "H3"]);
  });
  article.querySelectorAll("h2").forEach(function (h) {
    wrapHeading(h, ["H2"]);
  });
}

/* -----------------------------------------------------------------------------
 * Per-chapter mini-TOC inside the left rail.
 *
 * Uses the heading-text snapshot built in step (a) so the labels are clean
 * (no "#" mark) and stable regardless of subsequent mutations.
 * ---------------------------------------------------------------------------*/
function injectChapterSectionList(headingTextById) {
  var container = document.querySelector(".post-sections");
  var article = getArticleRoot();
  if (!container || !article) return;

  var headings = Array.prototype.slice
    .call(article.querySelectorAll("h2, h3"))
    .filter(function (h) { return h.id; });

  if (headings.length === 0) {
    // Empty container collapses via .post-sections:empty in the stylesheet.
    container.innerHTML = "";
    return;
  }

  var html = '<div class="post-sections-label">In this chapter</div><ul>';
  headings.forEach(function (h) {
    var label = (headingTextById && headingTextById[h.id])
      || (h.textContent || "").trim();
    if (!label) return;
    var depthClass = h.tagName === "H3" ? " is-sub" : "";
    html +=
      '<li class="post-sections-item' + depthClass + '">' +
      '<a href="#' + h.id + '">' + escapeHtml(label) + '</a>' +
      '</li>';
  });
  html += '</ul>';
  container.innerHTML = html;
}

/* -----------------------------------------------------------------------------
 * Highlight the current chapter inside the left-rail post glossary.
 *
 * Compares the current pathname against each glossary link and tags the
 * matching one with `aria-current="page"` and `is-current`. Match is
 * leaf-name-based so trailing slashes / .html extensions / hash fragments
 * don't matter.
 * ---------------------------------------------------------------------------*/
function highlightCurrentChapter() {
  var hereLeaf = leafSlug(window.location.pathname);
  document.querySelectorAll(".post-glossary a").forEach(function (a) {
    try {
      var hrefLeaf = leafSlug(new URL(a.href).pathname);
      if (hrefLeaf === hereLeaf) {
        a.setAttribute("aria-current", "page");
        a.classList.add("is-current");
        var li = a.closest("li");
        if (li) li.classList.add("is-current");
      }
    } catch (e) { /* ignore malformed URLs */ }
  });
}

function leafSlug(pathname) {
  var leaf = pathname.replace(/\/+$/, "").split("/").pop();
  if (!leaf || leaf === "index.html") return "index";
  return leaf.replace(/\.html$/, "").replace(/\.qmd$/, "");
}

/* -----------------------------------------------------------------------------
 * Gwern-style hover previews for in-doc links.
 *
 * Any link inside the post body that points either at a same-page anchor or
 * at another chapter in the series gets a tippy popover. On hover the popover
 * lazily loads the target chapter (cached after first fetch), finds the
 * referenced heading or the page title, and shows it together with the next
 * paragraph or two.
 *
 * Skips: external links, the "#" heading anchors, the chapter glossary, the
 * mini-TOC, citation links (Quarto handles those via citations-hover), and
 * the bibliography back-references.
 * ---------------------------------------------------------------------------*/
function installLinkPreviews() {
  if (typeof tippy !== "function") return;

  var origin = window.location.origin;
  var herePath = window.location.pathname;

  var candidates = document.querySelectorAll(
    ".right-column a[href]:not(.heading-anchor):not(.is-current)"
  );

  candidates.forEach(function (link) {
    // Skip nav links, citation links, and bib back-refs.
    if (link.closest(".post-glossary, .post-sections, .citation, .csl-entry, #refs"))
      return;

    var rawHref = link.getAttribute("href");
    if (!rawHref) return;

    // Only handle same-origin in-doc links.
    var url;
    try { url = new URL(link.href); } catch (e) { return; }
    if (url.origin !== origin) return;

    // Skip raw external file extensions or non-html targets.
    if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|gz)$/i.test(url.pathname)) return;

    var samePage = url.pathname === herePath || url.pathname === "";
    if (!samePage && !/\.html?$/i.test(url.pathname) && url.pathname !== "/")
      return;
    if (samePage && !url.hash) return; // same-page link with no anchor: skip

    tippy(link, {
      content: '<div class="link-preview-loading">Loading\u2026</div>',
      allowHTML: true,
      theme: "light-border",
      placement: "top",
      interactive: true,
      // Generous interactive border so the cursor's path between trigger and
      // popover doesn't trip a hide. Tippy treats anything inside this
      // padded perimeter as still-hovering.
      interactiveBorder: 30,
      // Leave time for the user to move into the popover and to select text
      // inside it. Show is fast so previews still feel snappy.
      delay: [280, 240],
      maxWidth: 480,
      appendTo: document.body,
      onShow: function (instance) {
        loadInDocPreview(url).then(function (html) {
          if (!html) {
            instance.setContent('<div class="link-preview-empty">No preview available.</div>');
            return;
          }
          instance.setContent(html);
          // Re-typeset MathJax inside the freshly inserted preview node so
          // $...$ and \( ... \) render instead of leaking as raw text.
          typesetMathIn(instance.popper);
        }).catch(function () {
          instance.setContent('<div class="link-preview-empty">Preview failed to load.</div>');
        });
      }
    });
  });
}

var _previewDocCache = {};
function loadInDocPreview(url) {
  var anchor = url.hash ? url.hash.slice(1) : "";

  // Same-page anchor: extract from the live document immediately.
  if (url.pathname === window.location.pathname || url.pathname === "") {
    return Promise.resolve(extractPreviewFromDoc(document, anchor));
  }

  var key = url.pathname;
  if (!_previewDocCache[key]) {
    _previewDocCache[key] = fetch(url.pathname, { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) throw new Error("status " + r.status);
        return r.text();
      })
      .then(function (text) {
        return new DOMParser().parseFromString(text, "text/html");
      });
  }
  return _previewDocCache[key].then(function (doc) {
    return extractPreviewFromDoc(doc, anchor);
  });
}

function extractPreviewFromDoc(doc, anchorId) {
  var article = doc.querySelector("main#quarto-document-content")
              || doc.querySelector(".right-column")
              || doc.body;
  if (!article) return null;

  var target;
  if (anchorId) {
    // Quarto's static HTML wraps each heading in `<section id="...">` AND
    // emits `data-anchor-id="..."` on the heading itself. The live page may
    // strip the heading's `id` at runtime, leaving only data-anchor-id. So
    // we try (1) the heading by data-anchor-id, then (2) anything by id.
    // If the id resolves to a section wrapper, dive in to the heading.
    var esc = cssEscape(anchorId);
    target = article.querySelector("[data-anchor-id='" + anchorId.replace(/'/g, "\\'") + "']")
          || article.querySelector("#" + esc);
    if (!target) return null;
    if (/^SECTION$/i.test(target.tagName)) {
      var inner = target.querySelector("h1, h2, h3, h4");
      if (inner) target = inner;
    }
  } else {
    target = article.querySelector("h1, h2");
    if (!target) return null;
  }

  // Title for the preview = the target heading (if it's a heading), or the
  // chapter title (if the target is some other element).
  var titleEl;
  if (/^H[1-6]$/.test(target.tagName)) {
    titleEl = target;
  } else {
    titleEl = article.querySelector("h1") || target;
  }
  var title = (titleEl.textContent || "")
    .replace(/#$/, "").trim(); // drop our own anchor "#"
  // Drop the chapter-section number prefix the title may carry (e.g.
  // "2.1.2 Composition" → "Composition").
  title = title.replace(/^\s*\d+(?:\.\d+)*\s+/, "");

  // Walk the body to find up to 3 prose blocks following the target.
  //
  // Two complications:
  //   1. On the live page, our own JS has wrapped the headings's content
  //      in a .collapsible-body sibling, so target.nextElementSibling is
  //      that wrapper rather than the first <p>. Walk INTO wrappers.
  //   2. In Quarto's static HTML, each heading is the first child of a
  //      <section class="level{N}">, and the "siblings" we want live as
  //      children of that section. So if the target heading's parent is
  //      a section, walk the section's children instead.
  //
  // Logic: build a "scan list" — the nodes to iterate over — then walk
  // forward, descending into wrappers, picking up prose blocks, stopping
  // at the next equal-or-higher heading.
  var stopAt = ["H1", "H2", "H3", "H4"];

  // Build the candidate sibling list. If the target's parent is a Quarto
  // section wrapper, scan the section's children (skipping the heading).
  // Otherwise scan the target's siblings starting after it.
  var scanRoots = [];
  if (target.parentElement && /^SECTION$/i.test(target.parentElement.tagName)) {
    var kids = target.parentElement.children;
    for (var k = 0; k < kids.length; k++) {
      if (kids[k] !== target) scanRoots.push(kids[k]);
    }
  } else {
    var s = target.nextElementSibling;
    while (s) { scanRoots.push(s); s = s.nextElementSibling; }
  }

  // Flatten: any .collapsible-body wrapper expands into its children.
  // Any nested .level{N} section likewise — its first child is usually
  // a heading we'll naturally stop at.
  function flatten(nodes, out) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.classList && (n.classList.contains("collapsible-body"))) {
        flatten(n.children, out);
      } else if (/^SECTION$/i.test(n.tagName)) {
        flatten(n.children, out);
      } else {
        out.push(n);
      }
    }
    return out;
  }
  var flat = flatten(scanRoots, []);

  var bodyHtml = "";
  var added = 0;
  for (var j = 0; j < flat.length && added < 3; j++) {
    var node = flat[j];
    if (stopAt.indexOf(node.tagName) !== -1) break;
    if (
      node.tagName === "P" ||
      node.tagName === "UL" ||
      node.tagName === "OL" ||
      node.tagName === "BLOCKQUOTE" ||
      (node.classList && node.classList.contains("def"))
    ) {
      bodyHtml +=
        "<" + node.tagName.toLowerCase() + ">" +
        node.innerHTML +
        "</" + node.tagName.toLowerCase() + ">";
      added++;
    }
  }
  if (!bodyHtml) bodyHtml = "<p><em>(no excerpt)</em></p>";

  return (
    '<div class="link-preview">' +
    '<div class="link-preview-title">' + escapeHtml(title) + '</div>' +
    '<div class="link-preview-body">' + bodyHtml + '</div>' +
    '</div>'
  );
}

function cssEscape(s) {
  // CSS.escape is widely available; fall back to a regex for older browsers.
  if (window.CSS && typeof window.CSS.escape === "function") return CSS.escape(s);
  return s.replace(/([\!\"\#\$\%\&\'\(\)\*\+\,\.\/\:\;\<\=\>\?\@\[\\\]\^\`\{\|\}\~])/g, "\\$1");
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* -----------------------------------------------------------------------------
 * Align the bibliography (#quarto-appendix) under the .right-column.
 *
 * Quarto's appendix is rendered at page width OUTSIDE the article grid,
 * so without this it lands flush left, misaligned with the body column.
 * We measure the live .right-column rect and pin `--post-body-left` /
 * `--post-body-width` at the document root. CSS in homepage.css consumes
 * those custom properties to position the appendix.
 *
 * Re-runs on resize so the alignment survives layout changes.
 * ---------------------------------------------------------------------------*/
function alignAppendixToBody() {
  function update() {
    var rc = document.querySelector(".right-column");
    if (!rc) return;
    var rect = rc.getBoundingClientRect();
    var rootStyle = document.documentElement.style;
    rootStyle.setProperty("--post-body-left", rect.left + "px");
    rootStyle.setProperty("--post-body-width", rect.width + "px");
  }
  update();
  // ResizeObserver triggers when the column geometry shifts (responsive
  // breakpoints, font load, image reflow). Window resize covers the rest.
  if (typeof ResizeObserver === "function") {
    var rc = document.querySelector(".right-column");
    if (rc) new ResizeObserver(update).observe(rc);
  }
  window.addEventListener("resize", update);
}

/* -----------------------------------------------------------------------------
 * Re-render MathJax inside a freshly-inserted popover. The fetched HTML
 * carries raw `\( ... \)` / `$$ ... $$` markers which only become rendered
 * MathML when MathJax processes the subtree. Quarto loads MathJax v3 by
 * default; the v3 API is `MathJax.typesetPromise([root])`.
 *
 * If MathJax isn't loaded (homepage / non-mmcif pages), this is a no-op.
 * ---------------------------------------------------------------------------*/
function typesetMathIn(root) {
  if (!root) return;
  if (window.MathJax && typeof window.MathJax.typesetPromise === "function") {
    window.MathJax.typesetPromise([root]).catch(function () {});
  } else if (window.MathJax && typeof window.MathJax.Hub === "object") {
    // MathJax v2 API fallback.
    window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, root]);
  }
}

/* -----------------------------------------------------------------------------
 * Collapsible inline note (.note-collapse).
 *
 * Markdown shape:
 *   ::: {.fold data-summary="A note on bond connectivity"}
 *   The body of the note...
 *   :::
 *
 * (Class is `.fold` rather than `.aside` / `.note-*` because Quarto's
 *  pandoc filter rewrites both of those into column-margin asides.)
 *
 * Rendered shape: a header `<div class="aside-summary">` (built from
 * data-summary, falls back to "Note") and an `<div class="aside-body">`
 * containing every direct child of the original element. Click on the
 * summary toggles `.is-open`. Body collapsed by default.
 * ---------------------------------------------------------------------------*/
function wireAsideToggles() {
  var article = getArticleRoot();
  if (!article) return;
  article.querySelectorAll(".fold").forEach(function (aside) {
    if (aside.dataset.wired === "1") return;
    aside.dataset.wired = "1";

    var label = (aside.getAttribute("data-summary") || "").trim() || "Note";

    // Move all current children into a body wrapper.
    var body = document.createElement("div");
    body.className = "fold-body";
    while (aside.firstChild) body.appendChild(aside.firstChild);

    var summary = document.createElement("div");
    summary.className = "fold-summary";
    summary.textContent = label;
    summary.setAttribute("role", "button");
    summary.setAttribute("tabindex", "0");
    summary.setAttribute("aria-expanded", "false");

    aside.appendChild(summary);
    aside.appendChild(body);

    function toggle() {
      var open = aside.classList.toggle("is-open");
      summary.setAttribute("aria-expanded", open ? "true" : "false");
    }
    summary.addEventListener("click", toggle);
    summary.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
}

/* -----------------------------------------------------------------------------
 * .def-stack — running rail of definition chips on the right.
 *
 * As the user scrolls past .def blocks the term name is appended to a fixed
 * rail (.def-stack) on the right edge of the viewport. Each chip is a tippy
 * popover trigger that on hover shows the full definition body, and a click
 * jumps back to the original .def in the body.
 *
 * The rail shows only definitions whose top has scrolled above the viewport.
 * Active chips don't disappear on scroll-back-up — they simply stay visible
 * once added (matches the user's mental model of "what I've seen so far").
 * ---------------------------------------------------------------------------*/
function installDefStack() {
  if (typeof tippy !== "function") return;

  var article = getArticleRoot();
  if (!article) return;
  var defs = Array.prototype.slice.call(article.querySelectorAll(".def"));
  if (defs.length === 0) return;

  // Auto-id every .def so the chip can deep-link back. Slug = term lowercased,
  // spaces → dashes, non-word stripped.
  function slug(s) {
    return (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  var rail = document.createElement("aside");
  rail.className = "def-stack";
  rail.setAttribute("aria-label", "Definitions seen so far");
  document.body.appendChild(rail);

  var chips = {};

  defs.forEach(function (def) {
    var term = def.getAttribute("data-term") || "";
    if (!term) return;
    if (!def.id) def.id = "def-" + slug(term);
  });

  function renderChip(def) {
    var term = def.getAttribute("data-term") || "";
    if (!term || chips[def.id]) return;

    var chip = document.createElement("a");
    chip.className = "def-stack-chip";
    chip.href = "#" + def.id;
    chip.textContent = term;

    // Hover popover: small card with term and definition body.
    var bodyHtml = "";
    def.querySelectorAll(":scope > p").forEach(function (p) {
      bodyHtml += "<p>" + p.innerHTML + "</p>";
    });
    var content =
      '<div class="def-stack-preview">' +
      '<div class="def-stack-preview-title">' + escapeHtml(term) + '</div>' +
      bodyHtml +
      '</div>';

    tippy(chip, {
      content: content,
      allowHTML: true,
      theme: "light-border",
      placement: "left",
      interactive: true,
      interactiveBorder: 30,
      delay: [120, 200],
      maxWidth: 380,
      appendTo: document.body,
      onShown: function (instance) { typesetMathIn(instance.popper); }
    });

    rail.appendChild(chip);
    chips[def.id] = chip;
  }

  function update() {
    var threshold = 0;
    defs.forEach(function (def) {
      if (chips[def.id]) return;
      var top = def.getBoundingClientRect().top;
      if (top < threshold) renderChip(def);
    });
  }

  update();
  window.addEventListener("scroll", update, { passive: true });
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(update).observe(document.body);
  }
}

/* -----------------------------------------------------------------------------
 * Quarto's built-in citation hover popovers (theme=quarto) don't typeset
 * MathJax in their content. Patch every citation tippy instance so when it
 * shows, we typeset the box once. Also widen the hide-delay so selecting
 * text in the popover doesn't trip a dismiss.
 * ---------------------------------------------------------------------------*/
(function patchQuartoCitationTippys() {
  // Quarto wires its tippys after DOMContentLoaded too, so wait a tick.
  function patchAll() {
    var anchors = document.querySelectorAll('a[role="doc-biblioref"], .citation a');
    anchors.forEach(function (a) {
      if (!a._tippy || a.__patchedQuartoTippy) return;
      a.__patchedQuartoTippy = true;
      var inst = a._tippy;
      inst.setProps({
        delay: [200, 240],
        interactiveBorder: 30,
        appendTo: document.body
      });
      var prevOnShown = inst.props.onShown;
      inst.setProps({
        onShown: function (i) {
          if (typeof prevOnShown === "function") prevOnShown(i);
          typesetMathIn(i.popper);
        }
      });
    });
  }
  if (document.readyState === "complete") {
    setTimeout(patchAll, 200);
  } else {
    window.addEventListener("load", function () { setTimeout(patchAll, 200); });
  }
})();
