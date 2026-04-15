Rewriting the file "on the fly" is hard due to lack of modularity and other:

- trajectories for a single chain
- adding a few waters etc.

# Background | The Unfurling Landscape of Structural Biology

### What's the problem that needs solving?

Data organization at the confluence of CryoET, protein and rna engineering and LLMs' ability to manipulate types/ontologies.

- gargantuan-scale images at angstrom-resolution
- [structural] "digital twins"
- molecular force fields
- near-perfect polymer folding
- ligand/binding affinity prediction

Interfaces between

- MD
- EM/Crystallography
- atomic/crystallographic data encoding
- sequence

### What our part in it might be:

The implicit proposition here is that by having a common substrate (what is it?
a format? a framework? a type system? a library? an application?) the friction
is reduced.

Does any kind of study benefit from this _improved_ substrate?

Yes, i think compositional and conformational heterogeneity studies would be impossible without a framework under which to track the artifacts. By that, i mean studies of type "motion of molecule X in the presence of Y" or "conformational change of Z in the presence of W", spliceosome .

- "modularity at biological hierarchy boundaries"
- Who is going to use it?
- Who is going to pay you for it?
- What is the job here that won't need doing in 5-10 years?
- What is the job that will need doing doing in 5 years but doesn't exist now?

entity_poly_seq can't be mandatory since you can produce a mmCIF file without any polymeric molecular entity. You could write a mmCIF file with a single ion in it, no protein, no nucleic acid and it still would be a valid mmCif file while that file can't have entity_poly_seq because... no polymer ;) I guess once you have a linear polymer in a mmCIF file, entity_poly_seq should be in there, too.** That can't be reflected by mmCIF dictionaries since they don't know conditionals.\_**

# Semi-useful Links

https://github.com/chanzuckerberg/cryoet-data-portal-backend/blob/main/schema/v1.1.0/metadata-docs/TiltSeries.md
https://github.com/chanzuckerberg/cryoet-data-portal-backend/tree/main/schema/v1.1.0
https://ngff.openmicroscopy.org/about/index.html
https://datascience.codata.org/articles/10.5334/dsj-2016-003

## Format Specs

https://www.iucr.org/resources/cif
https://datascience.codata.org/articles/10.5334/dsj-2016-003

## Formal specs

https://www.iucr.org/resources/cif/cif2
https://www.iucr.org/resources/cif/spec/version1.1
https://legacy.ccp4.ac.uk/newsletters/newsletter37/13_harvest.html

## Implementations and random docs

https://www.ccp4.ac.uk/html/cciflib.html
http://comcifs.github.io/cif_api/index.html

## History of

https://www.ccp4.ac.uk/html/mmcifformat.html

- Implementation of Data Harvesting in the CCP4 Suite : https://legacy.ccp4.ac.uk/newsletters/newsletter37/13_harvest.html

"HARVESTING" :https://www.ccp4.ac.uk/html/harvesting.html

### Complaining

format spec is ugly, says biopython developer: https://stackoverflow.com/a/11686524/10697358
People routinely write their own parsers to reconcile these and curse the design choices and lack of documentation.
Ex. here are guys from model-angelo ( GNN for model building that chenwei looked at) fixing this on their onw : https://github.com/3dem/model-angelo/issues/51
Here is Deep Mind implementing their own parser https://huggingface.co/spaces/simonduerr/ProteinMPNN/blob/f969e9cfb6f11ba299c7108aadff124e9cf38b1f/alphafold/alphafold/data/mmcif_parsing.py
Here the gemmi guy trying to connect his work to chimerax and stumbling over this : https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/
https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering

