# Protein Class represents properties and behaviors related to a protein.
# Note: GUI-related fragments have been removed from this class.
# @author Mack Leonard, Amr Mualla, & Bader Alharbi
from Bio import SeqIO
from Bio.SeqUtils import molecular_weight
from Bio.SeqUtils.ProtParam import ProteinAnalysis


# Utilizes Biopython SeqIO library to parse through a fasta file given by the user and collect
# information stored within the file
# @return: Sequence identifier, amino acid sequence, length of amino acid sequence
def parse_protein(file):
    protein_dict = {}
    for seq_record in SeqIO.parse(file, "fasta"):
        seq_id = seq_record.id
        seq_description = seq_record.description
        seq = seq_record.seq
        seq_length = len(seq_record.seq)
        protein_dict[seq_id] = seq_description, seq, seq_length
    return protein_dict


# Utilizes the ProteinAnalysis object to get a sequence of amino acids and calculate the molecular weight
# @return: molecular weight of the protein from fasta file given by user
def get_mw(file):
    mw_list = []
    protein_seq = parse_protein(file)
    for record_id in protein_seq:
        protein = protein_seq.get(record_id)
        sequence = ProteinAnalysis(protein[1])
        mw_list.append(sequence.molecular_weight())
    return mw_list


# Utilizes the ProteinAnalysis object to get a sequence of amino acids and finds the number of amino acids
# @return: the number of amino acids from fasta file given by user
def get_individual_mw(parsed_protein, record_id):
    # protein_seq = parse_protein(file)
    protein = parsed_protein.get(record_id)
    individual_mw = ProteinAnalysis(protein[1]).molecular_weight()
    return individual_mw


def get_amino_acid_count(file):
    amino_acid_list = []
    protein_seq = parse_protein(file)
    for record_id in protein_seq:
        protein = protein_seq.get(record_id)
        sequence = ProteinAnalysis(protein[1])
        amino_acid_list.append(sequence.count_amino_acids())
    return amino_acid_list


class Protein:

    # Initializes a new instance of the Protein class.
    # @param name: Short name of the protein. Defaults to "notSet".
    # @param full_name: Full name of the protein. Defaults to "notSet".
    # @param abbr: Abbreviation for the protein. Defaults to "notSet".
    # @param mw: Molecular weight of the protein. Defaults to 0.
    # @param color: Color representation (RGB) of the protein. Defaults to blue.
    def __init__(self, name="notSet", full_name="notSet", abbr="notSet", mw=0, color=(0, 0, 255)):
        self.concentration = 1   # Default concentration of the protein.
        self.start_y = 0         # Starting y-coordinate.
        self.scale_factor = 0.0  # Factor for scaling.
        self.relative_migration = 0.0 # Relative migration value.
        self.speed = 0.01        # Speed of protein movement.
        self.mw = mw             # Molecular weight of the protein.
        self.charge = 0.0        # Charge on the protein.
        self.name = name         # Short name of the protein.
        self.full_name = full_name # Full name of the protein.
        self.abbr = abbr         # Abbreviation for the protein.
        self.selected = False    # Flag indicating if protein is selected.
        self.color = color       # Color representation (RGB) of the protein.
        # GUI related attributes for positioning and plotting.
        self.x1 = 0
        self.y1 = 0
        self.width = 0
        self.height = 2
        self.y1_float = 0.0
        self.max_position = 0
        self.distance = 0.0
        self.decider = 1
        self.counter = 1
        self.plot_y_pos = 0
        self.plot_x_pos = 0

    # Sets the starting position of the protein on the GUI.
    # @param x: The x-coordinate for the starting position.
    # @param y: The y-coordinate for the starting position.
    def set_start_position(self, x, y):
        self.x1 = x
        self.y1 = y
        self.start_y = self.y1
        self.y1_float = float(self.y1)

    # Resets the decision counter.
    def reset_decider(self):
        self.decider = 1
        self.counter = 1

    # Incrementally updates the position of the protein based on its speed.
    def incr_position(self):
        if self.counter == self.decider:
            self.y1_float += self.speed
            self.counter = 1
        else:
            self.counter += 1
        self.y1 = int(self.y1_float)

    # Checks if a point (x,y) matches with the protein's position.
    # @param x: x-coordinate of the point.
    # @param y: y-coordinate of the point.
    def match_position(self, x, y):
        x2 = self.x1 + self.width
        y2 = self.y1 + self.height
        range_val = 2
        return x >= self.x1 - range_val and x <= x2 + range_val and y >= self.y1 - range_val and y <= y2 + range_val

    # Sets the width of the protein representation in the GUI.
    # @param w: The desired width value.
    def set_width(self, w):
        self.width = w

    # Returns the current value of the decider.
    def get_decider(self):
        return self.decider

    # Sets the decider value.
    # @param i: The desired decider value.
    def set_decider(self, i):
        self.decider = i

    # Sets the scaling factor.
    # @param f: The scaling factor value.
    def set_host_scale_factor(self, f):
        self.scale_factor = f

    # Sets the maximum possible position for the protein.
    # @param i: The maximum position value.
    def set_max_position(self, i):
        self.max_position = i

    # Sets the concentration of the protein.
    # @param i: New concentration value to be set.
    def set_concentration(self, i):
        self.concentration = i

    # Checks if a given point (x,y) is close to the protein's plotting position.
    # The point is considered a match if it is within a range of 3 units from the protein's position.
    # @param x: x-coordinate of the point.
    # @param y: y-coordinate of the point.
    # @return: True if the point matches the protein's plotting position, False otherwise.
    def match_plot_position(self, x, y):
        range_val = 3
        return x >= self.plot_x_pos - range_val and x <= self.plot_x_pos + range_val and y >= self.plot_y_pos - range_val and y <= self.plot_y_pos + range_val

    # Calculates the distance traveled by the protein based on the scale factor.
    # The distance is determined as the scaled difference between the current and starting y-coordinates.
    # @return: Calculated distance traveled by the protein.
    def set_distance(self, parsed_protein, record_id, scale_factor):
        self.distance = get_individual_mw(parsed_protein, record_id) * scale_factor
        return self.distance
