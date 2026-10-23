import math
from typing import Any, Dict, List, Tuple

from Bio.SeqUtils.ProtParam import ProteinAnalysis as PA
from backend.logic.ion_exchange_fractionation import IonExchangeFractionation
from backend.utility.protein import Protein
from backend.logic.fractionation.fractionation import Fractionation
class SizeExclusionFractionation:
    
  @staticmethod
  def process(
         
        fasta_content: str,
         gel_name: str,
         min_size: int,
         max_size: int,
         proteinList: List[Fractionation.ProteinEntry],
         fraction_count: int,
    ) -> Dict[str, Any]:
        """
        based off of ion_exchange_fraction file. Uses the same protein format as what that uses to make both of these compatable with each other.
        will parse fasta file unless giving a protein list of size 1 or more.
        
        """
        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")

        entries, skipped = Fractionation.convert_fasta_to_protein_entries(fasta_content)

        to_big: List[Fractionation.ProteinEntry] = []
        to_small: List[Fractionation.ProteinEntry] = []
        inside:List[Fractionation.ProteinEntry] = []

        for entry in entries:
            seq = entry.sequence.replace("X", "Q")
            entry.molecular_weight = PA(seq).molecular_weight()
            if entry.molecular_weight < min_size:
                to_small.append(entry)  # return ID or sequence
            elif entry.molecular_weight >max_size:
                to_big.append(entry)
            else:
                inside.append(entry)

        # Largest elutes first
        elution_order = sorted(inside, key=lambda item: item.molecular_weight, reverse=True)

        fraction_lists = Fractionation.fractionate_with_overlap(
            items=elution_order,
            n_fractions=fraction_count,
            overlap=0.0,
        )

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
                "inside": len(inside),
                "skipped": skipped,
            },
          
           
            "wash": [entry.to_json() for entry in to_big],
            "fractions": Fractionation.process_fractions(fraction_lists),
            "afterWash": [entry.to_json() for entry in to_small],
                }
