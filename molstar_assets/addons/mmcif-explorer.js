/*
 * mmcif-explorer.js — a Compiler-Explorer-style link between the mmCIF atom_site
 * table and the 3D viewer. Hover a chain / residue / atom row on the left and the
 * corresponding element lights up (with a label) in Mol* on the right.
 *
 * Mapping: every atom carries StructureProperties.atom.sourceIndex (its row index
 * in the source atom_site loop), so a text row maps back to a Mol* element. We
 * build a StructureElement.Loci on demand with a Queries.generators selection —
 * no MolScript or mol-data needed, only what the official build puts on the global.
 *
 * Usage: MmcifExplorer.attach(plugin, '#panel')  // after MolstarBlog.create resolves
 */
(function (global) {
  'use strict';

  function S() { return global.molstar.lib.structure; }
  function SP() { return S().StructureProperties; }

  function padR(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
  function padL(s, n) { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }
  function fixed(v, d, w) { return padL((v == null || isNaN(v)) ? '?' : Number(v).toFixed(d), w); }

  function buildModel(plugin) {
    var s = S(), sp = SP();
    var struct = plugin.managers.structure.hierarchy.current.structures[0].cell.obj.data;
    var loc = s.StructureElement.Location.create(struct);
    var chains = [], chainMap = {};
    for (var u = 0; u < struct.units.length; u++) {
      var unit = struct.units[u]; loc.unit = unit;
      var els = unit.elements;
      for (var i = 0; i < els.length; i++) {
        loc.element = els[i];
        var asym = sp.chain.auth_asym_id(loc);
        var seq = sp.residue.auth_seq_id(loc);
        var a = {
          src: sp.atom.sourceIndex(loc), group: sp.residue.group_PDB(loc), id: sp.atom.id(loc),
          atom: sp.atom.label_atom_id(loc), comp: sp.atom.label_comp_id(loc), asym: asym, seq: seq,
          alt: sp.atom.label_alt_id(loc), x: sp.atom.x(loc), y: sp.atom.y(loc), z: sp.atom.z(loc),
          occ: sp.atom.occupancy(loc), b: sp.atom.B_iso_or_equiv(loc)
        };
        var ch = chainMap[asym];
        if (!ch) { ch = chainMap[asym] = { asym: asym, residues: [], _rm: {} }; chains.push(ch); }
        var res = ch._rm[seq];
        if (!res) { res = ch._rm[seq] = { asym: asym, seq: seq, comp: a.comp, atoms: [] }; ch.residues.push(res); }
        res.atoms.push(a);
      }
    }
    return { struct: struct, chains: chains };
  }

  function centroid(atoms) {
    var x = 0, y = 0, z = 0, n = atoms.length || 1;
    for (var i = 0; i < atoms.length; i++) { x += atoms[i].x; y += atoms[i].y; z += atoms[i].z; }
    return [x / n, y / n, z / n];
  }
  function flatAtoms(chain) {
    var out = [];
    for (var i = 0; i < chain.residues.length; i++) out = out.concat(chain.residues[i].atoms);
    return out;
  }

  // --- loci builders (Queries on the global; cached on the node) --------------
  function lociForAtom(struct, src) {
    var s = S(), sp = SP();
    var q = s.Queries.generators.atoms({ atomTest: function (c) { return sp.atom.sourceIndex(c.element) === src; } });
    return s.StructureSelection.toLociWithSourceUnits(s.StructureQuery.run(q, struct));
  }
  function lociForResidue(struct, asym, seq) {
    var s = S(), sp = SP();
    var q = s.Queries.generators.atoms({
      chainTest: function (c) { return sp.chain.auth_asym_id(c.element) === asym; },
      residueTest: function (c) { return sp.residue.auth_seq_id(c.element) === seq; }
    });
    return s.StructureSelection.toLociWithSourceUnits(s.StructureQuery.run(q, struct));
  }
  function lociForChain(struct, asym) {
    var s = S(), sp = SP();
    var q = s.Queries.generators.atoms({ chainTest: function (c) { return sp.chain.auth_asym_id(c.element) === asym; } });
    return s.StructureSelection.toLociWithSourceUnits(s.StructureQuery.run(q, struct));
  }

  function headerLine() {
    return padR('group', 6) + padL('id', 6) + '  ' + padR('atom', 5) + padR('alt', 4) +
      padR('comp', 5) + padR('asym', 5) + padL('seq', 4) + '  ' +
      padL('x', 8) + padL('y', 8) + padL('z', 8) + padL('occ', 6) + padL('B', 7);
  }
  function atomLine(a) {
    return padR(a.group, 6) + padL(a.id, 6) + '  ' + padR(a.atom, 5) + padR(a.alt || '.', 4) +
      padR(a.comp, 5) + padR(a.asym, 5) + padL(a.seq, 4) + '  ' +
      fixed(a.x, 3, 8) + fixed(a.y, 3, 8) + fixed(a.z, 3, 8) + fixed(a.occ, 2, 6) + fixed(a.b, 2, 7);
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function attach(plugin, panel) {
    var MB = global.MolstarBlog;
    panel = typeof panel === 'string' ? document.querySelector(panel) : panel;
    if (!MB || !panel) throw new Error('[MmcifExplorer] need MolstarBlog and a panel element');

    var model = buildModel(plugin);
    var nodes = {};
    var html = ['<div class="msb-cif-head">' + esc(headerLine()) + '</div>'];

    model.chains.forEach(function (ch) {
      var ck = 'chain:' + ch.asym;
      nodes[ck] = { kind: 'chain', asym: ch.asym, centroid: centroid(flatAtoms(ch)), text: 'chain ' + ch.asym };
      html.push('<div class="msb-cif-chain" data-k="' + ck + '">chain ' + esc(ch.asym) + ' · ' + ch.residues.length + ' residues</div>');
      ch.residues.forEach(function (r) {
        var rk = 'res:' + r.asym + ':' + r.seq;
        nodes[rk] = { kind: 'res', asym: r.asym, seq: r.seq, centroid: centroid(r.atoms), text: r.asym + ' · ' + r.comp + ' ' + r.seq };
        html.push('<div class="msb-cif-res" data-k="' + rk + '">' + esc(r.comp + ' ' + r.seq) + '</div>');
        r.atoms.forEach(function (a) {
          var ak = 'atom:' + a.src;
          nodes[ak] = { kind: 'atom', src: a.src, centroid: [a.x, a.y, a.z], text: a.asym + ' · ' + a.comp + a.seq + ' · ' + a.atom + (a.alt ? ' (' + a.alt + ')' : '') };
          html.push('<div class="msb-cif-atom" data-k="' + ak + '">' + esc(atomLine(a)) + '</div>');
        });
      });
    });
    panel.innerHTML = html.join('');

    var label = document.createElement('div');
    label.className = 'msb-3dlabel';
    document.body.appendChild(label);

    function lociFor(node) {
      if (!node.loci) {
        node.loci = node.kind === 'atom' ? lociForAtom(model.struct, node.src)
          : node.kind === 'res' ? lociForResidue(model.struct, node.asym, node.seq)
          : lociForChain(model.struct, node.asym);
      }
      return node.loci;
    }

    var current = null;
    function enter(key) {
      if (key === current) return;
      current = key;
      var node = nodes[key];
      if (!node) return;
      MB.highlightLoci(plugin, lociFor(node));
      var scr = MB.projectToScreen(plugin, node.centroid);
      if (scr) {
        label.textContent = node.text;
        label.style.left = (scr.x - window.scrollX) + 'px';
        label.style.top = (scr.y - window.scrollY) + 'px';
        label.style.display = 'block';
      }
    }
    function leave() {
      current = null;
      MB.clearHighlight(plugin);
      label.style.display = 'none';
    }
    function onOver(e) {
      var row = e.target && e.target.closest ? e.target.closest('[data-k]') : null;
      if (row) enter(row.getAttribute('data-k'));
      else leave();
    }

    panel.addEventListener('mouseover', onOver);
    panel.addEventListener('mouseleave', leave);

    return function detach() {
      panel.removeEventListener('mouseover', onOver);
      panel.removeEventListener('mouseleave', leave);
      leave();
      if (label.parentNode) label.parentNode.removeChild(label);
    };
  }

  global.MmcifExplorer = { attach: attach };
})(window);
