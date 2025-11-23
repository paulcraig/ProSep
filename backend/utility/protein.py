import re
from typing import Dict
from typing import List
from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio import SeqIO


class Protein():
    
    # Utilizes Biopython SeqIO library to parse through a fasta file given by the user and collect
    # information stored within the file
    # @return: Sequence identifier, amino acid sequence, length of amino acid sequence
    @staticmethod
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
    @staticmethod
    def get_mw(file):
        mw_list = []
        protein_seq = Protein.parse_protein(file)
        for record_id in protein_seq:
            protein = protein_seq[record_id]
            sequence = ProteinAnalysis(protein[1])
            mw_list.append(sequence.molecular_weight())
        return mw_list


    # Utilizes the ProteinAnalysis object to get a sequence of amino acids and finds the number of amino acids
    # @return: the number of amino acids from fasta file given by user
    
    @staticmethod
    def get_amino_acid_count(file):
        amino_acid_list = []
        protein_seq = Protein.parse_protein(file)
        for record_id in protein_seq:
            protein = protein_seq[record_id]
            sequence = ProteinAnalysis(protein[1])
            amino_acid_list.append(sequence.count_amino_acids())
        return amino_acid_list


    @staticmethod
    def calculate_molecular_weight(sequence: str) -> float:
        analyzed = ProteinAnalysis(sequence)
        return analyzed.molecular_weight()
    

    @staticmethod
    def calculate_theoretical_pi(sequence: str) -> float:
        analyzed = ProteinAnalysis(sequence)
        return analyzed.isoelectric_point()
    

    @staticmethod
    def find_links(sequences: List[Dict[str, str]]) -> Dict[str, str]:
        links = {}
        for seq in sequences:
            header = seq.get('header', '')
            # Extract the accession number from the header
            match = re.search(r'\|([A-Z0-9]+\.\d+)\|', header)
            if match:
                accession = match.group(1)
                # You can test with Entrez eSearch if you want, but just build the link:
                links[accession] = f"https://www.ncbi.nlm.nih.gov/nuccore/{accession}"
            else:
                links[header[:10]] = "N/A"  # fallback key
        return links

    @staticmethod
    def extract_protein_info(header: str) -> Dict[str, str]:
        match = re.match(r'^gi\|(\d+)\|.*\|\s*(.*?)\s*\[(.*?)\]$', header)
        if match:
            return {'id': match.group(1), 'name': match.group(2), 'organism': match.group(3)}
        return {'id': 'unknown', 'name': header, 'organism': 'Unknown organism'}
    