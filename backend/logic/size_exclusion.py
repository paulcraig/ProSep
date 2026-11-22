import math
from typing import Any

from backend.logic.fractionation.fractionation import Fractionation


class SizeExclusionFractionation:
    @staticmethod
    def process(
        fasta_content: str,
        gel_name: str,
        min_size: int,
        max_size: int,
        fraction_count: int,
    ) -> dict[str, Any]:
        """
        based off of ion_exchange_fraction file. Uses the same protein format as what that uses to make both of these compatable with each other.
        will parse fasta file unless giving a protein list of size 1 or more.

        """
        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")

        entries, skipped = Fractionation.convert_fasta_to_protein_entries(fasta_content)

        to_big: list[Fractionation.ProteinEntry] = []
        to_small: list[Fractionation.ProteinEntry] = []
        
        insides: list[list[Fractionation.ProteinEntry]] = [[] for _ in range(fraction_count)]
        size_delta = max_size - min_size

        for entry in entries:
            if entry.molecular_weight < min_size:
                to_small.append(entry)  # return ID or sequence
            elif entry.molecular_weight > max_size:
                to_big.append(entry)
            else:
                extra_size = entry.molecular_weight - min_size # how much bigger the protein is than the minimal size
                location = 1 - (extra_size / size_delta) # [0, 1] if you imagine that theres a "size gradient" from min to max size, then this is how far along that gradient the protein's size matches
                insides[math.floor(location * fraction_count)].append(entry)

        return {
            "ok": True,
            "params": {
                "gelName": gel_name,
                "minSize": min_size,
                "maxSize": max_size,
                "fractions": fraction_count,
            },
            "counts": {
                "total": len(entries),
                "to_small": len(to_small),
                "to_big": len(to_big),
                "inside": len(insides),
                "skipped": skipped,
            },
            "wash": Fractionation.process_fraction(to_big, -1), # -1 since its "before" the fractions
            "fractions": Fractionation.process_fractions(insides),
            "afterWash": Fractionation.process_fraction(to_small, len(insides)),
        }
