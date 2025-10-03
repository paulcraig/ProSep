from io import StringIO
import math
import re
from typing import Any, Dict, List
import httpx
from Bio import SeqIO

class Protein():
    AMINO_ACIDS = {
    'A': {'mass': 71.07, 'pKa': 0},
    'R': {'mass': 156.18, 'pKa': 12.48},
    'N': {'mass': 114.08, 'pKa': 0},
    'D': {'mass': 115.08, 'pKa': 3.65},
    'C': {'mass': 103.14, 'pKa': 8.18},
    'E': {'mass': 129.11, 'pKa': 4.25},
    'Q': {'mass': 128.13, 'pKa': 0},
    'G': {'mass': 57.05, 'pKa': 0},
    'H': {'mass': 137.14, 'pKa': 6.00},
    'I': {'mass': 113.16, 'pKa': 0},
    'L': {'mass': 113.16, 'pKa': 0},
    'K': {'mass': 128.17, 'pKa': 10.53},
    'M': {'mass': 131.19, 'pKa': 0},
    'F': {'mass': 147.17, 'pKa': 0},
    'P': {'mass': 97.11, 'pKa': 0},
    'S': {'mass': 87.07, 'pKa': 0},
    'T': {'mass': 101.10, 'pKa': 0},
    'W': {'mass': 186.21, 'pKa': 0},
    'Y': {'mass': 163.17, 'pKa': 10.07},
    'V': {'mass': 99.13, 'pKa': 0}
}
    def calculate_molecular_weight(self,sequence: str) -> float:
        return sum(self.AMINO_ACIDS.get(aa, {'mass': 0})['mass'] for aa in sequence)
    def calculate_theoretical_pi(self,sequence: str) -> float:
        counts = {}
        for aa in sequence:
            if aa in self.AMINO_ACIDS and self.AMINO_ACIDS[aa]['pKa'] > 0:
                counts[aa] = counts.get(aa, 0) + 1

        total_pka = sum(self.AMINO_ACIDS[aa]['pKa'] * count for aa, count in counts.items())
        total_count = sum(counts.values())
        return total_pka / total_count if total_count > 0 else 7.0
    

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
    
    def extract_protein_info(header: str) -> Dict[str, str]:
        match = re.match(r'^gi\|(\d+)\|.*\|\s*(.*?)\s*\[(.*?)\]$', header)
        if match:
            return {'id': match.group(1), 'name': match.group(2), 'organism': match.group(3)}
        return {'id': 'unknown', 'name': header, 'organism': 'Unknown organism'}
    