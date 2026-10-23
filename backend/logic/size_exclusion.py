import math
from typing import Any, Dict, List, Tuple

from Bio.SeqUtils.ProtParam import ProteinAnalysis as PA
from backend.logic.ion_exchange_fractionation import IonExchangeFractionation
from backend.utility.protein import Protein
class SizeExclusionFractionation:
  def _set_protien_list(fasta_content,proteins:List[IonExchangeFractionation.ProteinEntry]) -> Tuple[List[IonExchangeFractionation.ProteinEntry], int]:
    records = IonExchangeFractionation._parse_fasta_text(fasta_content)
    if len(proteins) > 0:
        return proteins, 0
    entries: List[IonExchangeFractionation.ProteinEntry] = []
    skipped = 0

    for record in records:
        sequence = IonExchangeFractionation._normalize_sequence(str(record.seq))
        if not sequence:
            skipped += 1
            continue

        try:
            analyzer = PA(sequence)
            
            molecular_weight = float(analyzer.molecular_weight())
        except Exception:
            skipped += 1
            continue
        entries.append(
                IonExchangeFractionation.ProteinEntry(
                    seq_id=record.id,
                    description=record.description,
                    sequence=sequence,
                    charge="n/a",
                    molecular_weight=molecular_weight,
                ))
    return entries, skipped
    
  @staticmethod
  def process(
         
        fasta_content: str,
         gel_name: str,
         min_size: int,
         max_size: int,
         proteinList: List[IonExchangeFractionation.ProteinEntry],
         fraction_count: int,
    ) -> Dict[str, Any]:
        """
        based off of ion_exchange_fraction file. Uses the same protein format as what that uses to make both of these compatable with each other.
        will parse fasta file unless giving a protein list of size 1 or more.
        
        """
        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")

        entries, skipped = SizeExclusionFractionation._set_protien_list(fasta_content,proteinList)

        to_big: List[IonExchangeFractionation.ProteinEntry] = []
        to_small: List[IonExchangeFractionation.ProteinEntry] = []
        inside:List[IonExchangeFractionation.ProteinEntry] = []

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

        fraction_lists = IonExchangeFractionation._fractionate_with_overlap(
            items=elution_order,
            n_fractions=fraction_count,
            overlap=0.0,
        )

        def pack(entry: IonExchangeFractionation.ProteinEntry) -> Dict[str, Any]:
            name = " ".join(entry.description.split(" ")[1:]) if " " in entry.description else entry.description
            return {
                "name": name,
                "id": entry.seq_id,
                "description": entry.description,
                "sequence": entry.sequence,
                "molecularWeight": round(entry.molecular_weight, 2),
                "color": IonExchangeFractionation._stable_color(entry.seq_id),
                "amount": 100/math.log(entry.molecular_weight) if entry.molecular_weight > 0 else 1,
            }

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
          
           
            "wash": [pack(entry) for entry in to_big],
            "fractions": [
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
                    "proteins": [pack(entry) for entry in fraction],
                }
                for index, fraction in enumerate(fraction_lists)
            ],
            "afterWash": [pack(entry) for entry in to_small],
                }
               
      

