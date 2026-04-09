from typing import Any, Dict, List

from Bio.SeqUtils.ProtParam import ProteinAnalysis as PA
from backend.logic.ion_exchange_fractionation import IonExchangeFractionation
class SizeExclusionFractionation:
  def _set_protien_list(fasta_content,proteins:IonExchangeFractionation.ProteinEntry) -> List[IonExchangeFractionation.ProteinEntry]:
    records = IonExchangeFractionation._parse_fasta_text(fasta_content)
    if len(proteins) > 0:
        return proteins
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
    return entries
    
  def process(
         
        fasta_content: str,
         min_size: int,
         max_size: int,
         proteinList: List[IonExchangeFractionation.ProteinEntry]
    ) -> Dict[str, Any]:
        """
        based off of ion_exchange_fraction file. Uses the same protein format as what that uses to make both of these compatable with each other.
        will parse fasta file unless giving a protein list of size 1 or more.
        
        """
        print(fasta_content)
        entries = SizeExclusionFractionation._set_protien_list(fasta_content,proteinList)

        to_big: List[IonExchangeFractionation.ProteinEntry] = []
        to_small: List[IonExchangeFractionation.ProteinEntry] = []
        inside:List[IonExchangeFractionation.ProteinEntry] = []

        for entry in entries:
            print()
           
            seq = entry.sequence.replace("X", "Q")
            entry.molecular_weight = PA(seq).molecular_weight()
            print(entry.molecular_weight)
            if entry.molecular_weight < min_size:
                to_small.append(entry)  # return ID or sequence
            elif entry.molecular_weight >max_size:
                to_big.append(entry)
            else:
                inside.append(entry)

        def pack(entry: IonExchangeFractionation.ProteinEntry) -> Dict[str, Any]:
            name = " ".join(entry.description.split(" ")[1:]) if " " in entry.description else entry.description
            return {
                "name": name,
                "id": entry.seq_id,
                "description": entry.description,
                "sequence": entry.sequence,
                "molecularWeight": round(entry.molecular_weight, 2),
                "charge":"n/a",
                "color": IonExchangeFractionation._stable_color(entry.seq_id),
            }

        return {
            "ok": True,
           
            "counts": {
                "total": len(entries),
                "to_small": len(to_small),
                "to_big": len(to_big),
                "inside": len(inside),
            },
          
           
            "proteins": [pack(entry) for entry in inside],
                }
               
      

