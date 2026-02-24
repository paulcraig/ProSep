import logging
import math
import random
from dataclasses import dataclass
from io import StringIO
from typing import Any, Dict, List, Tuple

from fastapi import UploadFile
from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis

logging.basicConfig(level=logging.INFO)

@dataclass
class ProteinEntry:
    seq_id: str
    description: str
    sequence: str
    charge: float
    molecular_weight: float

class IonExchangePrep:
    ACCEPTED_FILE_TYPES = ['fasta', 'faa', 'a']
    
    @staticmethod
    def _stable_color(seed: str) -> str:
        """Generate a stable-ish color from a string seed."""
        rnd = random.Random(seed)
        return '#%02x%02x%02x' % (
            rnd.randint(40, 220),
            rnd.randint(40, 220),
            rnd.randint(40, 220)
        )
        
    @staticmethod
    def _fractionate(items: List[ProteinEntry], n_fractions: int, overlap: float) -> List[List[ProteinEntry]]:
        """
        Split list into n_fractions, with optional overlap.
        Overlap is expressed as a fraction of the nominal bin size.
        """
        if n_fractions <= 0:
            return []
        if not items:
            return [[] for _ in range(n_fractions)]
        
        total = len(items)
        bin_size = math.ceil(total / n_fractions)
        ov = int(round(bin_size * overlap))
        
        fractions: List[List[ProteinEntry]] = []
        for i in range(n_fractions):
            start = i * bin_size - ov
            end = (i + 1) * bin_size + ov
            start = max(start, 0)
            end = min(end, total)
            fractions.append(items[start:end])
        
        return fractions
    
    @staticmethod
    def _parse_fasta(file: UploadFile) -> List[Tuple[str, str, str]]:
        """
        Returns list of tuples: (seq_id, description, sequence_string)
        """
        content = file.file.read().decode("utf-8")
        handle = StringIO(content)
        parsed = []
        for rec in SeqIO.parse(handle, "fasta"):
            parsed.append((rec.id, rec.description, str(rec.seq)))
        return parsed
    
    @staticmethod
    def run(file: UploadFile, pH: float = 7.0, exchanger: str = "anion", fractions: int = 7, overlap: float = 0.10, deadband: float = 0.05) -> Dict[str, Any]:
        """
        exchanger:
          - "anion": positive resin binds NEGATIVE proteins
          - "cation": negative resin binds POSITIVE proteins
        deadband:
          - if abs(charge) < deadband -> treated as non-binder (wash)
        """
        try:
            filetype = (file.filename or "").strip(".")[-1].lower()
            if filetype not in IonExchangePrep.ACCEPTED_FILE_TYPES:
                return {
                    "ok": False,
                    "error": f"Unsupported file type: .{filetype}",
                    "accepted": IonExchangePrep.ACCEPTED_FILE_TYPES,
                }
            
            exchanger_norm = (exchanger or "").strip().lower()
            if exchanger_norm not in ("anion", "cation"):
                return {
                    "ok": False,
                    "error": "Invalid exchanger. Use 'anion' or 'cation'.",
                }
            
            parsed = IonExchangePrep._parse_fasta(file)
            
            entries: List[ProteinEntry] = []
            for seq_id, desc, seq in parsed:
                if not seq:
                    continue
                analysis = ProteinAnalysis(seq)
                charge = float(analysis.charge_at_pH(pH))
                mw = float(analysis.molecular_weight())
                entries.append(
                    ProteinEntry(
                        seq_id=seq_id,
                        description=desc,
                        sequence=seq,
                        charge=charge,
                        molecular_weight=mw,
                    )
                )
            
            # Binding Logic
            wash: List[ProteinEntry] = []
            retained: List[ProteinEntry] = []
            
            for e in entries:
                if abs(e.charge) < deadband:
                    wash.append(e)
                    continue
                if exchanger_norm == "anion":
                    if e.charge <= -deadband:
                        retained.append(e)
                    else:
                        wash.append(e)
            
            # Elution order: weak binders first -> strong binders last
            # Use abs(charge) as a simple proxy for binding strength.
            retained.sort(key=lambda x: abs(x.charge))
            
            # Split retained into fractions
            fraction_lists = IonExchangePrep._fractionate(retained, fractions, overlap)
            
            # Serialize for frontend
            def pack(e: ProteinEntry) -> Dict[str, Any]:
                # Try to mimic existing 1DE return format + add sample-prep extras
                name = " ".join(e.description.split(" ")[1:]) if " " in e.description else e.description
                return {
                    "name": name,
                    "id": e.seq_id,
                    "description": e.description,
                    "sequence": e.sequence,
                    "molecularWeight": e.molecular_weight,
                    "charge": e.charge,
                    "color": IonExchangePrep._stable_color(e.seq_id), 
                }
                
            return {
                "ok": True,
                "params": {
                    "pH": pH,
                    "exchanger": exchanger_norm,
                    "fractions": fractions,
                    "overlap": overlap,
                    "deadband": deadband,
                },
                "counts": {
                    "total": len(entries),
                    "wash": len(wash),
                    "retained": len(retained),
                },
                "wash": [pack(e) for e in wash],
                "fractions": [
                    {
                        "fractionIndex": i + 1,
                        "proteins": [pack(e) for e in frac],
                    }
                    for i, frac in enumerate(fraction_lists)
                ],
            }
        
        except Exception as e:
            logging.exception("Ion Exchange sample prep failed")
            return {"ok": False, "error": str(e)}
        finally:
            try:
                file.file.close()
            except Exception:
                pass
                
    