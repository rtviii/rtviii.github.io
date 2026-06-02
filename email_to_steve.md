Subject: re: common PDB file errors and detection tools

Steve,

Your question hits a recurring sore spot. There isn't a single canonical list of common PDB errors, but the validation tooling that exists is reasonably comprehensive -- the problem is that it's scattered across tools whose outputs don't aggregate. A few pointers grouped by error type:

**File-syntax breakage (your whitespace/duplicate cases).** gemmi (Marcin Wojdyr) is the strictest modern mmCIF parser and surfaces issues other parsers silently swallow. Often the first place to look when a file half-loads.

- https://github.com/project-gemmi/gemmi
- Wojdyr 2022, JOSS: https://joss.theoj.org/papers/10.21105/joss.04200

**Geometric errors (bonds, angles, clashes, Ramachandran, rotamers).** MolProbity is the Richardson lab's geometry battery and the most widely cited. Phenix bundles it. Mogul (CCDC) does ligand geometry against the small-molecule crystal database.

- http://molprobity.biochem.duke.edu
- Williams et al. 2018, Protein Sci: https://onlinelibrary.wiley.com/doi/10.1002/pro.3330
- https://www.ccdc.cam.ac.uk/solutions/software/mogul

**Composition and connectivity (missing LINK records, ligand identity, Mg vs water).** CheckMyMetal and CheckMyBlob handle metal-site sanity. The wwPDB Validation Report bundles many other checks at deposit time.

- https://czmbase.molbio.uic.edu/cmm
- https://www.checkmyblob.org
- https://www.wwpdb.org/validation/2017/XrayValidationReportHelp

**Systematic re-validation (your "files that survived deposition but are still wrong" case).** PDB-REDO re-refines deposited X-ray structures and publishes the deltas -- effectively a standing corpus of "errors caught after the fact".

- https://pdb-redo.eu
- Joosten et al. 2014, IUCrJ: https://journals.iucr.org/m/issues/2014/04/00/me0501

**Comprehensive but old-school.** WHATIF / WHAT_CHECK (Gert Vriend) is the original of the genre and still useful for stereochemistry and packing checks.

- https://swift.cmbi.umcn.nl/whatif

**Inside ChimeraX.** Built-in validation panels plus a Python API. You can wrap any of the above as a tool or write residue-level checks directly. The `check` command and the `clashes` / `contacts` tools are the obvious starting points; for atom-count-per-residue against the CCD, a short Python script using `chimerax.atomic` is straightforward.

For the AI-agent angle: the bigger obstacle is corpus, not models. Existing tools produce one-shot reports that don't ride with the deposition, so there is no archive linking errors back to the structures they appeared in -- which is exactly the labelled data a learned validator would need. Some recent work uses AF2 pLDDT as a suspicion signal and learned rotamer libraries are getting better, but it's research-grade.

I have a draft blog post on adjacent format-level issues -- happy to share once it's less of a sketch.

Cheers,
Artem
