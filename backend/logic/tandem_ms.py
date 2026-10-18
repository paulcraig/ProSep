"""  * This dict represents the 20 different basic types of Amino Acids a protein
 * can possess. The instance variables assume that the amino acid in question
 * is fully protenated. NHHCHRCOOH is the assumed state of each individual residue.
 *
 *  ** base masses of amino acids in daltons obtained from
 *     http://www.encorbio.com/protocols/Prot-MW.htm on 5/4/2011. Amino acids
 *     with an extra charge were given an extra 1.00774 Da for hydrogen
 *     presence.
 *  ** pKa's obtained from http://www.cem.msu.edu/~cem252/sp97/ch24/ch24aa.html on 5/3/2011
 */ """

SpecAminoAcids = {
    'H': {
        "name" : "Histidine", 
        "mass" : 155.15603
    },
    'K': {
        "name" : "Lysine", 
        "mass" : 146.19206
    },
    'R': {
        "name" : "Arginine", 
        "mass" : 174.20206
    },
    'E': {
        "name" : "Glutamate", 
        "mass" : 147.12784
    },
    'D': {
        "name" : "Aspartate", 
        "mass" : 133.09784
    },
    'P': {
        "name" : "Proline", 
        "mass" : 115.13000
    },
    'V': {
        "name" : "Valine", 
        "mass" : 117.15000
    },
    'M': {
        "name" : "Methionine", 
        "mass" : 149.21000
    },
    'S': {
        "name" : "Serine", 
        "mass" : 105.09000
    },
    'Q': {
        "name" : "Glutamine", 
        "mass" : 146.14000
    },
    'N': {
        "name" : "Asparagine",
        "mass" : 132.12000
    },
    'L': {
        "name" : "Leucine",
        "mass" : 131.17000
        },
    'I': {
        "name" : "Isoleucine",
        "mass" : 131.17000
    },
    'G': {
        "name" : "Glycine",
        "mass" : 75.070000
    },
    'A': {
        "name" : "Alanine",
        "mass" : 89.090000
    },
    'F': {
        "name" : "Phenylalanine",
        "mass" : 165.19000
    },
    'Y': {
        "name" : "Tyrosine",
        "mass" : 181.19000
    },
    'W': {
        "name" : "Tryptophan",
        "mass" : 204.23000
    },
    'T': {
        "name" : "Threonine",
        "mass" : 119.12000
    },
    'C': {
        "name" : "Cysteine",
        "mass" : 121.16000
    }
}
            
class Ion:
    def __init__(self):
        self.totalMass = 0
        self.charge = 0
        self.sequence = ""
        self.type= None
        self.aminoAcids = []

    def addAminoAcid(self, aminoAcid: str):
        aminoAcid = aminoAcid.upper()
        self.aminoAcids.append(aminoAcid)
        self.totalMass += SpecAminoAcids[aminoAcid].mass

        # if this is the second or greater amino acid added to the chain
        if len(self.aminoAcids) > 1:
            # subtract the mass in Daltons of H2O as the amino acids dehydrate together to form the chain
            self.totalMass -= 18.01528

    def getMassChargeRatio(self):
        return self.totalMass / self.Charge

