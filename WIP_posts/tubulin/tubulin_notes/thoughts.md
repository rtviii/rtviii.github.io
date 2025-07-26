Tubulin Database Application Design
From the perspective of the tubulin research community, here are the key elements your database application should incorporate:
Structural Classifications

Isotype tracking: Alpha/beta/gamma tubulin variants with their distinct structural features
PTM mapping: Comprehensive post-translational modification sites (acetylation, tyrosination, polyglutamylation, etc.)
Conformational states: Straight vs. curved, GTP vs. GDP-bound states
Lattice arrangements: A vs. B lattice, protofilament number variations (13 vs. non-13)
Interface classifications: Lateral and longitudinal contact regions
Seam structures: Variations in microtubule seam architecture

Biologically Relevant Operations

PTM pattern search: Query by specific modification patterns
Structural alignment tools: Compare conformational changes between states
Pharmacological binding site analysis: Drug interaction surfaces
MAP binding region identification: Sites for motor proteins and other MAPs
Evolutionary conservation mapping: Highlight conserved regions across species
Disease-associated mutation correlation: Link mutations to structural changes

Critical Loci

Nucleotide binding pockets: GTP/GDP binding sites
## drug-binding domains
## Exchangeable vs. non-exchangeable nucleotide sites
## Highly variable regions subject to most PTMs
## Critical for polymerization dynamics
Loop regions: T5, H1-S2, M, etc. that change conformation during dynamics

Additional Functionalities

Filtering: Feature-navigable  structural data
Experimental method classification: Cryo-EM vs. X-ray crystallography sources
Taxonomic organization: Species-specific tubulin structures
Integrated visualization: Direct linking to molecular viewers with highlighting options

Would you like me to expand on any particular aspect of this database design?

#  PTMS

#### Acetylation

Chemistry: Addition of an acetyl group (-COCH₃)
Location: Primarily occurs on lysine-40 of α-tubulin in the microtubule lumen
Persistence: Marks stable, long-lived microtubules
Function: Increases microtubule mechanical resilience, affects kinesin binding
Structures: PDB entries like 5JCO and 6U42 show acetylated tubulin

#### Detyrosination/Tyrosination

Chemistry: Removal of C-terminal tyrosine from α-tubulin (detyrosination), followed by possible re-addition (tyrosination)
Location: Extreme C-terminal tail of α-tubulin
Persistence: Detyrosination accumulates on stable microtubules
Function: Regulates interactions with +TIPs, CAP-Gly proteins, and some motors
Structures: Mostly studied through biochemical methods as CTTs are often disordered in crystal structures

#### Glutamylation

Chemistry: Addition of glutamate side chains (1-6+ units)
Location: Glutamate residues in both α- and β-tubulin CTTs
Persistence: Variable, can be dynamically regulated
Function: Regulates motor trafficking, severing enzyme activity (spastin, katanin)
Structures: Challenging to visualize in structural studies due to CTT flexibility

#### Glycylation

Chemistry: Addition of glycine residues (1-34+ units)
Location: Similar sites as glutamylation on CTTs
Persistence: Predominant in stable ciliary and flagellar microtubules
Function: Critical for ciliary and flagellar stability
Structures: Limited structural data due to CTT flexibility

#### Phosphorylation

Chemistry: Addition of phosphate group to serine, threonine, or tyrosine
Location: Various sites including Ser172 on β-tubulin
Persistence: Dynamic, often cell-cycle regulated
Function: Can inhibit microtubule assembly, regulates dynamics
Structures: Some phosphorylated sites visible in structures like 3EDL

#### Methylation

Chemistry: Addition of methyl groups to lysine or arginine residues
Location: Various sites in the globular domain
Persistence: Less characterized than other PTMs
Function: May affect protein-protein interactions
Structures: Limited structural information

#### Palmitoylation

Chemistry: Attachment of palmitic acid via thioester bond to cysteine
Location: Cysteine residues, particularly Cys376 in α-tubulin
Persistence: Reversible lipid modification
Function: May affect membrane association
Structures: Difficult to capture in crystal structures

#### Succinylation/Malonylation

Chemistry: Addition of succinyl or malonyl groups to lysine residues
Location: Various lysine residues throughout tubulin
Persistence: Newly characterized, less understood
Function: May affect protein stability and interactions
Structures: Limited structural data

#### Citrullination

Chemistry: Conversion of arginine to citrulline
Location: Arginine residues throughout tubulin
Persistence: Generally stable modification
Function: May affect microtubule stability
Structures: Limited structural information

#### MARylation (Mono-ADP-ribosylation)

Chemistry: Addition of ADP-ribose from NAD⁺
Location: Various residues including glutamate and arginine
Persistence: Reversible, can be rapidly regulated
Function: Often stress-responsive, can affect protein interactions
Structures: Few structures available

