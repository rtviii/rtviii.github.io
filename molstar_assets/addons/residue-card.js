/*
 * residue-card.js — an example "element on top of Mol*".
 *
 * This is NOT part of the core. It demonstrates the intended pattern: the core
 * (molstar-blog.js) hands you a residue identity on right-click via
 * MolstarBlog.onResidueContext; an add-on like this decides what UI to pop up.
 * Here: a small draggable DOM card showing the residue's chain / number / type,
 * its alternate-location letters with occupancy bars, and B-factor.
 *
 * Usage:
 *   MolstarBlog.create('#mv', { url }).then(function (v) {
 *     ResidueCard.attach(v.plugin, { single: true });
 *   });
 */
(function (global) {
  'use strict';

  function fmt(n, d) {
    return (n == null || isNaN(n)) ? '—' : Number(n).toFixed(d == null ? 2 : d);
  }

  function buildCard(res, pos) {
    var card = document.createElement('div');
    card.className = 'msb-residue-card';

    var title = document.createElement('div');
    title.className = 'msb-rc-title';
    title.innerHTML =
      '<span class="msb-rc-id">' + res.compId + ' ' + res.authSeqId + '</span>' +
      '<span class="msb-rc-chain">chain ' + res.chainId + '</span>';
    var close = document.createElement('button');
    close.className = 'msb-rc-close';
    close.setAttribute('aria-label', 'close');
    close.textContent = '×';
    title.appendChild(close);
    card.appendChild(title);

    var body = document.createElement('div');
    body.className = 'msb-rc-body';

    if (res.alts && res.alts.length) {
      var altWrap = document.createElement('div');
      altWrap.className = 'msb-rc-alts';
      var lbl = document.createElement('div');
      lbl.className = 'msb-rc-alts-label';
      lbl.textContent = 'alternate locations';
      altWrap.appendChild(lbl);
      res.alts.forEach(function (a) {
        var occ = (a.occupancy == null) ? 0 : a.occupancy;
        var row = document.createElement('div');
        row.className = 'msb-rc-alt';
        row.innerHTML =
          '<span class="msb-rc-altid">' + a.altId + '</span>' +
          '<span class="msb-rc-bar"><span class="msb-rc-bar-fill" style="width:' +
            Math.round(occ * 100) + '%"></span></span>' +
          '<span class="msb-rc-occ">' + fmt(occ) + '</span>';
        altWrap.appendChild(row);
      });
      body.appendChild(altWrap);
    } else {
      var single = document.createElement('div');
      single.className = 'msb-rc-single';
      single.textContent = 'single conformation (no altloc)';
      body.appendChild(single);
    }

    var grid = document.createElement('dl');
    grid.className = 'msb-rc-grid';
    function pair(k, v) {
      var dt = document.createElement('dt'); dt.textContent = k;
      var dd = document.createElement('dd'); dd.textContent = v;
      grid.appendChild(dt); grid.appendChild(dd);
    }
    pair('occupancy', fmt(res.occupancy));
    pair('B-factor', fmt(res.bFactor, 1));
    pair('entity', String(res.entityId));
    body.appendChild(grid);

    card.appendChild(body);
    document.body.appendChild(card);

    // place at the cursor, then clamp into the viewport
    var w = card.offsetWidth, h = card.offsetHeight;
    var x = pos.clientX + 14, y = pos.clientY + 14;
    if (x + w > window.innerWidth - 8) x = pos.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = window.innerHeight - h - 8;
    card.style.left = Math.max(8, x) + 'px';
    card.style.top = Math.max(8, y) + 'px';

    makeDraggable(card, title, close);
    close.addEventListener('click', function () { card.remove(); });
    return card;
  }

  function makeDraggable(card, handle, ignoreEl) {
    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || e.target === ignoreEl) return;
      e.preventDefault();
      var sx = e.clientX, sy = e.clientY;
      var ox = parseFloat(card.style.left), oy = parseFloat(card.style.top);
      function mv(ev) {
        card.style.left = (ox + ev.clientX - sx) + 'px';
        card.style.top = (oy + ev.clientY - sy) + 'px';
      }
      function up() {
        document.removeEventListener('mousemove', mv);
        document.removeEventListener('mouseup', up);
      }
      document.addEventListener('mousemove', mv);
      document.addEventListener('mouseup', up);
    });
  }

  /**
   * Attach the residue-context card to a viewer plugin.
   *   opts.single  keep only the most recent card open (default false: stack them)
   * Returns a detach function.
   */
  function attach(plugin, opts) {
    opts = opts || {};
    var MB = global.MolstarBlog;
    if (!MB) throw new Error('[ResidueCard] MolstarBlog not found — load molstar-blog.js first');

    var open = [];
    var off = MB.onResidueContext(plugin, function (res, pos) {
      if (opts.single) { open.forEach(function (c) { c.remove(); }); open = []; }
      open.push(buildCard(res, pos));
    });

    return function detach() {
      off();
      open.forEach(function (c) { c.remove(); });
      open = [];
    };
  }

  global.ResidueCard = { attach: attach, build: buildCard };
})(window);
