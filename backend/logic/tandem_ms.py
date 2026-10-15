"""  * This class represents the 20 different basic types of Amino Acids a protein
 * can possess. The instance variables assume that the amino acid in question
 * is fully protenated. NHHCHRCOOH is the assumed state of each individual residue.
 *
 *  ** base masses of amino acids in daltons obtained from
 *     http://www.encorbio.com/protocols/Prot-MW.htm on 5/4/2011. Amino acids
 *     with an extra charge were given an extra 1.00774 Da for hydrogen
 *     presence.
 *  ** pKa's obtained from http://www.cem.msu.edu/~cem252/sp97/ch24/ch24aa.html on 5/3/2011
 */ """
class SpecAminoAcid :
    def __init__(self, character: str):
        self.name = ""
        self.mass = 0.0
        self.charge = 0
        self.hits = 0

        self.translate(character)

    # Takes a char and interprets it, assigning the correct name, mass in Daltons, and charge to the instance of MassSpec.SpecAminoAcid based on the symbol given.
    def translate(self, character: str) : #throws AminoException {
        if len(character) != 1:
            raise ValueError("Incorrect symbol for amino acid = " + character)

        character = character.upper()

        if character == 'H':
            self.name = "Histidine"
            self.mass = 155.15603
        elif character == 'K':
            self.name = "Lysine"
            self.mass = 146.19206
        elif character == 'R':
            self.name = "Arginine"
            self.mass = 174.20206
        elif character == 'E':
            self.name = "Glutamate"
            self.mass = 147.12784
        elif character == 'D':
            self.name = "Aspartate"
            self.mass = 133.09784
        elif character == 'P':
            self.name = "Proline"
            self.mass = 115.13000
        elif character == 'V':
            self.name = "Valine"
            self.mass = 117.15000
        elif character == 'M':
            self.name = "Methionine"
            self.mass = 149.21000
        elif character == 'S':
            self.name = "Serine"
            self.mass = 105.09000
        elif character == 'Q':
            self.name = "Glutamine"
            self.mass = 146.14000
        elif character == 'N':
            self.name = "Asparagine"
            self.mass = 132.12000
        elif character == 'L':
            self.name = "Leucine"
            self.mass = 131.17000
        elif character == 'I':
            self.name = "Isoleucine"
            self.mass = 131.17000
        elif character == 'G':
            self.name = "Glycine"
            self.mass = 75.070000
        elif character == 'A':
            self.name = "Alanine"
            self.mass = 89.090000
        elif character == 'F':
            self.name = "Phenylalanine"
            self.mass = 165.19000
        elif character == 'Y':
            self.name = "Tyrosine"
            self.mass = 181.19000
        elif character == 'W':
            self.name = "Tryptophan"
            self.mass = 204.23000
        elif character == 'T':
            self.name = "Threonine"
            self.mass = 119.12000
        elif character == 'C':
            self.name = "Cysteine"
            self.mass = 121.16000
        else:
            raise ValueError("Incorrect symbol for amino acid = " + character)
            #throw new AminoException("Incorrect symbol for amino acid = " + code);

class Ion:
    def __init__(self):
        self.totalMass = 0
        self.totalCharge = 0
        self.hits = 0
        self.xCoordinate = 0
        self.sequence = ""
        self.type= None
        self.aminoAcids = []

    def addAminoAcid(self, aminoAcid: SpecAminoAcid):
        self.aminoAcids.append(aminoAcid)
        self.totalMass += aminoAcid.mass

        # if this is the second or greater amino acid added to the chain
        if len(self.aminoAcids) > 1:
            # subtract the mass in Daltons of H2O as the amino acids dehydrate together to form the chain
            self.totalMass -= 18.01528  # Subtract mass of H2O for peptide bond formation

    def getMassChargeRatio(self):
        return self.totalMass / self.totalCharge

'''
 * Contains the methods needed for a Protease who cuts before or after apecific proteins without any other conditions.  Otherwise the method cut needs to be overwritten and new conditions added
'''
class Protease:
    def __init__(self):
        self.cutAminoAcids = []
        self.cutsBefore = False

    def cut(self, sequence: str) : # throws ProteaseException {
        buildingIons = []
        cutSequence = []
        sequence = self.checkSequence(sequence)  # runs the sequence through the sequence checker method in order to detect any errors
        i = 0  # needed to send what the character after the currentAA is

        '''
        TODO! i is never incremented 
        This means that afterAA is always the protein's second letter, 
        and the Trypsin “don't cut before P” rule checks the wrong residue
        Bug copied from java
        '''
        for currentAA in sequence:
            if not self.cutsBefore:
                buildingIons.append(currentAA)

            for currentCutPoint in self.cutAminoAcids: #should make a new method for determing if the protease should cut here so that more a complex protease only has to override that smaller method instead of the larger cut method
                afterAA = ' '

                if (i + 1) < len(sequence):
                    afterAA = sequence[i + 1]
                if self.shouldCutHere(currentAA, currentCutPoint, afterAA):
                    # make ion
                    ion = ""
                    for c in buildingIons:
                        ion += c
            
                    cutSequence.append(ion)
                    buildingIons.clear()

            if self.cutsBefore:
                buildingIons.append(currentAA);

        '''
        The last peptide is dropped. 
        Nothing emits the leftover residues after the final cut, so Java Trypsin on AKRPGFLIEW returns AK, R and loses PGFLIEW. 
        This "bug" is copied over from java code
        Potential fix : if buildingIons: cutSequence.append("".join(buildingIons))
        '''

        return cutSequence

    def shouldCutHere(self, currentAA: str, currentCutPoint: str, afterAA: str):
        shouldCut = False
        if currentAA == currentCutPoint:
            shouldCut = True
        return shouldCut

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

    def shouldCutHere(self, currentAA: str, currentCutPoint: str, afterAA: str):
        shouldCut = False
        if currentAA == currentCutPoint and afterAA != 'P': # only cuts if R or K are not followed by P
            shouldCut = True
        return shouldCut
    
class ProteinaseK(Protease):
    def __init__(self):
        super().__init__()
        self.cutAminoAcids = ['A', 'F', 'I', 'L', 'V', 'W', 'Y']
        self.cutsBefore = False


###


class TandemMS:
    def __init__(self):
        self.ions = []
        self.sequence = ""
        self.totalMass = 0
        self.totalCharge = 0
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
    Output should be one peak per peptide: sequence, mz, and hits (how many peptides share that m/z, which sets peak height).
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
                newIon.totalCharge = 1
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
            bIon.totalCharge = 1
            bIon.type = "b"
            peakLines.append(bIon)

        # Next, make the y-fragment ions
        for i in range(len(ion.aminoAcids)-1, -1, -1):
            yIon = Ion()
            for j in range(len(ion.aminoAcids)-1, i, -1):
                yIon.addAminoAcid(ion.aminoAcids[j])
            yIon.addAminoAcid(ion.aminoAcids[i])
            yIon.totalMass = yIon.totalMass + 1.00794
            yIon.totalCharge = 1
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