## Toward a Modern Foundation for Structural Biology Data

_Working draft -- exploratory, incomplete. A scaffold for collecting references, usecases, and tradeoffs._

---

### 1. Problems with mmCIF and the current ecosystem

#### 1.1 The single-structure assumption

mmCIF models one experiment -> one structure. The `alt_id` mechanism is the primary tool for conformational heterogeneity: individual atoms carry a single-character label (A, B, C...) and an occupancy (summing to 1.0 within a residue). This means: each residue independently declares its own conformers; there is no way to state "alt A of residue 50 co-occurs with alt A of residue 80"; and occupancies are per-atom scalars with no associated uncertainty, free energy, or kinetic information.

The **IHMCIF dictionary** (the IHM working group extension, [github.com/ihmwg/IHMCIF](https://github.com/ihmwg/IHMCIF)) extends mmCIF with ~30 new categories for integrative/hybrid models. It adds: discrete multi-state models, ordered ensembles (states connected by time or other ordering), multi-scale representations (atomic + coarse-grained beads in the same model), and spatial restraint descriptions. PDB-IHM was unified with the PDB archive in August 2024 and now issues standard PDB accession codes. But: states remain discrete and independent, there is no thermodynamic annotation, no per-state uncertainty, no support for continuous distributions, and the text-file serialization doesn't scale to large ensembles.

Wankowicz & Fraser (IUCrJ, 2024) -- "Comprehensive Encoding of Conformational and Compositional Protein Structural Ensembles through mmCIF Data Structure" -- directly addresses encoding ensembles within mmCIF. **Must read to understand what's achievable within the existing framework and where it hits walls.**

TODO: read and annotate the Wankowicz & Fraser 2024 paper. Compare their proposed categories to IHM categories. Identify exactly where mmCIF's text-based, category-based design prevents the representation we want.

#### 1.2 Text format, parsing fragility

mmCIF is plain text with fixed syntactic rules (CIF2 spec: [iucr.org/resources/cif/cif2](https://www.iucr.org/resources/cif/cif2)) but no canonical reference implementation. Every consumer writes its own parser. They all handle edge cases differently:

- DeepMind's AlphaFold mmCIF parser: [huggingface.co/.../mmcif_parsing.py](https://huggingface.co/spaces/simonduerr/ProteinMPNN/blob/f969e9cfb6f11ba299c7108aadff124e9cf38b1f/alphafold/alphafold/data/mmcif_parsing.py)
- model-angelo (GNN model building) fixing parsing: [github.com/3dem/model-angelo/issues/51](https://github.com/3dem/model-angelo/issues/51)
- gemmi/ChimeraX interop friction: [chimerax-users mailing list thread](https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/)
- Biopython developer calling the format spec ugly: [stackoverflow.com/a/11686524](https://stackoverflow.com/a/11686524)
- AlphaFold GitHub issues on mmCIF: [github.com/google-deepmind/alphafold/issues/252](https://github.com/google-deepmind/alphafold/issues/252)
- wwPDB dictionary issues: [github.com/wwpdb-dictionaries/mmcif_pdbx/issues](https://github.com/wwpdb-dictionaries/mmcif_pdbx/issues)
- Residue numbering chaos: [bioinformatics.stackexchange.com/questions/14210](https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering), [proteopedia unusual numbering](https://proteopedia.org/wiki/index.php/Unusual_sequence_numbering)

**BinaryCIF** (David Sehnal / Mol* team, [github.com/molstar/BinaryCIF](https://github.com/molstar/BinaryCIF)) addresses the performance problem: binary-encoded mmCIF with column-wise compression, significantly smaller files and faster parsing than text mmCIF. Used by the PDB for Mol* visualization. But it's a serialization optimization, not a data model change -- it encodes the same categories and the same single-structure assumption.

The CIF dictionary itself lacks conditionals and has no automatic schema validation. `entity_poly_seq` can't be mandatory for files containing polymers because the dictionary language cannot express "if a polymer entity exists, require this category." Documentation is scattered across IUCr, CCP4, and wwPDB sites with inconsistent coverage.

- CIF formal specs: [iucr.org/resources/cif](https://www.iucr.org/resources/cif), [CIF2 spec](https://www.iucr.org/resources/cif/cif2)
- CCP4 harvesting/history: [legacy.ccp4.ac.uk](https://legacy.ccp4.ac.uk/newsletters/newsletter37/13_harvest.html), [ccp4.ac.uk mmcif format](https://www.ccp4.ac.uk/html/mmcifformat.html)
- C API: [comcifs.github.io/cif_api](http://comcifs.github.io/cif_api/index.html)

#### 1.3 Implicit information and missing connections

Atomic models are largely untethered from the experimental data that produced them. Maps in EMDB, raw images in EMPIAR, models in PDB -- three archives, three accession systems, cross-referenced but not structurally integrated. A tighter connection between atomic coordinates and the density/potential from which they were derived would enable validation workflows, re-refinement, and heterogeneity analysis that currently require manual assembly of data from multiple sources.

#### 1.4 No ML-native access patterns

Every GNN-based structure model constructs a molecular graph from parsed coordinates. This graph construction is reimplemented in every codebase (Graphein, AF2 data pipeline, OpenFold, ProteinMPNN, ESM-IF) and is a major preprocessing bottleneck. Specific problems:

- No random access to subsets of atoms or residues without reading the full file
- No stored spatial index for neighbor lookup (every model rebuilds k-d trees / radius graphs)
- No standard for internal coordinates (phi/psi/omega/chi angles) alongside Cartesian -- every model recomputes these
- Pair representations ((N_res, N_res, d) tensors) are the most expensive object in AF2-family models and are never stored/shared
- No convention for packaging ensembles as training data for ensemble-aware models
- Tokenization for heterogeneous systems (protein + ligand + nucleic acid + ions) is done ad-hoc in AF3/Boltz/Chai with no shared vocabulary

TODO: collect specific examples of preprocessing code from AF2, Boltz-1, Chai-1, ProteinMPNN showing redundant graph construction. Quantify the time spent in data loading vs. model forward pass for typical training runs. Survey how e3nn irreps are constructed and whether precomputation is feasible.

#### 1.5 Pain points (enumerated)

- **Parsing fragility.** No reference implementation. Every parser is different. See links in 1.2.
- **No random access.** Cannot read chain B without scanning chain A. For 200k+ atom structures this is a real bottleneck.
- **Residue numbering.** Author vs. label vs. UniProt, insertion codes, no canonical mapping. See [bioinformatics.stackexchange.com/questions/14210](https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering), [proteopedia](https://proteopedia.org/wiki/index.php/Unusual_sequence_numbering), also SAbR renumbering tool: [github.com/delalamo/SAbR](https://github.com/delalamo/SAbR).
- **Ligand representation.** 3-to-5-char Component IDs, bond orders in a separate dictionary, no inline SMILES, insufficient for conformational sampling (qFit-ligand needs SMILES as separate input). Encoding sometimes nonsensical (e.g., a tRNA chain tagged "F" because it carries phenylalanine -- no respect for RNA alphabet standardization).
- **Future scale.** Current PDB deposition is one-structure-per-experiment. When cryo-ET subtomogram averaging routinely produces per-particle structures, or when high-throughput crystallography campaigns produce thousands of related structures, the deposition model will need to change. This is not yet a data _storage_ problem for atomic models but an _access_, _association_, and _transformation_ problem.

TODO: dedicated section on dynamics vocabulary (MD trajectory conventions, what H5MD/MDTraj/MDAnalysis do, what's realistic to unify vs. what's wishful thinking). Dedicated section on ML access patterns with concrete code examples and benchmarks.

---

### 2. Explorations toward alternatives

#### 2.1 Format and storage foundations

Structural biology data is fundamentally multidimensional: atoms have properties (element, charge, name), atoms belong to residues and chains (hierarchy), atoms have coordinates that vary across conformational states (ensemble dimension), and various scalar/vector/tensor fields can be associated with atoms, residues, or the entire system at any level of this hierarchy. A text file of atom records serializes this but sacrifices random access, compression, and dimensional structure.

Technologies from adjacent fields that offer better primitives:

**Zarr v3** -- chunked N-dimensional arrays on any storage backend. Simple (just arrays + groups + JSON metadata), cloud-native, implementations in Python/Rust/JS/C++. [github.com/zarr-developers/zarr-python](https://github.com/zarr-developers/zarr-python), [github.com/zarrs/zarrs](https://github.com/LDeakin/zarrs) (Rust).

**OME-Zarr (NGFF)** -- bioimaging conventions on Zarr: multiscale pyramids (same data at multiple resolution levels, enabling zoom-dependent loading), axes labels, coordinate transforms, labels/ROIs. Used by CZ CryoET Data Portal. Community-driven RFC process. [ngff.openmicroscopy.org](https://ngff.openmicroscopy.org/0.5/), [github.com/ome/ome-zarr-py](https://github.com/ome/ome-zarr-py).

**copick** -- storage-agnostic cryo-ET dataset API built on Zarr/OME-Zarr. Adds overlay filesystem (read-only data + writable annotations), typed annotation objects (picks, segmentations, meshes) with provenance, plugin CLI. [github.com/copick/copick](https://github.com/copick/copick).

**TileDB** -- array database with native sparse arrays, built-in query engine, time-travel/versioning. TileDB-SOMA data model (for single-cell genomics) solved a structurally analogous problem: (cells x genes) with metadata on both axes, at scale. [github.com/TileDB-Inc/TileDB](https://github.com/TileDB-Inc/TileDB), [github.com/single-cell-data/TileDB-SOMA](https://github.com/single-cell-data/TileDB-SOMA).

**Apache Arrow / DataFusion** -- columnar in-memory format + query engine (Rust). Predicate pushdown (filters pushed to storage layer), zero-copy cross-language interop. A zarr-datafusion crate already exists: [github.com/jayendra13/zarr-datafusion](https://github.com/jayendra13/zarr-datafusion). [datafusion.apache.org](https://datafusion.apache.org/).

**Multiscale pyramids for molecular data.** OME-Zarr stores the same image at progressively lower resolutions (full -> 2x downsampled -> 4x -> ...) for efficient visualization. The analog for molecular structures: all-atom -> backbone-only -> domain centroids -> subunit centroids, with explicit mapping operators between levels. This is the coarse-graining hierarchy that IHM already represents in a limited way.

Tradeoffs (needs benchmarking on real structural biology workloads):

| Concern                       | Zarr + DataFusion           | TileDB                   | HDF5 (status quo for MD)               |
| ----------------------------- | --------------------------- | ------------------------ | -------------------------------------- |
| Simplicity                    | High (just arrays)          | Medium (database engine) | Medium                                 |
| Cloud-native                  | Yes (chunked objects on S3) | Yes                      | Poor (no chunk-level access over HTTP) |
| Sparse arrays                 | No (fake with compression)  | Native                   | No                                     |
| Query engine                  | External (DataFusion)       | Built-in                 | None                                   |
| Versioning                    | Manual                      | Built-in (time-travel)   | None                                   |
| Bioimaging precedent          | OME-Zarr, copick, CZ Portal | cellxgene Census         | H5MD for MD trajectories               |
| Random access to single state | O(chunk)                    | O(1) with index          | O(N) scan                              |

#### 2.2 Representing conformational heterogeneity

The problem in one sentence: we need a data model that can represent everything from a two-rotamer sidechain flip to a continuous distribution over ribosome conformations, with correlations between components, thermodynamic annotations, and multi-scale descriptions.

Current tools and formalisms:

- **alt_id in mmCIF**: discrete, per-residue, uncorrelated, no thermodynamics. See 1.1.
- **IHM multi-state**: discrete states, ordered ensembles, multi-scale. No correlations, no continuous distributions, no thermodynamics. [github.com/ihmwg/IHMCIF](https://github.com/ihmwg/IHMCIF).
- **Markov State Models** (PyEMMA, deeptime): states + transition matrix + equilibrium populations. Mature formalism from MD. [github.com/deeptime-ml/deeptime](https://github.com/deeptime-ml/deeptime). Question: does it extend to experimental data with sparse kinetic information?
- **cryoDRGN latent spaces**: continuous distribution parameterized by neural decoder. No standard serialization. [github.com/ml-struct-bio/cryodrgn](https://github.com/ml-struct-bio/cryodrgn).
- **Topological data analysis / Mapper**: summarize landscape topology without committing to discretization. [github.com/scikit-tda/kepler-mapper](https://github.com/scikit-tda/kepler-mapper), [github.com/scikit-tda/ripser.py](https://github.com/scikit-tda/ripser.py).
- **Probabilistic graphical models**: represent correlated residue-level conformational states as a joint distribution, explicitly encoding which pairs are dependent. pgmpy, Stan, PyMC.

Ideas we've discussed (all exploratory, none validated):

- **State graph / DAG**: states as nodes, transitions as weighted directed edges. Stored as sparse adjacency matrix + per-state metadata arrays. Diffs between states (delta encoding) rather than full coordinate sets -- compact and informative.
- **Conformational dimension in the array**: (N_states, N_atoms, 3) coordinate array with chunking along the state axis. Metadata arrays for per-state properties (free energy, population, latent vector). Straightforward extension of OME-Zarr conventions.
- **Correlation arrays**: sparse (N_atoms, N_atoms) covariance matrix or low-rank factorization. Or: a graphical model specifying which residue pairs are conformationally coupled.
- **Multi-scale pyramid for heterogeneity**: same ensemble described at all-atom, residue, domain granularity with explicit CG mapping operators.
- **Neural decoder as stored object**: TorchScript blob + latent vectors as arrays. Anyone can regenerate density for any point in conformational space.

TODO: literature review -- MSM data models in detail, how cryoDRGN serializes its outputs, what the Wankowicz/Fraser 2024 mmCIF extension actually proposes for correlated conformers, whether IHM's `_ihm_ordered_ensemble` can encode kinetic information.

#### 2.3 Query language and annotations

**Query language.** Need: select arbitrary molecular subsets (atoms, residues, chains, domains) at any level of hierarchy, across conformational states, composably. MolQL ([github.com/molstar/molstar](https://github.com/molstar/molstar), embedded in Mol\*) is the most expressive existing molecular selection language. VMD/MDAnalysis selections are simpler but widely used. Extension needed for: state selection, cross-state predicates, annotation predicates.

If storage is columnar/array-based, molecular selections can compile to predicates that a query engine (DataFusion) pushes down to the storage layer. "chain A and resid 50-80 in state 3" becomes: filter on chain_id column, range filter on res_seq column, index into state dimension -- only relevant chunks are read. Spatial predicates ("within 5A of ligand") need a stored spatial index (R-tree) and compile to a UDF call.

**Annotations.** Core model: **(selector, body, provenance)** triple. The selector is a query expression. The body is arbitrary typed data (text, scalar, vector, array, structured object, reference). The provenance records author, method, software, date, confidence.

Oli Clarke's Coot residue annotation tool ([bsky.app/olibclarke/post/3micblpuoxc2u](https://bsky.app/profile/olibclarke.bsky.social/post/3micblpuoxc2u)) demonstrates the impulse: save notes associated with the active residue, persist in mmCIF. The generalization: associate _any_ data with _any_ molecular selection, in a separate layer (copick overlay pattern) so multiple annotators coexist and annotations are decoupled from the model version.

This subsumes: UniProt features, CATH domains, validation metrics, qFit conformers, ML confidence scores, manual curation notes, force-field parameters -- all are (selector, body, provenance) triples with different body types and different provenance.

Key design question: how to make selectors persistent and portable across structures (use canonical identifiers like UniProt residue numbers rather than PDB-specific numbering).

#### 2.4 ML-native structural operations

The fundamental pattern in all current structure ML models: **coordinates + chemistry -> graph -> message passing -> prediction**. The specifics vary but converge on shared primitives.

**Graph construction.** A molecular graph G = (V, E) where V are atoms or residues with feature vectors, E are edges (spatial proximity, covalent bonds, sequence connectivity) with features. Edge construction is the bottleneck:

- Spatial: all pairs within cutoff r (typically 8-12A). Requires neighbor search, O(N log N) with k-d tree or O(N^2) brute force. Done for every structure at every training step.
- Covalent: bond graph from topology. Currently inferred from coordinates + element types because mmCIF doesn't reliably carry bonds.
- Sequence: (i, i+1) backbone edges. Trivial but requires mapping from atom indices to residue indices.

**Equivariant features.** E(3)-equivariant models (NequIP, MACE, Allegro, eSCN) decompose features into irreducible representations of SO(3): scalars (l=0), vectors (l=1), rank-2 tensors (l=2), etc. The displacement vector between atoms i and j is expanded in spherical harmonics Y_l^m(r_ij/|r_ij|), giving edge features typed by angular momentum l. These are computed via e3nn ([github.com/e3nn/e3nn](https://github.com/e3nn/e3nn)). The computation is the same for every structure -- it depends only on relative positions and cutoff. If the format stored a spatial index enabling O(k) neighbor lookup per atom, and precomputed the spherical harmonic expansion at stored edges, the entire feature construction step would be a read operation.

**Pair representations.** AF2's pair representation is an (N_res, N_res, 128) tensor updated through the evoformer. Initial pair features include: residue-residue distance bins, relative sequence position encoding, and template distance/angle features. These initial features depend only on the structure (not on the model weights) and could in principle be precomputed and stored. At 128 features and N_res=1000, this is ~500MB per structure -- large but feasible if stored compressed and accessed via chunked reads.

**Tokenization.** AF3/Boltz-1/Chai-1 tokenize the molecular system: each standard residue is one token; ligand atoms or functional groups become tokens; nucleotide bases are tokens. The token graph has heterogeneous node types and multiple edge types (spatial, covalent, sequence). The tokenization scheme is model-specific but the input information needed (atom types, bond connectivity, residue membership, entity type) is the same. A format that carries this information explicitly (rather than requiring inference from coordinate records) would serve all these models.

**Ensemble training data.** Current models predict single structures. The next generation will predict distributions. Training data needs: (sequence, ensemble of structures with populations). cryoDRGN already learns distributions from cryo-EM particles. If ensembles have a native representation in the format (the conformational dimension), packaging training data for distribution-predicting models becomes trivial.

TODO: profile the AF2/OpenFold data pipeline to quantify time in parsing vs. feature construction vs. model forward pass. Survey Graphein ([github.com/a-r-j/graphein](https://github.com/a-r-j/graphein)) for what graph construction patterns are most common. Examine Boltz-1's tokenization code for what chemical information it extracts. Benchmark: stored R-tree spatial index vs. on-the-fly k-d tree construction for graph building at training time.

---

### 3. Open questions

- Is this a format, a library, a type system, a database, or all of the above? The answer probably depends on use case: a format for archival/sharing, a library for access/manipulation, a type system for validation, a database for querying.
- What is the minimum viable subset that is useful? Probably: a Zarr-based layout with conventions for topology + coordinates + ensemble dimension + annotation overlays, a Python library for read/write, and converters to/from mmCIF.
- Who adopts first? ML practitioners (who have the most acute pain from current formats)? cryo-ET groups (who are already on Zarr via copick/CZ Portal)? Crystallographers (who have the deepest investment in mmCIF)?
- What is the relationship to existing standards? Complement (converters to/from mmCIF), competition (replace mmCIF for new use cases), or extension (new conventions that live alongside existing ones)?


### "Black-box" data 

A deeper design critique of white-box formats comes from Naef and Bronstein's recent Chemical Science perspective (2026, rsc.li/chemical-science). Their central argument is that ML models in biology have traditionally relied on data produced as a byproduct of scientific inquiry -- repositories like the PDB aggregate and standardize this data, but they are not purpose-generated for ML, leading to poor standardization, limited scale, and systematic biases -- and that the more critical question now is not "the next AlphaFold" but "the next PDB," meaning new experimental data sources intentionally optimized for machine consumption rather than human intuition. rsc The format implications are sharp: data generated to be consumed by models rather than inspected by scientists has no natural representation in mmCIF, whose entire design presupposes that a human will eventually open the file, assign meaning to the chain IDs, and judge whether the electron density fits -- a constraint that should be optional, not structural.

### Modularity examples in software ecosystems

The LLVM/DataFusion pattern -- stable core IR, pluggable frontends and backends, passes as the unit of extension -- recurs across enough mature systems that it is probably the right general shape for any data infrastructure problem with heterogeneous consumers and evolving annotation types.

**LLVM** ([llvm.org](https://llvm.org)). The canonical example, and worth dwelling on because the design choices are unusually explicit and documented. LLVM's central insight was that compiler infrastructure had been rebuilt from scratch for every new language and every new target architecture because each compiler was a direct language-to-machine-code pipeline with no shared intermediate layer. The solution was to define a typed, static single-assignment intermediate representation (LLVM IR) that is rich enough to express the semantics of any language a frontend might compile from, and general enough that any backend can lower it to machine code. The IR is the contract. Frontends (Clang for C/C++, rustc for Rust, swiftc for Swift) are entirely independent of each other and of any backend; backends (x86, ARM, WebAssembly, RISC-V) are entirely independent of any frontend. Analyses and transformations -- dead code elimination, loop unrolling, inlining, alias analysis -- are passes over the IR that any frontend-backend pair inherits automatically.

The critical design discipline is what stays out of the IR. LLVM IR does not contain alias analysis results, inlining decisions, or loop trip counts -- these are derived by passes that run over it. This is not accidental parsimony; it is a hard-won lesson that putting derived information in the core creates consistency and versioning problems. If alias analysis results are in the IR, two tools that compute them differently produce incompatible IRs. If they are a pass, each tool runs its own pass and the IR remains a shared ground truth. The IR contains only what cannot be derived from anything more primitive: the program's type system, its dataflow graph, its control flow structure.

Translated to structural biology: LLVM IR is topology + coordinates + conformational index. Backbone dihedrals, contact maps, spatial neighbor graphs, spherical harmonic features, pair representations -- these are passes. They depend on the core, produce arrays from it, and can be parameterized (cutoff radius, l_max, whether to include waters) without touching the core. Two groups computing neighbor graphs with different cutoffs get different results, and that is fine, because neither result is in the core. The core is stable.

**Apache DataFusion** ([datafusion.apache.org](https://datafusion.apache.org)). Where LLVM is a compiler infrastructure, DataFusion is a query engine infrastructure -- and the distinction matters for the structural biology use case because querying is the access pattern we actually need. DataFusion is a modular execution engine written in Rust, built on Apache Arrow's columnar in-memory format. Its architecture separates: a logical plan (what the query asks for, as a tree of relational operators), a physical plan (how to execute it, with concrete algorithms chosen by an optimizer), and data sources that implement a `TableProvider` trait exposing a schema, a scan method, and optional predicate and projection pushdown.

The pushdown mechanism is the key practical payoff. When a query asks for atoms within 5Å of a ligand where pLDDT > 70, DataFusion's optimizer pushes the pLDDT predicate down into the confidence annotation store and the spatial predicate down into the neighbor index, so only matching chunks are read from either source. The query engine doesn't need to know that one source is a Zarr array and the other is an R-tree index; it only needs the `TableProvider` interface. Adding a new annotation source -- a UniProt feature API, a CATH domain store, a custom validation database -- means implementing `TableProvider` for that source. All existing queries that don't touch it continue to work; queries that join against it automatically get predicate pushdown if the source supports it.

For structural biology, the implication is that molecular selectors should compile to DataFusion logical plan nodes, and each annotation layer should be a `TableProvider`. "Chain A, residues 50--80, in states where the active site is closed, annotated with CATH domain" becomes a join across three sources -- coordinate slices, a conformational state classifier, and a CATH lookup -- with predicates pushed into each independently. The zarr-datafusion crate ([github.com/jayendra13/zarr-datafusion](https://github.com/jayendra13/zarr-datafusion)) already exists as a proof of concept that Zarr arrays can be exposed as DataFusion table sources, meaning the plumbing between the storage layer we want and the query engine we want is already partially built.

**AnnData / MuData** ([anndata.readthedocs.io](https://anndata.readthedocs.io), [mudata.readthedocs.io](https://mudata.readthedocs.io)). The single-cell field's solution to the identical problem: a core count matrix (cells x genes) plus named metadata axes (.obs, .var), with overlay slots (.obsm for embeddings, .obsp for cell-cell graphs) as the plugin layer. MuData extends the pattern to multi-modal data. The Scanpy ecosystem converged on this around 2018--2019 and it now underlies essentially the entire field. It is the closest existing proof that this architecture achieves broad adoption in biology when one high-profile tool adopts it as its native format.

**Entity-Component System** ([bevyengine.org](https://bevyengine.org), used in Bevy, Unity DOTS, Flecs). The cleanest abstract formulation: entities are bare integer IDs; components are typed arrays indexed by entity ID; systems are queries over entities matching some component combination. Adding a new data type means defining a new component; no existing system changes. The query language is structurally identical to molecular selection, and the performance motivation -- avoiding deep inheritance hierarchies -- maps directly onto heterogeneous annotation types that different consumers need in different combinations.

**ONNX** ([onnx.ai](https://onnx.ai)). The ML world's LLVM IR: a stable graph representation that PyTorch, TensorFlow, and JAX can export to and that TensorRT and ONNX Runtime execute. Useful here primarily as a cautionary tale: ONNX accumulated versioning problems because the field kept pushing new operator semantics into the core spec, requiring an explicit opset versioning system as a patch. The lesson is that growth pressure will always push toward expanding the core, and resisting that pressure is an active design discipline, not a default outcome.

**OpenTelemetry** ([opentelemetry.io](https://opentelemetry.io)). Unifies traces, metrics, and logs -- qualitatively different signal types -- under a single data model with backend-specific sinks as plugins. The analogy: experimental validation scores, MD fluctuations, and MS crosslink signals are as different from each other as traces are from metrics, yet all reference the same underlying entities. OpenTelemetry's semantic conventions -- a controlled vocabulary for attribute names and units -- are the direct equivalent of canonical residue identifiers stable across annotation types.

**CF Conventions over NetCDF** ([cfconventions.org](https://cfconventions.org)). Climate science's version: NetCDF provides the array core; the CF Conventions are a community plugin layer specifying standard_name vocabularies, unit conventions, and coordinate semantics. Any CF-compliant file is interoperable with any CF-aware tool regardless of its specific variables. The structural biology parallel is direct -- Zarr as the substrate, community conventions on top specifying axis label semantics, atom-to-residue index mappings, and provenance field names. The CF Conventions took roughly a decade of community iteration to stabilize, which is probably the realistic scope for a structural biology equivalent.



The stability argument for this architecture is worth stating separately. LLVM IR has been remarkably stable for twenty years despite enormous changes in the languages that target it and the hardware that runs it. The stability comes from the IR being genuinely minimal and the plugin interfaces being genuinely sufficient. mmCIF's instability -- the ongoing accretion of IHMCIF extensions, ModelCIF extensions, and the queue of further category proposals -- comes from putting non-core things in the core. Every new experimental method that doesn't fit the existing categories requires a dictionary amendment, a committee process, and a new parser version. A format whose core is only topology + coordinates + conformational index, and whose plugin interface is (selector, typed body, provenance), has no reason to change its core when cryo-ET subtomogram averaging, high-throughput crosslinking MS, or single-molecule FRET produce new data types. They each get a plugin. The core is stable because it is genuinely irreducible.