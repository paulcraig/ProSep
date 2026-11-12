from backend.logic.protease import (
    Chymotrypsin,
    Thermolysin,
    Trypsin,
    ProteinaseK,
)

from backend.utility.protein import Protein

MassLetters = {
    71: "A",
    156: "R",
    114: "N",
    115: "D",
    103: "C",
    129: "E",
    57: "G",
    137: "H",
    131: "M",
    147: "F",
    97: "P",
    87: "S",
    101: "T",
    186: "W",
    163: "Y",
    99: "V",
    128: "Q or K",
    113: "I or L",
}

Proteases = {
    "trypsin": Trypsin,
    "chymotrypsin": Chymotrypsin,
    "proteinase k": ProteinaseK,
    "thermolysin": Thermolysin,
}


class Ion:
    def __init__(self):
        self.totalMass = 0
        self.charge = 0
        self.sequence = ""
        self.type = None
        self.aminoAcids = []

    def addAminoAcid(self, aminoAcid: str):
        aminoAcid = aminoAcid.upper()

        if aminoAcid not in Protein.AMINO_ACIDS:
            raise ValueError(f"Incorrect symbol for amino acid = {aminoAcid}")

        self.aminoAcids.append(aminoAcid)
        self.totalMass += Protein.AMINO_ACIDS[aminoAcid]["mass"]

        # if this is the second or greater amino acid added to the chain
        if len(self.aminoAcids) > 1:
            # subtract the mass in Daltons of H2O as the amino acids dehydrate together to form the chain
            self.totalMass -= 18.01528

    def getMassChargeRatio(self):
        return self.totalMass / self.charge


class TandemMS:
    def __init__(self):
        self.ions = []
        self.sequence = ""
        self.totalMass = 0
        self.charge = 0
        self.hits = 0

    def convertStringToIon(self, aminoAcidSequence: str):
        aminoAcids = list(aminoAcidSequence)
        ion = Ion()
        for acid in aminoAcids:
            ion.addAminoAcid(acid)
        return ion

    """
    Digestion spectrum
    Input: protein sequence, protease choice, and optionally the lower/upper m/z limits
    Output should be one peak per peptide with the number of hits and the sequence for that peptide, and the most hits for any peptide
    """

    def runAnalysis(
        self,
        sequence: str,
        proteaseChoice: str,
        lowerLimit: float = 0,
        upperLimit: float = 3000,
    ):
        sequence = sequence.strip()
        sequence = sequence.upper()

        # if the sequence contains any digits, throw an error and exit the method.
        if any(c.isdigit() for c in sequence):
            raise ValueError("Protein sequence must not contain digits.")

        # get rid of any whitespace in the sequence
        sequence = "".join(sequence.split())

        # Figure out which protease the user wants.
        proteaseClass = Proteases.get(proteaseChoice.strip().lower())
        if proteaseClass is None:
            raise ValueError(
                f"Unknown protease: {proteaseChoice}. Choose from: {', '.join(Proteases)}"
            )
        protease = proteaseClass()

        # Begin sequencing. Each fragment must have a charge of one and only one.
        ions = []
        ionStrings = protease.cut(sequence)
        for ion in ionStrings:
            newIon = self.convertStringToIon(ion)
            newIon.charge = 1
            newIon.sequence = ion
            if newIon.totalMass != 0:
                ions.append(newIon)

        # Group ions by mass charge ratio, the number of ions sharing an m/z is the intensity of that peak.
        peaks = {}
        for ion in ions:
            mz = ion.getMassChargeRatio()

            # from OutputGraphGUI.setPeaks: only keep peaks inside the m/z window
            if not lowerLimit <= mz <= upperLimit:
                continue

            peak = peaks.setdefault(mz, {"sequences": [], "hits": 0})

            peak["sequences"].append(ion.sequence)
            peak["hits"] += 1

        mostHits = max((peak["hits"] for peak in peaks.values()), default=0)
        return {"peaks": peaks, "mostHits": mostHits}

    """
    for graph 2: tandem spectrum for one peak

    In Java this is TandemGraphGUI

    Input: a single peptide sequence
    Output: the b and y fragment peaks, plus the gaps between neighbors with their letters
    """

    def sequencePeaks(self, peptide: str):
        ion = self.convertStringToIon(peptide)
        peakLines = []

        # First, make the b-fragment ions
        for i in range(len(ion.aminoAcids)):
            bIon = Ion()
            for j in range(i):
                bIon.addAminoAcid(ion.aminoAcids[j])
            bIon.addAminoAcid(ion.aminoAcids[i])
            bIon.totalMass = bIon.totalMass - 17.00734
            bIon.charge = 1
            bIon.type = "b"
            peakLines.append(bIon)

        # Next, make the y-fragment ions
        for i in range(len(ion.aminoAcids) - 1, -1, -1):
            yIon = Ion()
            for j in range(len(ion.aminoAcids) - 1, i, -1):
                yIon.addAminoAcid(ion.aminoAcids[j])
            yIon.addAminoAcid(ion.aminoAcids[i])
            yIon.totalMass = yIon.totalMass + 1.00794
            yIon.charge = 1
            yIon.type = "y"
            peakLines.append(yIon)

        # from drawArrows: pair each peak with the next peak of the same type
        gaps = []
        for i in range(len(peakLines)):
            for j in range(i + 1, len(peakLines)):
                if peakLines[j].type == peakLines[i].type:
                    meDifference = (
                        peakLines[j].getMassChargeRatio()
                        - peakLines[i].getMassChargeRatio()
                    )
                    gaps.append(
                        {
                            "type": peakLines[i].type,
                            "fromMz": peakLines[i].getMassChargeRatio(),
                            "toMz": peakLines[j].getMassChargeRatio(),
                            "difference": meDifference,
                            "letter": MassLetters.get(int(meDifference), "X"),
                        }
                    )
                    break  # only go until you find the next ion with the same type

        fragments = [{"type": p.type, "mz": p.getMassChargeRatio()} for p in peakLines]
        return {"fragments": fragments, "gaps": gaps}
