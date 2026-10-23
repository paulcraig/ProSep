
import math
import random
from collections.abc import Sequence
from dataclasses import dataclass
from io import StringIO
from typing import Any

from Bio import SeqIO

from backend.utility.protein import Protein


class Fractionation:
    @dataclass
    class ProteinEntry:
        # Basic identifying information
        seq_id: str
        description: str
        sequence: str
        
        # Computed information
        molecular_weight: float
        
        def to_json(self):
            name = " ".join(self.description.split(" ")[1:]) if " " in self.description else self.description
            return {
                "name": name,
                "id": self.seq_id,
                "description": self.description,
                "sequence": self.sequence,
                "molecularWeight": round(self.molecular_weight, 2),
                "amount": 100/math.log(self.molecular_weight) if self.molecular_weight > 0 else 1,
            }
            
    @dataclass
    class BindingBasedProteinEntry(ProteinEntry):
        # Computed information
        binding_strength: float
        
        def to_json(self):
            return {
                **super().to_json(),
                "color": Fractionation.stable_color(self.seq_id),
                "bindingStrength": round(self.binding_strength, 4),
            }
    
    @staticmethod
    def stable_color(seed: str) -> str:
        """
        Generate a deterministic color from a protein ID.
        This keeps the same protein visually consistent across renders.
        """
        rnd = random.Random(seed)
        return f"#{rnd.randint(40, 220):02x}{rnd.randint(40, 220):02x}{rnd.randint(40, 220):02x}"
        
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
    
    @staticmethod
    def fractionate_with_overlap[T: ProteinEntry](
        items: Sequence[T],
        n_fractions: int,
        overlap: float,
    ) -> Sequence[Sequence[T]]:
        """
        Split retained proteins into fractions.

        overlap controls how much neighboring fractions share proteins.
        This simulates imperfect separation / band broadening.
        """
        if n_fractions <= 0:
            return []
        if not items:
            return [[] for _ in range(n_fractions)]

        total = len(items)
        bin_size = math.ceil(total / n_fractions)
        
        # How many proteins spill into neighboring fractions
        overlap_count = round(bin_size * overlap)

        fractions: Sequence[Sequence[T]] = []
        for i in range(n_fractions):
            start = max(i * bin_size - overlap_count, 0)
            end = min((i + 1) * bin_size + overlap_count, total)
            fractions.append(items[start:end])

        return fractions
    
    @staticmethod
    def process_fractions[T: ProteinEntry](fraction_lists: Sequence[Sequence[T]]):
        return [
            {
                "fractionIndex": index + 1,
                "proteinCount": len(fraction),
                "absorbanceScore": sum(Protein.calculate_absorbance(entry.sequence) for entry in fraction),
                "hitCount": len([
                    entry for entry in fraction if Protein.matches_prosite(entry.sequence, "H-H-H-H-H-H")
                ]),
                "hitProteinIds": [
                    entry.seq_id for entry in fraction if Protein.matches_prosite(entry.sequence, "H-H-H-H-H-H")
                ],
                "proteins": [entry.to_json() for entry in fraction],
            }
            for index, fraction in enumerate(fraction_lists)
        ]