'''
 * Contains the methods needed for a Protease who cuts before or after apecific proteins without any other conditions. Otherwise the method cut needs to be overwritten and new conditions added
'''
class Protease:
    def __init__(self):
        self.cutAminoAcids = []
        self.cutsBefore = False

    def cut(self, sequence : str):
        sequence = self.checkSequence(sequence)

        # We are grabbing the positions/indexes where the Protease should expect to cut
        cut_indexes = [
            i if self.cutsBefore else i + 1  # If cuts after, index is + 1 
            for i, aa in enumerate(sequence) 
            # passing current amino acid, and next if it exists
            if self.shouldCutHere(aa, sequence[i + 1] if i + 1 < len(sequence) else '') 
        ]

        # Sorted list of the cut indexes, with the first and last indexes added (for the first and last sequence)
        cut_index_bounds = sorted({0, *cut_indexes, len(sequence)})

        # Grabbing the sequences, zip gives the list of pairings for the sequence start and end index
        sequence_indexes = [sequence[a:b] for a, b in zip(cut_index_bounds, cut_index_bounds[1:])]

        return sequence_indexes

    def shouldCutHere(self, currentAA: str, afterAA: str):
        return currentAA in self.cutAminoAcids

    def checkSequence(self, sequence: str): # throws ProteaseException {
        """ if (sequence.contains(" ")) {
            throw new ProteaseException("Sequence to be cut must not contain spaces.");
        } else if (sequence.matches(".*\\d.*")) {
            throw new ProteaseException("Sequence to be cut must not contain numbers.");
        } else if (sequence.matches(".*[a-z].*")) {
            throw new ProteaseException("Sequence to be cut must contain all upper case letters.");
        } """
        return sequence

class Chymotrypsin(Protease):
    def __init__(self):
        super().__init__()
        self.cutAminoAcids = ['Y', 'W', 'F']
        self.cutsBefore = False

class Thermolysin(Protease):
    def __init__(self):
        super().__init__()
        self.cutAminoAcids = ['I', 'L', 'M', 'V']
        self.cutsBefore = True

class Trypsin(Protease):
    def __init__(self):
        super().__init__()
        self.cutAminoAcids = ['R', 'K']
        self.cutsBefore = False

    def shouldCutHere(self, currentAA: str, afterAA: str):
        return currentAA in self.cutAminoAcids and afterAA != 'P'
    
class ProteinaseK(Protease):
    def __init__(self):
        super().__init__()
        self.cutAminoAcids = ['A', 'F', 'I', 'L', 'V', 'W', 'Y']
        self.cutsBefore = False

