import re, httpx

from typing import Dict, List
from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio import SeqIO


class Protein():
    AMINO_ACIDS = {
        'A': {'mass': 71.07,  'pKa': 0},
        'R': {'mass': 156.18, 'pKa': 12.48},
        'N': {'mass': 114.08, 'pKa': 0},
        'D': {'mass': 115.08, 'pKa': 3.65},
        'C': {'mass': 103.14, 'pKa': 8.18},
        'E': {'mass': 129.11, 'pKa': 4.25},
        'Q': {'mass': 128.13, 'pKa': 0},
        'G': {'mass': 57.05,  'pKa': 0},
        'H': {'mass': 137.14, 'pKa': 6.00},
        'I': {'mass': 113.16, 'pKa': 0},
        'L': {'mass': 113.16, 'pKa': 0},
        'K': {'mass': 128.17, 'pKa': 10.53},
        'M': {'mass': 131.19, 'pKa': 0},
        'F': {'mass': 147.17, 'pKa': 0},
        'P': {'mass': 97.11,  'pKa': 0},
        'S': {'mass': 87.07,  'pKa': 0},
        'T': {'mass': 101.10, 'pKa': 0},
        'W': {'mass': 186.21, 'pKa': 0},
        'Y': {'mass': 163.17, 'pKa': 10.07},
        'V': {'mass': 99.13,  'pKa': 0}
    }

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
    def get_individual_mw(parsed_protein, record_id):
        protein = parsed_protein.get(record_id)
        individual_mw = ProteinAnalysis(protein[1]).molecular_weight()
        return individual_mw


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
        return sum(Protein.AMINO_ACIDS.get(aa, {'mass': 0})['mass'] for aa in sequence)
    

    @staticmethod
    def calculate_theoretical_pi(sequence: str) -> float:
        counts = {}
        for aa in sequence:
            if aa in Protein.AMINO_ACIDS and Protein.AMINO_ACIDS[aa]['pKa'] > 0:
                counts[aa] = counts.get(aa, 0) + 1

        total_pka = sum(Protein.AMINO_ACIDS[aa]['pKa'] * count for aa, count in counts.items())
        total_count = sum(counts.values())
        return total_pka / total_count if total_count > 0 else 7.0
    

    @staticmethod
    def find_links(list_of_ids: List[str], use_uniparc_fallback: bool = True):
        UNIPROT_URL = "https://www.uniprot.org/uniprotkb"
        PDB_URL = "https://data.rcsb.org/rest/v1/core/entry"
        NCBI_URL = "https://www.ncbi.nlm.nih.gov/protein"

        protein_links = {}

        with httpx.Client() as client:
            for pid in list_of_ids:
                protein_links[pid] = None  # default in case of no links

                # NCBI
                if pid.replace(".", "").isdigit() or pid.startswith(("NP_", "XP_", "CAA", "AFP")):
                    r = client.get(
                        f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=protein&id={pid}&retmode=json"
                    )
                    if r.status_code == 200:
                        protein_links[pid] = f"{NCBI_URL}/{pid}"
                        continue

                # PDB
                if len(pid) == 4 and pid.isalnum():
                    r = client.get(f"{PDB_URL}/{pid}")
                    if r.status_code == 200:
                        protein_links[pid] = f"https://www.rcsb.org/structure/{pid}"
                        continue

                # UniProt
                if pid.isalnum() and not pid.replace(".", "").isdigit():
                    r = client.get(f"{UNIPROT_URL}/{pid}")
                    if r.status_code == 200:
                        protein_links[pid] = f"{UNIPROT_URL}/{pid}"
                    elif use_uniparc_fallback:
                        protein_links[pid] = f"https://www.uniprot.org/uniparc/{pid}"

        return protein_links
    

    @staticmethod
    def extract_protein_info(header: str) -> Dict[str, str]:
        match = re.match(r'^gi\|(\d+)\|.*\|\s*(.*?)\s*\[(.*?)\]$', header)
        if match:
            return {'id': match.group(1), 'name': match.group(2), 'organism': match.group(3)}
        return {'id': 'unknown', 'name': header, 'organism': 'Unknown organism'}
    