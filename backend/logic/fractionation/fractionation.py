
import random
from io import StringIO
from typing import Any

from Bio import SeqIO


class Fractionation:
    @staticmethod
    def stable_color(seed: str) -> str:
        """
        Generate a deterministic color from a protein ID.
        This keeps the same protein visually consistent across renders.
        """
        rnd = random.Random(seed)
        return "#%02x%02x%02x" % (
            rnd.randint(40, 220),
            rnd.randint(40, 220),
            rnd.randint(40, 220),
        )
        
    @staticmethod
    def normalize_sequence(sequence: str) -> str:
        """
        Clean up an input sequence:
        - uppercase it
        - replace ambiguous residues
        - remove non-letter characters
        """
        
        # Replace uncommon/ambigous residues with approximate alternatives
        NORMALIZATION_MAP = {
            "X": "Q",
            "B": "D",
            "Z": "E",
            "J": "L",
            "U": "C",
            "O": "K",
            "*": "",    
        }
            
        seq = sequence.strip().upper()
        for bad, replacement in NORMALIZATION_MAP.items():
            seq = seq.replace(bad, replacement)
        seq = "".join(ch for ch in seq if ch.isalpha())
        return seq
    
    @staticmethod
    def parse_fasta_text(fasta_content: str) -> list[Any]:
        """
        Parse uploaded FASTA text.

        If the user provides only a raw sequence and no FASTA header,
        wrap it in a synthetic FASTA record so BioPython can parse it.
        """
        content = fasta_content.strip()
        if not content:
            return []

        if ">" not in content:
            content = f">uploaded_sequence\n{content}\n"

        handle = StringIO(content)
        return list(SeqIO.parse(handle, "fasta"))