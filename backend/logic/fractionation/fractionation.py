
import math
import random
from collections.abc import Sequence
from dataclasses import dataclass, field
from io import StringIO
from typing import Any

from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis

from backend.utility.protein import Protein

class Fractionation:
    @dataclass
    class ProteinEntry:
        # Basic identifying information
        seq_id: str
        description: str
        sequence: str
        
        # Computed information
        molecular_weight: float = field(init=False)
        
        def __post_init__(self):
            self.molecular_weight = ProteinAnalysis(self.sequence).molecular_weight()
        
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
    def fractionate_with_inverse_gaussian[T: ProteinEntry](
        items: Sequence[T],
        n_fractions: int,
        mean: float = 0.3,
        shape: float = 0.4,
        x_range: float = 3,
        offset: float = 0.025,
        random: float = 0.003
    ) -> Sequence[Sequence[T]]:
        """
        Split retained proteins into fractions following an inverse gaussian distribution
        Here's a cool desmos graph showing how it works https://www.desmos.com/calculator/n8c4ucn4bv

        Args:
            items: proteins to fractionate 
            n_fractions: number of fractions, n_fractions > 0
            mean: mean to use in formula, mean > 0
            steepness: shape parameter to use in formula, steepness > 0
            x_range: the range of x values to scale to our fraction range, x_range > 0
            offset: the offset for the start of the distribution, 0 <= offset <= 1
            random: the randomness to apply to the weights, 0 <= random, but i recommend random <= 0.01
        """

        if n_fractions <= 0:
            return []
        if not items:
            return [[] for _ in range(n_fractions)]

        # create n_fractions points along an inverse gaussian distribution
        weights = []
        for index in range(n_fractions):
            x_percent = (index + 0.5) / n_fractions - offset
            x_percent = max(x_percent, 0.001)
            x = x_percent * x_range
            # formula from https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution
            y = (math.sqrt(shape / (2 * math.pi * x**3)) * 
                 math.exp(-(shape * (x - mean) ** 2) / (2 * mean**2 * x))) + random
            weights.append(y)

        # build a list of fraction_sizes based on the % of point over whole
        weight_total = sum(weights)
        expected_sizes = [len(items) * weight / weight_total for weight in weights]
        fraction_sizes = [math.floor(size) for size in expected_sizes]

        # add remainders into fractions in order of descending remainder
        # e.g. expected_sizes = [2.4, 5.7, 1.9]
        # fraction_sizes = [2, 5, 1], fraction_remainders = [0.4, 0.7, 0.9]
        # we need to distribute 2 remaining, so put them into 0.9 and then 0.7 for final counts of 2, 6, 2
        remaining = len(items) - sum(fraction_sizes)
        fraction_remainders = []
        for index, expected_size in enumerate(expected_sizes):
            remainder = expected_size - math.floor(expected_size)
            fraction_remainders.append((remainder, index))

        fraction_remainders.sort(reverse=True)
        
        for remainder, fraction_index in fraction_remainders[:remaining]:
            fraction_sizes[fraction_index] += 1

        # finally, now that we have our counts, build the result array!
        fractions = []
        start = 0
        for size in fraction_sizes:
            fractions.append(items[start:start + size])
            start += size

        return fractions

    @staticmethod
    def fractionate_with_spike[T: ProteinEntry](
        items: Sequence[T],
        n_fractions: int,
        offset: float = 0.025
    ) -> Sequence[Sequence[T]]:
        """
        literally puts all proteins in items into a spike at offset% of the fractions
        """
        if n_fractions <= 0:
            return []
        if not items:
            return [[] for _ in range(n_fractions)]

        spike_index = math.floor(offset*n_fractions)
        fractions: list[Sequence[T]] = [[] for _ in range(0, spike_index)]
        fractions.append(items)
        fractions.extend([] for _ in range(spike_index+1, n_fractions))

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

    @staticmethod
    def convert_fasta_to_protein_entries(fasta: str):
        
        records = Fractionation.parse_fasta_text(fasta)
        entries: list[Fractionation.ProteinEntry] = []
        skipped = 0
        
        for record in records:
            sequence = Fractionation.normalize_sequence(str(record.seq))
            
            if not sequence:
                skipped += 1
                continue
            
            entries.append(
                Fractionation.ProteinEntry(
                    seq_id=record.id,
                    description=record.description,
                    sequence=sequence,
                )
            )
            
        return entries, skipped
