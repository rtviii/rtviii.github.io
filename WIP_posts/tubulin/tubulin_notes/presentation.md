# Why design a tool for specific macromolecule?

Uniprot, Pfam are "flat" structures vis-a-vis the atomic models. There is value
in building a layer in between.

- want to centralize computations around the data, but not reinvent other
  tools. whati s the right balance?

- data sovereignty within the community

# General structural biology & bioinformatics operations:

- align sequences
- look up
- .. 
- ligand binding

# Target specific structural biology & bioinformatics operations:

## Tubulin:

- libraries of cleaned-up ligands ready to go (via rosetta)
- ..
- ..

# Sea change due to the deep learning models

- molecular dynamics
- neural force fields
- evo2
- alphafold
- esmfold

# MCPs

slide: the layers of tools and their evolutions wrt each other over time
last slide: where this is going (deep learning models, czii cryoet)
go through charlie harris's db: design companies

# Ontology | General:

- connective tissue in a fragmented ecosystem (Structural:(pfam, uniprot, pdb, etc.), Bioinformatics:(blast, clustal, etc.), Computational:(rosetta, pymol, etc.), Deep Learning:(alphafold, esmfold, etc.), Molecular Dynamics:(gromacs, namd, etc.), cryoEM/ET:(modelangelo))

- sovereignty and facility for future models (_ELABORATE_)

assembling hybrid/chimeric microtubules

-----

- instant retrieval of the binding site only for further dokcing/simulation/md

Our crystallographic fragment screen now revealed four sites that are targeted by both fragments and secondary structural elements of major cellular microtubule regulators including tau, dynein, kinesin-13, kinesin-5, TPX2, and CPAP/SAS-4.

-----

Regarding MAPs (Microtubule-Associated Proteins), there are dozens of well-characterized MAPs that have been studied worldwide. They can be broadly categorized into:

Structural MAPs: Including MAP1, MAP2, MAP4, tau proteins
Motor proteins: Kinesins (40+ members) and dyneins
Plus-end tracking proteins (+TIPs): EB1, CLIP-170, CLASP
Minus-end targeting proteins (-TIPs): CAMSAPs/Patronin
Microtubule nucleators and organizers: γ-tubulin and associated proteins
Microtubule-severing proteins: Katanin, spastin, fidgetin
Destabilizing proteins: Stathmin, kinesin-13 family

The exact number of MAPs that have been characterized is difficult to specify precisely, as new ones continue to be discovered and characterized at varying levels of detail. The field likely encompasses 100-200 distinct proteins that directly interact with microtubules, with the most extensively studied numbering several dozen.

-----


# Tools

https://pymolwiki.org/index.php/Pytms
https://pubmed.ncbi.nlm.nih.gov/37902126/



# DBs

https://pmc.ncbi.nlm.nih.gov/articles/PMC10707541/pdf/pone.0295279.pdf

https://research.bioinformatics.udel.edu/iptmnet/




/-----------/

I'm building a platform that would facilitate the handling of TUBULIN and MT data and extraction of information (sequence and structural, but also correlative, ligand, dynamics) from the available 3D structures and density maps. 

Basically i've developed something of smaller scale for the ribosomal data and want to apply a similar architecture as before. In few short steps:
- reclassify the availalbe sequences according to a standardized classificatio nnomenclature (this will have to be developed since none is proposed)
- build HMMs for these classes
- a neo4j database graph database for tracking semantic data, conecting of the PDB strucutres with sequence classes, ligands, etc.
- a backend with the twofold function: 1. communicating with thd database and providing an API to all the indexed/reindexed data. 2. setting up interfaces for further enriching data and running computations, simulatons on it (seq to structure via folds, PTMs reconstruction, ligand docking, molecular dynamics etc.)


From the point of view of the tubulin community, intimately familiar with the molecule: What biologically relevat operations, loci and knowledge should this application possess? What classifications should it make?






[atoms]
; acetylated lysine (ALY)
; nr  type  resnr  resid  atom  cgnr  charge  mass
1    N     1      ALY    N     1     -0.3479  14.0067
...
8    CE    1      ALY    CE    8     -0.0015  12.011  ; modified from standard LYS
9    NZ    1      ALY    NZ    9     -0.6510  14.0067 ; substantially different charge
10   HZ    1      ALY    HZ    10    0.3400   1.008   ; reduced from 3 to 1 hydrogen
11   C1    1      ALY    C1    11    0.7286   12.011  ; acetyl carbon (new)
12   O1    1      ALY    O1    12   -0.5894   15.9994 ; acetyl oxygen (new)
13   C2    1      ALY    C2    13   -0.2400   12.011  ; methyl group (new)
...



[bonds]
; acetyl group bonds
NZ  C1   1    1.335   418400   ; amide bond parameters
C1  O1   1    1.229   476976   ; carbonyl parameters
C1  C2   1    1.522   265265   ; carbon-carbon bond



[angles]
; modified angles for acetyl group
CE  NZ  C1   1   123.5   418.4
NZ  C1  O1   1   122.9   669.4   ; amide plane geometry
NZ  C1  C2   1   115.2   585.8


[dihedrals]
; proper dihedrals
CE  NZ  C1  O1   9   180.0   10.5   2   ; keep acetyl group planar