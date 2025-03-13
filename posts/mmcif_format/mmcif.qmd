


# Background | The Unfurling Landscape of Structural Biology


### What's the problem that needs solving?

Data organization at the confluence of CryoET, protein and rna engineering and LLMs' ability to manipulate types/ontologies.

- gargantuan-scale images at angstrom-resolution
- digital twins
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

Does any kind of study benefit from this *improved* substrate?

Yes, i think compositional and conformational heterogeneity studies would be impossible without a framework under which to track the artifacts. By that, i mean studies of type "motion of molecule X in the presence of Y" or "conformational change of Z in the presence of W", spliceosome .



- "modularity at biological hierarchy boundaries"
- Who is going to use it?
- Who is going to pay you for it?
- What is the job here that won't need doing in 5-10 years?
- What is the job that will need doing doing in 5 years but doesn't exist now?


entity_poly_seq can't be mandatory since you can produce a mmCIF file without any polymeric molecular entity. You could write a mmCIF file with a single ion in it, no protein, no nucleic acid and it still would be a valid mmCif file while that file can't have entity_poly_seq because... no polymer ;) I guess once you have a linear polymer in a mmCIF file, entity_poly_seq should be in there, too.__ That can't be reflected by mmCIF dictionaries since they don't know conditionals.___


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
Here the  gemmi guy trying to connect his work to chimerax and stumbling over this : https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/
https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering

Old tune, but the eminence of AF/Rosetta/etc. recognized with the nobel (not saying it's right or wrong) contrasted to the quality of the "dataset" they spring from, which is just what the PDB is increasingly is pretty staggering to me. They are stuck in 2000s. I'd bet an eye that if not for the institutional inertia and the OneDeposition workflow, a single company like Meta or HuggingFace or one of amazon's 100 bio divisions could come up with a better solution in a span of year. By better i mean support for binary, direct integration with source em-maps, sane modern format, biological hierarchy integration and much MUCH richer data points: in terms of landmarks and shapes like we are doing or something more chemically minded a la Wilson/Polikanov or something dynamism-minded a la cryodrgn. It is crazy crazy crazy that people use 5-10mil$ machines from the cutting edge of science, thousands of dollars worth of cloud computer and i dont know how many biologist human hours to arrive at a crappy plaintext file almost entirely untethered to the fabric from which it came.

I think every day about what CZII is going to do the moment they are consistely getting 3-4A subtomograms and need to "deposit" 1000 ribosomes at once for some horizontal study of a mouse brain cancer cell or something. Whatever it is it's not PDB.

- just shitty documentation, no automatic schema, ad-hoc updates, no explanation for datatypes

https://github.com/google-deepmind/alphafold/issues/252

https://github.com/wwpdb-dictionaries/mmcif_pdbx/issues

Ex. here are guys from model-angelo ( GNN for model building that chenwei looked at) fixing this on their onw : https://github.com/3dem/model-angelo/issues/51
Here is Deep Mind implementing their own parser https://huggingface.co/spaces/simonduerr/ProteinMPNN/blob/f969e9cfb6f11ba299c7108aadff124e9cf38b1f/alphafold/alphafold/data/mmcif_parsing.py
Here the  gemmi guy trying to connect his work to chimerax and stumbling over this : https://mail.cgl.ucsf.edu/mailman/archives/list/chimerax-users@cgl.ucsf.edu/thread/XOO3G5MUOHLQBHSVF2NENWYNG3SOUF2O/
https://bioinformatics.stackexchange.com/questions/14210/pdb-residue-numbering
https://proteopedia.org/wiki/index.php/Unusual_sequence_numbering
"""

- 5afi.y is a trna sequence but is tagged with "F" at the end just because it
 carreis a phenylalanine. How crazy is that. No respect for the
 standardization of RNA alphabet.