Viewing These PTMs
Most high-resolution structures of tubulin (like 1TUB, 6EVW, 5SYF) don't include the complete CTTs where many PTMs occur, as these regions are intrinsically disordered. However, you can find structures capturing some PTMs:

For acetylated tubulin, check PDB entries like 5JCO
For phosphorylated sites, structures like 3EDL show some sites
The Protein Data Bank (PDB) contains numerous tubulin structures, but only a fraction capture PTMs

For many of these PTMs, structural visualization is challenging because:

The CTTs are highly flexible
Many PTMs are transient
Sample preparation for crystallography often removes these modifications

Researchers often use molecular dynamics simulations to model how these PTMs might affect tubulin structure and interactions when direct structural data is unavailable.


# Databases

https://proteininformationresource.org/resid/
PhosphoSitePlus
Tubulin Database


#TODO: What formats do PTM databases and __mass spec__ use?


------



# Isotypes

You've hit on an important point about the relationship between structural biology and the broader knowledge of tubulin biology. Your instinct is correct - this approach is actually becoming more realistic and is happening in advanced tubulin research.

What you're describing is essentially a form of "computational reconstruction" or "biologically-informed modeling" that combines:

    The structural scaffold from cryo-EM
    Biochemical/proteomic knowledge of isotype composition
    Prior knowledge about isotype-specific sequence differences

This approach is indeed being used by specialized tubulin researchers. Here's how it works in practice:

    Mass spectrometry or other techniques determine the precise isotype composition of a particular cellular structure (e.g., "this cilium contains 60% TUBA1A, 25% TUBA4A, 10% TUBA8, 5% TUBA3C")
    The cryo-EM structure provides the overall architecture and placement of subunits
    Researchers can then create computational models that distribute these isotypes according to:
        Known preferences for certain positions in the lattice
        Known partner preferences (some α-isotypes preferentially pair with specific β-isotypes)
        Experimentally determined ratios

This isn't routine yet, but specialized labs focusing on tubulin biology do perform this kind of reconstruction for specific questions. It's particularly relevant when studying:

    How drugs interact differently with specific isotypes
    How certain mutations in specific isotypes cause disease
    How post-translational modifications interact with isotype-specific sequences

The challenge remains that we can't definitively say "this specific subunit at position X in this specific microtubule is isotype Y" from the cryo-EM data alone. But the kind of informed reconstruction you're describing represents the cutting edge of integrating structural and biochemical data in tubulin research.


### How different isotypes are resolved structurally

- Typically, the starting scaffold is one of:

    Consensus sequence: A synthetic sequence representing the most common residue at each position across all relevant isotypes.

    Dominant isotype: The most abundant isotype in the sample (e.g., TUBA1A for brain microtubules) serves as the template.

    Reference structure: Sometimes a well-resolved X-ray structure (often from bovine or porcine tubulin) is used, even if it's not identical to the isotypes being studied.

- Reconstruction/Modeling Approaches

The transformation from scaffold to isotype-specific models typically involves:

    Homology modeling: Using tools like MODELLER, Rosetta, or AlphaFold to generate structural predictions for specific isotypes based on the template.
    Flexible fitting: The homology models are then fitted into the cryo-EM density with tools like MDFF (Molecular Dynamics Flexible Fitting), Flex-EM, or Phenix real-space refinement.
    Energy minimization: MD simulations help resolve steric clashes and optimize the structure.

The key difference from standard homology modeling is that the cryo-EM density serves as an additional constraint - the model must both satisfy physics-based energy terms and fit the experimental density.
Handling Structural Differences

You're absolutely right that sequence differences can engender structural changes. This is handled in a few ways:

    Local refinement: Areas with sequence differences get more extensive sampling and refinement.
    Ensemble modeling: Sometimes multiple conformations are modeled for regions with significant differences.
    Validation: Using MD simulations to test if the modified structure remains stable.




A/B interfaces ?


so, it appears that ptms are somewhat inaccisible within a lot of cryoem
strcutrues due to resolution. at least for now and at least not fully and
cosistently (though some papers do resolve PTMs like acetylated K40:
https://www.cell.com/action/showPdf?pii=S0092-8674%2819%2931081-5). How can we
"repair" these structures to be able to display and have faithful structural references(at least up to the veracity of the upstream data ex. seq and PTM).
Can we "inject" PTMs dynamically into a template structure and then post-repair
the strucutre locally with, say, rosetta?


---

### PTMs

1. Structure tools that could enable ptms recovery/exploration in atomic
   structures.

2. Sort vis-a-vis the applications (downstream MD? MAP binding? Dynamics? how is
   this all done?)


-------

what volumes and diversities are avaiable routinely via Mass Spec and other
methods in terms of seqeunces and resolution





