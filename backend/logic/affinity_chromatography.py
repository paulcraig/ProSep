from __future__ import annotations
from backend.utility.protein import Protein

from typing import Any, Dict

from backend.logic.fractionation.fractionation import Fractionation

class AffinityChromatography:
    """
    Simulates affinity chromatography.

    Main idea:
    - Each different ligand in affinity chromatography bonds to different "motifs" at different strengths
    - Divide all proteins into either strongly binded, weakly binded, or unbinded
    - Wash comes out in first 1/2 fractions
    - Weakly binded comes out in next 1/4 fractions
    - Strongly bound comes out in next 1/4 fractions
    """
    
    @staticmethod
    def process (fasta_content: str, prosite_strong: str, prosite_weak: str, fraction_count: int = 80, noise: float = 0.10) -> Dict[str, Any]:
        """
        Main affinity chromatography simulation function.

        Parameters:
        - prosite_strong: the PROSITE motif that matches strongly bound proteins
        - prosite_weak: the PROSITE motif that matches weakly bound proteins
        - fraction_count: number of output fractions
        - noise: overlap between fractions
        """
        
        if fraction_count < 4:
            raise ValueError("fraction_count must be at least 4")
        if noise < 0:
            raise ValueError("noise must be >= 0")
        
        # Parse all input FASTA records
        entries, skipped = Fractionation.convert_fasta_to_protein_entries(fasta_content)

        # 1. "extract" (filter and remove) all strongly bound proteins
        strongly_bound = [entry for entry in entries if Protein.matches_prosite(entry.sequence, prosite_strong)]
        unbound =  [entry for entry in entries if not Protein.matches_prosite(entry.sequence, prosite_strong)]
        
        # 2. "extract" (filter and remove) all weakly bound proteins
        weakly_bound = [entry for entry in entries if Protein.matches_prosite(entry.sequence, prosite_weak)]
        unbound =  [entry for entry in unbound if not Protein.matches_prosite(entry.sequence, prosite_weak)]
        
        # now we have 3 our 3 lists! divide them cool-ly into the fractions
        # this is a very convoluted way to get the following ratios: 1/2 1/4 1/4
        wash_fractions = fraction_count // 2
        weak_fractions = (fraction_count - wash_fractions) // 2
        strong_fractions = fraction_count - (wash_fractions + weak_fractions)

        offset = 0.025 # offset fraction distributions by 1/40th of the fractions

        fractions = list(Fractionation.fractionate_with_inverse_gaussian(unbound, wash_fractions, offset=offset*2))
        fractions.extend(Fractionation.fractionate_with_inverse_gaussian(weakly_bound, weak_fractions, offset=offset*4))
        fractions.extend(Fractionation.fractionate_with_spike(strongly_bound, strong_fractions, offset=offset*4))

        return {
            "ok": True,
            "params": {
                "fractions": fraction_count,
            },
            "counts": {
                "total": len(entries),
                "strongly_bound": len(strongly_bound),
                "weakly_bound": len(weakly_bound),
                "unbound": len(unbound),
                "skipped": skipped,
            },
            "fraction_counts": {
                "wash_fractions": wash_fractions,
                "weak_fractions": weak_fractions,
                "strong_fractions": strong_fractions
            },
            "fractions": Fractionation.process_fractions(fractions)
        }