class TandemMS:
    def __init__(self):
        self.ions = []
        self.sequence = ""
        self.totalMass = 0
        self.Charge = 0
        self.hits = 0

    def convert_string_to_ion(self, aminoAcidSequence: str):
        aminoAcids = list(aminoAcidSequence)
        ion = Ion()
        for acid in aminoAcids:
            try:
                newAcid = SpecAminoAcid(acid)
                ion.addAminoAcid(newAcid)
            except ValueError as ex:
                print(ex)
        return ion

    # skip src/main/java/MassSpec/AminoAcidTranslator.java because it's for displaying ?

    '''
    for graph 1: digestion spectrum
    
    In Java this comes from Spectrometer.runAnalysis (math) plus OutputGraphGUI (drawing)

    Input: protein sequence, protease choice (and optionally the lower/upper m/z limits that MassSpecMain had?)
    Output should be one peak per peptide: sequence, mz, and hits (how many peptides sharegi that m/z, which sets peak height).
    '''
    def runAnalysis(self, sequence: str, proteaseChoice: str, lowerLimit: float = 0, upperLimit: float = 3000):
        sequence = sequence.strip()
        sequence = sequence.upper()

        # if the sequence contains any digits, throw an error and exit the method.
        if any(c.isdigit() for c in sequence): raise ValueError("Protein sequence must not contain digits.")

        # get rid of any whitespace in the sequence
        sequence = "".join(sequence.split())

        # Figure out which protease the user wants.
        if proteaseChoice == "MassSpec.Trypsin":
            protease = Trypsin()
        elif proteaseChoice == "MassSpec.Chymotrypsin":
            protease = Chymotrypsin()
        elif proteaseChoice == "Proteinase K":
            protease = ProteinaseK()
        elif proteaseChoice == "MassSpec.Thermolysin":
            protease = Thermolysin()
        else: protease = Trypsin()

        # Begin sequencing. Each fragment must have a charge of one and only one.
        ions = []
        try :
            ionStrings = protease.cut(sequence);
            for ion in ionStrings:
                newIon = self.convert_string_to_ion(ion)
                newIon.Charge = 1
                newIon.sequence = ion
                if newIon.totalMass != 0:
                    ions.append(newIon)
        except ValueError: #ProteaseException ex:
            ions=[] #raise ProteaseException("Error cutting sequence with protease " + proteaseChoice + ": " + ex.getMessage())

        # Count up the number of ions with the same mass charge rotios to find intensity of each peak.
        mostHits = 0
        for i in range(len(ions)):
            hits = 0
            for j in range(len(ions)):
                if (ions[i].getMassChargeRatio() == ions[j].getMassChargeRatio()):
                    hits += 1
            
            ions[i].hits = hits
            if mostHits < hits:
                mostHits = hits

        # from OutputGraphGUI.setPeaks: only keep peaks inside the m/z window
        peaks = []
        for ion in ions:
            mz = ion.getMassChargeRatio()
            if lowerLimit <= mz <= upperLimit:
                peaks.append({"sequence": ion.sequence, "mz": mz, "hits": ion.hits})
        return {"peaks": peaks, "mostHits": mostHits}

    '''
    for graph 2: tandem spectrum for one peak
    
    In Java this is TandemGraphGUI

    Input: a single peptide sequence
    Output: the b and y fragment peaks, plus the gaps between neighbors with their letters
    '''
    def sequence_peaks(self, peptide: str):
        ion = self.convert_string_to_ion(peptide)
        peakLines = []
        
        # First, make the b-fragment ions
        for i in range(len(ion.aminoAcids)):
            bIon = Ion()
            for j in range(i):
                bIon.addAminoAcid(ion.aminoAcids[j])
            bIon.addAminoAcid(ion.aminoAcids[i])
            bIon.totalMass = bIon.totalMass - 17.00734
            bIon.Charge = 1
            bIon.type = "b"
            peakLines.append(bIon)

        # Next, make the y-fragment ions
        for i in range(len(ion.aminoAcids)-1, -1, -1):
            yIon = Ion()
            for j in range(len(ion.aminoAcids)-1, i, -1):
                yIon.addAminoAcid(ion.aminoAcids[j])
            yIon.addAminoAcid(ion.aminoAcids[i])
            yIon.totalMass = yIon.totalMass + 1.00794
            yIon.Charge = 1
            yIon.type = "y"
            peakLines.append(yIon)

        # from drawArrows: pair each peak with the next peak of the same type
        gaps = []
        for i in range(len(peakLines)):
            for j in range(i + 1, len(peakLines)):
                if peakLines[j].type == peakLines[i].type:
                    meDifference = peakLines[j].getMassChargeRatio() - peakLines[i].getMassChargeRatio()
                    gaps.append({"type": peakLines[i].type,
                                 "fromMz": peakLines[i].getMassChargeRatio(),
                                 "toMz": peakLines[j].getMassChargeRatio(),
                                 "difference": meDifference,
                                 "letter": self.retrieve_letter(meDifference)})
                    break  # only go until you find the next ion with the same type

        fragments = [{"type": p.type, "mz": p.getMassChargeRatio()} for p in peakLines]
        return {"fragments": fragments, "gaps": gaps}

    def retrieve_letter(self, meDifference):
        diff = int(meDifference)
        letter = ""
        if diff == 71:
            letter = "A"
        elif diff == 156:
            letter = "R"
        elif diff == 114:
            letter = "N"
        elif diff == 115:
            letter = "D"
        elif diff == 103:
            letter = "C"
        elif diff == 129:
            letter = "E"
        elif diff == 57:
            letter = "G"
        elif diff == 137:
            letter = "H"
        elif diff == 131:
            letter = "M"
        elif diff == 147:
            letter = "F"
        elif diff == 97:
            letter = "P"
        elif diff == 87:
            letter = "S"
        elif diff == 101:
            letter = "T"
        elif diff == 186:
            letter = "W"
        elif diff == 163:
            letter = "Y"
        elif diff == 99:
            letter = "V"
        elif diff == 128:
            letter = "Q or K"
        elif diff == 113:
            letter = "I or L"
        else:
            letter = "X"
        return letter