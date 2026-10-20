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

    def checkSequence(self, sequence: str): 
        # TODO implement proper check
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
