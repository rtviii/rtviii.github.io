## Research Plan: A Cloud-Native Infrastructure for Molecular Conformational Ensembles

### Thesis

The structural biology data ecosystem is built on the assumption that a macromolecule has one structure. This assumption is encoded in every file format (mmCIF's alt_id), every database (PDB's one-entry-per-experiment), and every visualization tool. Conformational heterogeneity -- from sidechain rotamer flips to large-scale domain motions to continuous distributions over conformational space -- cannot be adequately represented, stored, queried, or shared with existing infrastructure. We propose a new data standard and reference implementation built on three pillars: a molecular query language for flexible selection at any granularity, an annotation system for associating arbitrary data with those selections, and a chunked multidimensional array format with integrated query capabilities for storing and accessing conformational ensembles at scale.

---

### Architecture overview

```
                        MolQL (extended)
                    molecular query language
                             |
                     compiles to DataFusion
                       LogicalPlan + UDFs
                             |
              +--------------+--------------+
              |                             |
     DataFusion query engine         Spatial index
     (predicate pushdown,            (R-tree per state,
      joins across states,            stored alongside
      aggregations)                   coordinates)
              |                             |
              +-------------+---------------+
                            |
                   Zarr v3 storage layer
              (chunked arrays on any backend:
               local, S3, GCS, SSH)
                            |
              +------+------+------+-------+
              |      |      |      |       |
          coords  metadata  annotations  ML features
          (N,A,3) (A cols)  (selector+   (graphs,
                             body+        latent vecs,
                             provenance)  pair reps)
```

---

### Phase 1: Data model specification (months 1-4)

**Goal**: define the schema -- what objects exist, what their relationships are, and how they map onto Zarr groups and arrays.

**1.1 Core molecular representation**

Define the Zarr group layout for a molecular ensemble:

```
ensemble.zarr/
  zarr.json                    # root metadata: species, provenance, source PDB/EMDB IDs
  topology/
    atoms/                     # (N_atoms,) arrays: element, charge, atom_name, etc.
    residues/                  # (N_residues,) arrays: res_name, res_seq, chain_id, etc.  
    chains/                    # (N_chains,) arrays: chain_id, entity_type, sequence
    bonds/                     # (N_bonds, 2) index array + (N_bonds,) bond_order
    hierarchy_map/             # residue_to_atom_range, chain_to_residue_range (index arrays)
  coordinates/
    multiscales/               # OME-Zarr-inspired multiscale pyramid
      all_atom/                # (N_states, N_atoms, 3) float32, chunked
      backbone/                # (N_states, N_residues, 3) CA positions
      domain/                  # (N_states, N_domains, 3) domain centroids
    spatial_index/             # per-state R-tree or k-d tree, serialized
  states/
    metadata/                  # (N_states,) arrays: free_energy, population, source_method
    latent_vectors/            # (N_states, latent_dim) if from cryoDRGN or similar
    transitions/               # sparse (N_states, N_states) transition matrix
  annotations/                 # overlay directory, copick-style
    layer_000/                 # one layer per annotator/source
      index.parquet            # (selector_expr, body_ref, provenance) table
      bodies/                  # actual annotation data (Zarr arrays, JSON, binary blobs)
  ml_features/                 # precomputed features for ML consumption
    graphs/                    # precomputed edge indices at various cutoffs
    pair_representations/      # (N_residues, N_residues, d) if precomputed
    irreps/                    # e3nn-typed features if precomputed
```