Old tune, but the eminence of AF/Rosetta/etc. recognized with the nobel (not saying it's right or wrong) contrasted to the quality of the "dataset" they spring from, which is just what the PDB is increasingly is pretty staggering to me. They are stuck in 2000s. I'd bet an eye that if not for the institutional inertia and the OneDeposition workflow, a single company like Meta or HuggingFace or one of amazon's 100 bio divisions could come up with a better solution in a span of year. By better i mean support for binary, direct integration with source em-maps, sane modern format, biological hierarchy integration and much MUCH richer data points: in terms of landmarks and shapes like we are doing or something more chemically minded a la Wilson/Polikanov or something dynamism-minded a la cryodrgn. It is crazy crazy crazy that people use 5-10mil$ machines from the cutting edge of science, thousands of dollars worth of cloud computer and i dont know how many biologist human hours to arrive at a crappy plaintext file almost entirely untethered to the fabric from which it came.

I think every day about what CZII is going to do the moment they are consistely getting 3-4A subtomograms and need to "deposit" 1000 ribosomes at once for some horizontal study of a mouse brain cancer cell or something. Whatever it is it's not PDB.

- just shitty documentation, no automatic schema, ad-hoc updates, no explanation for datatypes

https://github.com/google-deepmind/alphafold/issues/252

https://github.com/wwpdb-dictionaries/mmcif_pdbx/issues

Ex. here are guys from model-angelo ( GNN for model building that chenwei looked at) fixing this on their onw : https://github.com/3dem/model-angelo/issues/51

Here is Deep Mind implementing their own parser 
https://huggingface.co/spaces/simonduerr/ProteinMPNN/blob/f969e9cfb6f11ba299c7108aadff124e9cf38b1f/alphafold/alphafold/data/mmcif_parsing.py

Here the gemmi guy trying to connect his work to chimerax and stumbling over this : https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/

https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering

https://proteopedia.org/wiki/index.php/Unusual_sequence_numbering
"""

- 5afi.y is a trna sequence but is tagged with "F" at the end just because it
  carreis a phenylalanine. How crazy is that. No respect for the
  standardization of RNA alphabet.

https://docs.rosettacommons.org/docs/latest/development_documentation/tutorials/robust

Stephanie Wankowitz:

https://diffuse.science/posts/encoding/
--> https://pmc.ncbi.nlm.nih.gov/articles/PMC11220883/pdf/m-11-00494.pdf
https://x.com/stephanie_mul/status/1955319804539150665

To go over: 
-https://pubmed.ncbi.nlm.nih.gov/40586518/ 
-https://pmc.ncbi.nlm.nih.gov/articles/PMC12208665/pdf/elife-103797.pdf 
-https://arxiv.org/pdf/2505.01919

`Translation, Librations, Screws`

https://onlinelibrary.wiley.com/doi/abs/10.1107/S0567740868001718

Diego del Alamo:

```
To give one example, if you receive a model of an antigen against which you want to design antibodies, and some of the surface loops look weird, you'd like to know if they are justified by experimental data or were modeled w/ Rosetta, AF3, etc, ...

.. because you don't want to design against some computational artifact. If you got the model from a human, that's fine, you can go ask. But structbio agents are ephemeral and can't be consulted a week later. So ideally that info gets stuffed in the PDB/CIF header. ...

... But then that raises the question of how much metadata you can pack in there. Are you putting in MSAs? Etc. Anyway my guess is that this will soon be scaled up such that human supervision becomes unwieldy, so an agent should be able to answer these kinds of questions
```

Gabriele Corso:

"Is anyone developing open-source MCP frameworks for llms to parse and understand biomolecular structures accurately? If so, please reach out to me, i would love to discuss, help and support!"

---

ML features:

- **Native graph representations** with k-nearest neighbor graphs, edge type annotations, and node features for GNNs like GearNet and DeepRank-GNN
- **Multi-resolution tokenization** (AlphaFold 3 uses flexible schemes: standard residues as single tokens, modified residues as atoms, ligands as individual atoms)
- **Pre-computed MSA embeddings** as feature channels
- **Confidence metrics** (pLDDT, PAE) as first-class data alongside coordinates
- **Versioned model parameters** linking predictions to the networks that generated them

? Can this also be used a "paging cache" for the QKV store of transformers etc, msa embeddings that would facilitate modern models' operation?

# atomworks

https://rosettacommons.github.io/atomworks/latest/tutorial/index.html

#--------


Verification of Your Points

From the RCSB documentation and the PDBx/mmCIF standard:
1. Entity vs. Instance (Chain) Logic

    The Rule: A PDB Entity is defined by its chemical sequence. If two chains have the exact same sequence of amino acids or nucleotides, they are Instances of the same Entity.

    Variability: If there is any difference in the chemical sequence (a mutation, a different construct, or even a different species), they must be assigned to different Entities.

    Note on "Missing" Data: If Chain A and Chain B have the same underlying sequence, but Chain A is missing residues 1–10 in the density while Chain B is complete, they are still the same Entity. The entity represents the chemical molecule present in the experiment, not just what was successfully modeled.

2. auth_seq_id (The "Author" Numbering)

The documentation confirms your block of text is 100% correct:

    Author-Assigned: It is the numbering provided by the researcher to match literature or UniProt.

    Arbitrary & Gapped: It does not have to be sequential. It can start at -5, have a gap from 20 to 50, and use "insertion codes" (e.g., 100A, 100B).

    Differing between Chains: This is the crucial part. Even if two chains are the same Entity, the author can give them different auth_seq_id ranges (e.g., Chain A is 1-100, Chain B is 201-300).

    *Mol Behavior:** Mol* (and most viewers) defaults to auth_seq_id because that's what biologists recognize from papers, whereas label_seq_id is the strict, software-friendly 1, 2, 3... count.

Summary Table for Quick Reference
Feature	label_seq_id (Canonical)	auth_seq_id (Author)
Starts at	Always 1	Anywhere (negative, 0, 100...)
Gaps	Not allowed (must be continuous)	Allowed
Consistency	Same for all instances of an entity	Can differ between chains
Viewer Default	Used for internal data mapping	Default for 3D selection/labe

https://www.rcsb.org/docs/general-help/identifiers-in-pdb

<!-- https://www.sciencedirect.com/science/article/pii/S0959440X26000394?via%3Dihub -->

https://bsky.app/profile/olibclarke.bsky.social/post/3micblpuoxc2u

----

Molq: arbitrary structural queries
Oli Clarke: per residue annotations 
Stephanie Wankowitz: md and ensemble data
TileDB, zarr, cryoet and em data...
Formal methods? ha-ha