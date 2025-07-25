
---- TO INVESTIGATE FURTHER ----
#### OVERALL
#### OVERALL



# Intro Topics


- outline the rough product that you are aiming for, an integrative platform that has a generally applicable library in the backend and a visualization platform. 
- it's important to index all avaialble data in a way that is easily accessible and searchable
- would be nice for the method of indexing to be future-proof/extendable to new datasets.
- enumerate the datatypes/databases that you'll be speaking about to draw some boundaries 

# Sequence Block

Isotypes characterization by species & cell types
PTMS characterization by species, cell types and isotypes

- Start with broad family HMMs (alpha, beta, etc.)
    For each family.
    - Collect all matching sequences
    - Perform clustering (try several thresholds)
    - Build phylogenetic trees to identify natural groups
    - Extract C-terminal regions and cluster them separately
    - Compare these different clustering results

Where clusters agree across methods, define these as strong sub-families
Build HMMs for these sub-families
Test with known examples to evaluate discrimination power
Iteratively refine as needed

The above for families of tubulins and, separately, for families of MAPs. Stathmin-lke

--------------

- PTMs possibly included into clustering/families/searches via ProForma Notation
- search/discovery in a single modality instead of searching across various dbs, fasta files, mass spec records etc.

--------------

Helices as domain "views" into families.

# Control Layer

- introduce neo4j graph database as a way to keep track of semantic data and connect it to the structural models


# Structural Domain


Index PDB structures and incorporate them into the graph according to the sequence block. 

- introduce capabilities of molstar as the the visualizing applications. 
- Raise interactivity-vs-generality tradeoff
- search/navigation/visualization/comparison of the above 
- comparison/alignment (across what? sequences)
- ligand binding sites



Then go more indepth to augmneting each of the individual following aspects of the data at scale: 

### Creating 3D structures of proteins from from sequences via AlphaFold


### PTM Reconstruction workflows
    Reconstructing PTMs on top of a template structure via:
      - Rosetta/
      - PSIptm

### Ligand Binding Sites
    Fragments 
    Ligands Classification via 
    Binking Pokets, Sites

### Applications for Model building:

    - HMM families-based deep learning models for automating CryoEM model building :
        https://www.nature.com/articles/s41586-024-07215-4
        https://www.biorxiv.org/content/10.1101/2025.03.16.643561v1
        https://www.biorxiv.org/content/10.1101/2024.11.13.623164v1.full.pdf

### MD applications

