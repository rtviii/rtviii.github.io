# Structural Biology's Data Substrate Problem

Working notes toward a proposal. See also: `report1.md` (polished version), `macromolecules.qmd` (complex catalog).

---

## 1. The Thesis

Data organization at the confluence of CryoET, protein and RNA engineering, and LLMs' ability to manipulate types/ontologies.

What we're looking at:

- gargantuan-scale images at angstrom-resolution
- [structural] "digital twins"
- molecular force fields
- near-perfect polymer folding
- ligand/binding affinity prediction

Interfaces that need bridging:

- MD
- EM / Crystallography
- atomic / crystallographic data encoding
- sequence
- ML featurization

The implicit proposition is that by having a common substrate (what is it? a format? a framework? a type system? a library? an application?) the friction is reduced.

Does any kind of study benefit from this _improved_ substrate? Yes -- compositional and conformational heterogeneity studies would be impossible without a framework under which to track the artifacts. By that I mean studies of type "motion of molecule X in the presence of Y" or "conformational change of Z in the presence of W" -- spliceosome, ribosome ratcheting, polymerase translocation. These require tracking identity across states, which the current formats can't do natively.

"Modularity at biological hierarchy boundaries" -- this is the operating principle.

### The grant questions

- Who is going to use it?
- Who is going to pay for it?
- What is the job here that won't need doing in 5-10 years?
- What is the job that will need doing in 5 years but doesn't exist now?