**Key design decisions to resolve:**
- Chunking strategy for the (N_states, N_atoms, 3) array: chunk along states (good for "give me state K") vs. chunk along atoms (good for "give me atom J's trajectory") vs. 2D chunking (balanced). Benchmark all three on real data.
- Delta encoding: should we store a reference state + diffs, or full coordinates with compression? Test lossless (zstd, blosc) and lossy (XTC-style truncation to configurable precision) codecs.
- The topology group stores the molecular graph once (it doesn't change between states in most ensembles). For compositional heterogeneity (some states have different molecules present), we need a per-state presence mask.

**Literature to review:**
- H5MD trajectory convention (the closest existing specification for ensemble data in HDF5)
- OME-NGFF specification v0.5 for multiscale conventions, coordinate transforms, labeling
- TileDB-SOMA data model for how single-cell genomics solved a structurally similar problem (cells x genes with metadata on both axes, analogous to states x atoms with metadata on both axes)
- Zarr v3 codec pipeline and sharding codec for small-chunk optimization

**Deliverable**: written specification (RFC-style), validated against 3-4 test datasets: an MD trajectory (DESRES), a cryoDRGN output, a qFit multiconformer set, a cryo-ET dataset with per-particle states.

---

### Phase 2: Query language (months 2-6, overlapping with Phase 1)

**Goal**: extend MolQL for multi-state ensembles and implement it as a DataFusion frontend.

**2.1 MolQL extension design**

Study the MolQL grammar and AST from the Mol* codebase (DeepWiki request needed here). Design extensions for:

- **State selection**: `in state "open"`, `in states where free_energy < -5.0`, `across states 0..100`
- **Cross-state predicates**: `where rmsd(state("A"), state("B")) > 2.0`, `where occupancy > 0.3`
- **Annotation predicates**: `annotated-as "active-site"`, `where annotation("pLDDT") > 90`
- **Correlation predicates**: `correlated-with(resid 50, threshold=0.8)` (requires covariance data)

The extended grammar should be a strict superset of MolQL's current grammar, so existing Mol* queries work unchanged.

**2.2 Compilation to DataFusion**

Write a compiler (Rust, using a parser combinator library like nom or pest) that:

1. Parses the extended MolQL expression into an AST
2. Lowers the AST to a DataFusion LogicalPlan:
   - Column predicates (chain_id, res_seq, element, etc.) become standard Filter nodes
   - State selections become predicates on the state_id column
   - Spatial predicates (within distance) become calls to a registered UDF that consults the spatial index
   - Cross-state predicates become self-joins on the state dimension
   - Annotation predicates become joins with the annotation index table
3. DataFusion's optimizer applies pushdown, simplification, join reordering
4. The physical plan executes against our Zarr TableProvider

**2.3 Zarr TableProvider implementation**

Extend the existing zarr-datafusion crate (or write our own) to:

- Expose the topology arrays as Arrow columns in a virtual table
- Expose coordinates as a (state_id, atom_id, x, y, z) table (flattened from the 3D array)
- Implement `supports_filters_pushdown` for: state_id (Exact -- skip chunks), chain_id/res_seq (Exact if data is sorted/partitioned by chain), spatial predicates (Inexact -- use bounding box from spatial index to skip chunks, DataFusion does exact distance check)
- Return Arrow RecordBatches with the selected atoms' properties and coordinates

**Literature to review:**
- MolQL specification and Mol* implementation (DeepWiki)
- zarr-datafusion crate implementation
- DataFusion custom TableProvider documentation and examples
- DataFusion UDF registration for custom functions (spatial predicates)
- How PostGIS implements spatial predicate pushdown (the R-tree + bounding-box-filter + exact-check pattern is well-established)

**Deliverable**: a Rust crate (`molql-datafusion`) that parses extended MolQL, compiles to DataFusion plans, and executes against Zarr stores. Python bindings via pyo3.

---

### Phase 3: Annotation system (months 4-8)

**Goal**: implement the (selector, body, provenance) annotation model with copick-style overlays.

**3.1 Annotation data model**

Each annotation layer is a directory within the ensemble's `annotations/` group:

```
annotations/
  layer_000/
    manifest.json              # layer metadata: author, method, software, date, description
    index.parquet              # table: (annotation_id, selector_expr, body_type, body_ref)
    bodies/
      scalars.zarr             # per-atom or per-residue scalar annotations (e.g., pLDDT)
      text/                    # free-text notes keyed by annotation_id
      structured/              # JSON blobs keyed by annotation_id
      arrays/                  # array-valued annotations (displacement vectors, etc.)
```

The `index.parquet` table is queryable via DataFusion. Finding all annotations on a given selection is a join between the query result and the annotation index.

**3.2 Overlay filesystem**

Adopt copick's overlay pattern: the ensemble data (coordinates, topology) is read-only. Annotation layers are writable. Multiple layers can coexist. A configuration file specifies which layers are visible. This enables: multiple annotators working on the same ensemble, provenance tracking per layer, easy sharing/publishing of annotation layers separately from the data.

**3.3 Selector persistence and evaluation**

Selectors are stored as MolQL expression strings in the annotation index. When an annotation is queried, the selector is compiled and evaluated against the current state of the data. This means annotations are portable across different representations of the same molecule (as long as the selector references canonical identifiers like UniProt residue numbers rather than PDB-specific numbering).

**3.4 Ontology integration**

Define a small core ontology for annotation types (structure validation, functional site, conformational state, confidence score, experimental evidence, ML prediction). This is not a heavyweight formal ontology -- it's a controlled vocabulary with a few dozen terms, extensible by users. Each annotation body declares its type from this vocabulary.

**Literature to review:**
- copick data model and overlay architecture in detail (DeepWiki)
- Genome browser track hub specification (how distributed annotation hosting works)
- Parquet as annotation index format: predicate pushdown, column projection, compatibility with DataFusion
- The Coot residue annotation implementation by Oli Clarke (how mmCIF categories were used)
- AnnData/Scanpy annotation model for single-cell data (obs/var DataFrames attached to expression matrices) -- structurally similar to our atom-metadata + annotation pattern

**Deliverable**: a Python/Rust library (`ensemble-annotate`) implementing: create/read/write annotation layers, evaluate selectors against ensembles, query annotations, merge layers. Integration with the MolQL query engine from Phase 2.

---

### Phase 4: Heterogeneity representation (months 3-8, parallel with Phases 2-3)

**Goal**: design and implement the data model for conformational landscapes -- the DAG of states, transitions, and multi-scale descriptions.

**4.1 State graph model**

Define how conformational states relate to each other:

- **States** are nodes in a directed graph, each pointing to a slice of the coordinate array
- **Transitions** are weighted directed edges with metadata: rate constant, free energy barrier, experimental evidence, method (MD, NMR exchange, cryo-EM classification)
- **Hierarchical states** -- states can be grouped into clusters (coarse-grained states), forming a multi-level graph. This is the MSM coarse-graining pattern (PCCA+).

Storage: the graph is stored as a sparse adjacency matrix in Zarr (for the transition weights) plus a metadata table in Parquet (for per-state properties: free energy, population, cluster assignment, latent vector). For small graphs (<10k states), this is trivially fast. For large graphs (millions of MD frames), we store the graph at multiple resolutions (raw frames -> microstates -> macrostates) using the multiscale pyramid pattern.

**4.2 Continuous distributions**

For cryoDRGN-style results, the conformational landscape is not a finite set of states but a continuous distribution parameterized by a neural decoder. We store:

- The trained decoder network (TorchScript `.pt` file) as a binary blob in the ensemble
- The per-particle latent vectors as a (N_particles, latent_dim) Zarr array
- Metadata: latent space dimensionality, training parameters, source dataset
- Optionally: a discretization of the landscape (sampled states along PCA/UMAP axes) for visualization and approximate queries

**4.3 Correlated motions**

Store the covariance matrix of atomic fluctuations as a sparse (N_atoms, N_atoms) array. For large molecules, the full matrix is impractical -- store it as: a low-rank factorization (PCA components), or per-domain blocks, or as a graphical model (which pairs of residues are correlated, with what strength).

**Literature to review:**
- PyEMMA / deeptime MSM data structures and serialization formats
- PCCA+ for coarse-graining state spaces
- KeplerMapper for topological summaries of conformational landscapes
- The IHM dictionary's `_ihm_multi_state_modeling` and `_ihm_ordered_ensemble` categories -- understand exactly what they can and cannot express, so we can design a strict superset
- cryoDRGN's model serialization and latent space analysis tools (DeepWiki)
- Sparse covariance estimation methods (graphical LASSO, etc.) for large molecular systems

**Deliverable**: extension to the Zarr schema from Phase 1 covering state graphs, continuous distributions, and correlation data. Python API for constructing, querying, and visualizing conformational landscapes.

---

### Phase 5: ML integration (months 6-10)

**Goal**: make the format directly consumable by GNN-based structure models with minimal preprocessing.

**5.1 Graph construction from stored data**

Instead of storing precomputed graphs (which are model-dependent), store the ingredients for fast graph construction:
- The spatial index (R-tree per state) enables O(k log N) neighbor lookups
- The topology (bonds, residue membership) is stored explicitly
- A thin Python/Rust library constructs PyG `Data` objects on-the-fly from a MolQL selection + a state ID, using the spatial index for edge construction

Benchmark this against: Graphein's current PDB-file-based pipeline, and precomputed edge lists stored in the format.

**5.2 DataLoader integration**

Write a PyTorch `IterableDataset` that:
- Takes a MolQL selection and a list of state IDs (or "all states")
- Evaluates the selection via DataFusion to get atom indices
- Reads coordinate chunks for random batches of states (Zarr random access)
- Constructs PyG graphs in a worker process
- Returns batches ready for training

This should saturate GPU utilization -- the goal is that I/O and preprocessing never bottleneck training.

**5.3 Ensemble-aware training data**

Define conventions for how ensembles are packaged as ML training data:
- For structure prediction training: (sequence, ensemble of states, population weights)
- For NNP training: (coordinates, energy, forces, stress) per state
- For conformational dynamics prediction: (state_i, state_j, transition_rate) pairs

These conventions are metadata in the Zarr schema, not format changes. A training framework reads the convention metadata and knows how to interpret the arrays.

**Literature to review:**
- PyG Dataset/DataLoader internals and performance characteristics
- OCP/OMol25 LMDB approach and benchmarks
- WebDataset / Mosaic StreamingDataset for streaming training data
- Graphein's pipeline and where the bottlenecks are (DeepWiki if available)
- e3nn Irreps serialization

**Deliverable**: a Python library (`ensemble-ml`) providing PyG DataLoaders, graph construction, and feature extraction from ensemble Zarr stores.

---

### Phase 6: Visualization and interop (months 8-12)

**Goal**: make the format viewable in existing tools and provide converters to/from existing formats.

**6.1 Mol* plugin**

Write a Mol* extension that reads our Zarr format directly (via zarr.js or tensorstore-wasm). The state dimension becomes a slider in the UI. Annotations are overlaid. MolQL queries highlight selections.

**6.2 ChimeraX / Napari plugins**

Python-based, using our Python API. ChimeraX gets the molecular visualization; Napari gets the tomographic visualization (if density maps are included).

**6.3 Format converters**

- mmCIF/PDB -> our format (single state, topology extraction)
- MD trajectories (XTC, DCD, H5MD) -> our format (multi-state)
- cryoDRGN output -> our format (latent space + decoder)
- qFit multiconformer models -> our format (discrete states from alt_ids)
- copick datasets -> our format (cryo-ET annotations)
- Our format -> mmCIF (export single state or multi-state via IHM dictionary)

---

### Implementation language and dependencies

**Core library (Rust):**
- Zarr I/O: `zarrs` crate
- Query engine: `datafusion` crate
- MolQL parser: `pest` or `nom`
- Spatial indexing: `rstar` crate
- Arrow interop: `arrow-rs`
- Python bindings: `pyo3`

**Python layer:**
- `zarr-python` for high-level Zarr access
- `pyarrow` for Arrow interop
- `torch` for ML integration
- `torch_geometric` for graph construction
- `dask` for out-of-core operations on large ensembles

**Specification format:**
- RFC-style markdown documents, versioned in git
- JSON Schema for Zarr metadata conventions
- Community review process modeled on OME-NGFF's RFC process

---

### Benchmark datasets for validation

1. **MD ensemble**: DESRES long-timescale ubiquitin or BPTI trajectory (~1M frames, ~1k atoms)
2. **cryoDRGN output**: pre-catalytic spliceosome or ribosome (latent space + decoder + particles)
3. **qFit multiconformer**: SARS-CoV-2 Nsp3 macrodomain series (Wankowicz/Fraser)
4. **Cryo-ET**: CZ Data Portal phantom dataset (5 protein species, copick annotations)
5. **Large assembly**: nuclear pore complex or ribosome with multiple functional states from PDB-IHM
6. **NNP training set**: a subset of Materials Project or OMol25 (to test generality beyond structural biology)

---

### DeepWiki requests (immediate)

1. **Mol* / MolQL**: grammar specification, AST structure, how selections compile to operations on the internal data model
2. **copick**: full data model (CopickRoot, CopickRun, objects, overlay resolution), how multi-user annotation conflicts are handled
3. **zarrs (Rust Zarr implementation)**: codec pipeline, sharding support, performance characteristics
4. **cryoDRGN**: model serialization format, latent space data structures, how particles map to latent vectors

Which of these should I formulate into specific DeepWiki questions first?