Concrete stakeholders to target: wwPDB (they're already forced into the 2028 extended PDB ID transition), CZI (building the CryoET data portal, need deposition infrastructure), EMBL-EBI (run PDBe, maintain SIFTS), NIH/NIGMS (fund most US structural biology).

### Why 2024-2026 is the window

The wwPDB is transitioning to extended PDB IDs around 2028 because the 4-character namespace is running out. This forces universal format migration across every tool, viewer, and pipeline in the field. If you're going to break everyone's parsers anyway, that's the moment to also fix the deeper problems. Proposing improvements now rides that wave rather than fighting inertia independently.

---

## 2. Evidence: Why the Current Formats Fail

### Hard limits that break real workflows

- PDB's 80-column layout: max 99,999 atoms (5-char field) -- large cryo-EM structures show `*****` and crash parsers
- 62-chain limit (single-character identifier) -- ribosomes historically split across multiple PDB IDs
- Residue numbers cap at 9,999 per chain
- B-factor field hijacked for pLDDT in AlphaFold structures -- but the semantics are inverted (higher is better for pLDDT, lower is better for B-factors), causing confusion in molecular replacement workflows
- PAE matrices require separate JSON files with custom parsing; MSAs (.a3m) exist entirely outside the coordinate format

### The two-numbering-system mess

mmCIF has `auth_seq_id` (author-provided) and `label_seq_id` (PDB-assigned):

| Feature | label_seq_id (Canonical) | auth_seq_id (Author) |
|---------|--------------------------|----------------------|
| Starts at | Always 1 | Anywhere (negative, 0, 100...) |
| Gaps | Not allowed (must be continuous) | Allowed |
| Consistency | Same for all instances of an entity | Can differ between chains |
| Viewer Default | Used for internal data mapping | Default for 3D selection/labels |

PyMOL defaults to auth_* fields while other tools use label_*, creating incompatible coordinate references for the same molecule.

https://www.rcsb.org/docs/general-help/identifiers-in-pdb

### Entity vs. Instance (Chain) logic

A PDB Entity is defined by its chemical sequence. If two chains have the exact same sequence, they are instances of the same Entity. If Chain A and Chain B have the same underlying sequence but Chain A is missing residues 1-10 in the density, they are still the same Entity -- the entity represents the chemical molecule present in the experiment, not just what was modeled.

### The entity_poly_seq conditionality problem

`entity_poly_seq` can't be mandatory since you can produce a mmCIF file without any polymeric molecular entity. You could write a mmCIF file with a single ion in it, no protein, no nucleic acid and it still would be a valid mmCIF file. Once you have a linear polymer, entity_poly_seq should be there -- but **mmCIF dictionaries don't know conditionals**. This is a fundamental expressivity limitation of the schema.

### Parser fragmentation

Everyone writes their own parser. The situation is severe:

- Gemmi benchmark: reading a 230MB file takes 7.8s in Gemmi but causes OOM crashes in BioPython and iotbx-pdb
- BioPython maintains two parsers -- MMCIFParser and FastMMCIFParser -- because the "correct" one is too slow and the fast one "doesn't aim to parse mmCIF correctly"
- GitHub issues across BioPython (#775, #481, #778, #1206), MDAnalysis (#446, #2422, #3473), Gemmi (#24, #118, #178), Boltz (#451)
- DeepMind implemented their own parser for AlphaFold: https://huggingface.co/spaces/simonduerr/ProteinMPNN/blob/f969e9cfb6f11ba299c7108aadff124e9cf38b1f/alphafold/alphafold/data/mmcif_parsing.py
- model-angelo (GNN for model building) fixing format issues on their own: https://github.com/3dem/model-angelo/issues/51
- Gemmi author trying to connect to ChimeraX and stumbling: https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/
- Biopython developer calling the format spec ugly: https://stackoverflow.com/a/11686524/10697358
- Residue numbering confusion: https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering
- Unusual numbering: https://proteopedia.org/wiki/index.php/Unusual_sequence_numbering

Specific insanity: 5afi chain Y is a tRNA sequence but tagged with "F" at the end because it carries a phenylalanine. No respect for the standardization of the RNA alphabet.

https://github.com/google-deepmind/alphafold/issues/252
https://github.com/wwpdb-dictionaries/mmcif_pdbx/issues

### The rant (keep -- good proposal motivation material)

The eminence of AF/Rosetta/etc. recognized with the Nobel contrasted to the quality of the "dataset" they spring from, which is just what the PDB increasingly is, is staggering. They are stuck in the 2000s. I'd bet an eye that if not for the institutional inertia and the OneDeposition workflow, a single company like Meta or HuggingFace or one of Amazon's 100 bio divisions could come up with a better solution in a span of a year. By better I mean: support for binary, direct integration with source EM-maps, sane modern format, biological hierarchy integration, and much MUCH richer data points -- in terms of landmarks and shapes like we are doing, or something more chemically minded a la Wilson/Polikanov, or something dynamism-minded a la cryoDRGN.

It is crazy that people use 5-10M$ machines from the cutting edge of science, thousands of dollars of cloud compute, and I don't know how many biologist human-hours to arrive at a crappy plaintext file almost entirely untethered to the fabric from which it came.

Just shitty documentation, no automatic schema, ad-hoc updates, no explanation for datatypes.

---

## 3. What Others Are Saying

### Diego del Alamo -- agent provenance metadata

> To give one example, if you receive a model of an antigen against which you want to design antibodies, and some of the surface loops look weird, you'd like to know if they are justified by experimental data or were modeled w/ Rosetta, AF3, etc. ...because you don't want to design against some computational artifact. If you got the model from a human, that's fine, you can go ask. But structbio agents are ephemeral and can't be consulted a week later. So ideally that info gets stuffed in the PDB/CIF header. ...But then that raises the question of how much metadata you can pack in there. Are you putting in MSAs? Etc. Anyway my guess is that this will soon be scaled up such that human supervision becomes unwieldy, so an agent should be able to answer these kinds of questions.

This is a strong argument for extensible, machine-readable provenance in the format itself.

### Gabriele Corso -- MCP for biomolecular structures

> "Is anyone developing open-source MCP frameworks for LLMs to parse and understand biomolecular structures accurately? If so, please reach out to me, I would love to discuss, help and support!"

Signals that the ML community is hitting the format wall from the other side.

### Stephanie Wankowitz -- encoding, MD, and ensemble data

https://diffuse.science/posts/encoding/
https://pmc.ncbi.nlm.nih.gov/articles/PMC11220883/pdf/m-11-00494.pdf
https://x.com/stephanie_mul/status/1955319804539150665

### Oli Clarke -- per-residue annotations

https://bsky.app/profile/olibclarke.bsky.social/post/3micblpuoxc2u

### wwPDB itself acknowledges the problem

The wwPDB launched a PTM remediation project (October 2024 - Spring 2025) acknowledging that post-translational modifications were historically handled inconsistently. A new `pdbx_modification_feature` category will provide instance-level PTM annotation. This represents catching up, not leading -- but it's evidence that the maintainers know the format is inadequate.

---

## 4. ML / AI-Native Format Requirements

Desirable features for a next-generation format:

- **E(3)/SE(3) equivariance preservation** under geometric transformations -- the format should make it natural to store and retrieve data in ways that respect rotational/translational symmetry
- **Native graph representations** with k-nearest neighbor graphs, edge type annotations, and node features for GNNs like GearNet and DeepRank-GNN
- **Multi-resolution tokenization** (AlphaFold 3 uses flexible schemes: standard residues as single tokens, modified residues as atoms, ligands as individual atoms)
- **Pre-computed MSA embeddings** as feature channels
- **Confidence metrics** (pLDDT, PAE) as first-class data alongside coordinates
- **Versioned model parameters** linking predictions to the networks that generated them

### Streaming and time-resolved data

Real-time streaming for time-resolved experiments requires: time-indexed 4D coordinate trajectories, native support for incomplete/sparse datasets, and streaming formats compatible with modern data infrastructure. BioCARS achieves 100ps-to-seconds time resolution; mix-and-inject serial crystallography captures enzyme catalysis at 2-7ms. These generate data requiring storage paradigms beyond static files. XFEL serial crystallography produces terabytes per hour, scaling to petabytes per day at next-gen facilities.

### Ensemble representation

- Conformer population weights as first-class metadata
- State transition matrices linking related conformations
- Per-coordinate uncertainty quantification
- Links between experimental observables and ensemble statistics
- The Protein Ensemble Database (PED) demonstrates that structured IDP ensemble metadata is feasible -- conformer counts, modeling resolution levels, validation status -- but it remains isolated from mainstream structural formats

### Open question: transformer cache?

Can this also serve as a "paging cache" for the QKV store of transformers, MSA embeddings that would facilitate modern models' operation? Unclear but worth thinking about -- if the format natively stores embeddings, do inference pipelines benefit from not recomputing them?

---

## 5. Adjacent Efforts and Inspirations

### atomworks (Rosetta Commons)

https://rosettacommons.github.io/atomworks/latest/tutorial/index.html

### OME-NGFF / OME-Zarr

https://ngff.openmicroscopy.org/about/index.html

Cloud-native from inception. Chunked N-dimensional arrays where each chunk is an independent file. Multi-resolution pyramids built in. Hierarchical JSON metadata at each level. Implementations in Python, Java, JavaScript, C++, Rust, Julia. Zarr v3 sharding groups multiple chunks per object to handle filesystem limits while maintaining parallelism.

### copick / CZII CryoET Data Portal

https://github.com/copick/copick
https://github.com/chanzuckerberg/cryoet-data-portal-backend/blob/main/schema/v1.1.0/metadata-docs/TiltSeries.md
https://github.com/chanzuckerberg/cryoet-data-portal-backend/tree/main/schema/v1.1.0

16,000+ annotated tomograms, but annotations exist in "a wide variety of formats with varying forms and completeness of metadata." A joint EBI/CZ Imaging Institute working group formed April 2024 to address this.

What happens when CZII is consistently getting 3-4A subtomograms and needs to "deposit" 1000 ribosomes at once for some horizontal study of a mouse brain cancer cell? Whatever the answer is, it's not PDB.

### HTSlib as governance/adoption model

Downloaded 1M+ times, used by 900+ GitHub projects. Key lessons: simple human-readable format (SAM) paired with efficient binary (BAM), strong bundled reference implementation, indexability for random region access, extensibility via optional tags, MIT/BSD licensing. CRAM achieved 40-60% smaller files through reference-based compression while maintaining backward compat -- relevant precedent for structural biology where reference structures (e.g. canonical ribosome) could serve as compression anchors.

### GA4GH as organizational template

Eight Work Streams, 24 Driver Projects, 1,000+ individuals from 90+ countries and 650+ organizations. Standards emerge from implementer needs through Study Groups, get formalized in Work Streams, pilot through the Global Implementers Forum.

### SIFTS

Maps PDB residues to UniProtKB sequences weekly. Recently embedded directly into mmCIF files, expanded coverage 40-fold to 1.8M+ UniProtKB sequences via UniRef90. PDBe knowledge graph: 1B+ nodes, 1.5B+ edges integrating 30+ partner resources. Closest thing to what the proposal envisions -- but still an external layer rather than intrinsic to the format.

---

## 6. Links and Reading List

### Format specs

- https://www.iucr.org/resources/cif
- https://www.iucr.org/resources/cif/cif2
- https://www.iucr.org/resources/cif/spec/version1.1
- https://datascience.codata.org/articles/10.5334/dsj-2016-003

### Implementations and libraries

- https://www.ccp4.ac.uk/html/cciflib.html
- http://comcifs.github.io/cif_api/index.html
- https://docs.rosettacommons.org/docs/latest/development_documentation/tutorials/robust

### History

- https://www.ccp4.ac.uk/html/mmcifformat.html
- https://legacy.ccp4.ac.uk/newsletters/newsletter37/13_harvest.html
- https://www.ccp4.ac.uk/html/harvesting.html

### Papers to read

- https://pubmed.ncbi.nlm.nih.gov/40586518/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12208665/pdf/elife-103797.pdf
- https://arxiv.org/pdf/2505.01919
- `Translation, Librations, Screws`: https://onlinelibrary.wiley.com/doi/abs/10.1107/S0567740868001718
- https://www.sciencedirect.com/science/article/pii/S0959440X26000394?via%3Dihub
- https://link.springer.com/article/10.1007/s00418-023-02209-1

---

## 7. Open Questions

- What exactly is the deliverable? A format spec? A library? A database layer? A type system? All of the above? The answer probably needs to be staged: library first (prove utility), format extensions second (ride the 2028 migration), governance/community third.

- What does CZII do when they need to deposit thousands of subtomogram averages at once? This is a concrete near-term forcing function.

- Can format-native embeddings serve as a transformer cache / reduce redundant computation in inference pipelines?

- How does coarse-graining work at mesoscale? (How does Alex Rose do it in Mol*?)

- How do conformational heterogeneity methods a la Ellen Zhong store and access data?

- What can be learned from the lidar literature about progressive coarse-graining based on structural ontologies?

- Where do formal methods fit, if at all?

### People to talk to / track

- Molq: arbitrary structural queries
- Oli Clarke: per-residue annotations
- Stephanie Wankowitz: MD and ensemble data
- TileDB, Zarr communities: CryoET and EM data infrastructure
- OME-NGFF working groups

### Threads from the original notes that need developing

- "modularity at biological hierarchy boundaries" -- this is the slogan but needs concrete examples beyond what's listed
- Trajectories for a single chain, adding waters, etc. -- the "rewriting on the fly is hard due to lack of modularity" observation. What specifically breaks and what would modularity look like?
