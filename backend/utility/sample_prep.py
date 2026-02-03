from __future__ import annotations

from dataclasses import dataclass
from io import StringIO
from typing import Dict, List, Literal, Tuple

from Bio import SeqIO
from Bio.SeqRecord import SeqRecord

from .protein import Protein

Method = Literal["ion_exchange", "size_exclusion", "affinity"]
IonMode = Literal["cation", "anion"]

@dataclass(frozen=True)
class ProteinEntry:
    id_str: str
    name: str
    seq: str
    mw: float
    
def _to_entries_from_fasta_text(fasta_text: str) -> List[ProteinEntry]:
    buffer = StringIO(fasta_text)
    records: List[SeqRecord] = list(SeqIO.parse(buffer, "fasta"))
    out: List[ProteinEntry] = []
    
    for i, rec in enumerate(records):
        seq = str(rec.seq)
        rid = (rec.id or rec.name or f"protein_{i+1}").strip()
        out.append(
            ProteinEntry(
                id_str=rid,
                name=rid,
                seq=seq,
                mw=float(Protein.get_mw(seq)),
            )
        )
    
    return out

def _estimate_net_charge(seq: str, ph: float) -> float:
    seq = seq.upper()
    if not seq:
        return 0.0
    
    # pKa values for ionizable groups
    pka_n_term = 9.69
    pka_c_term = 2.34
    pka = {
        "D": 3.90,
        "E": 4.07,
        "C": 8.18,
        "Y": 10.46,
        "H": 6.04,
        "K": 10.54,
        "R": 12.48,
    }
    
    # Count residues
    counts: Dict[str, int] = {}
    for aa in seq:
        counts[aa] = counts.get(aa, 0) + 1
    
    # Positive groups: N-term, K, R, H
    pos = 0.0
    
    # N-terminus contribution
    pos += 1.0 / (1.0 + 10.0 ** (ph - pka_n_term))
    
    # K, R, H side chains
    for aa, pka_val in (("K", pka["K"]), ("R", pka["R"]), ("H", pka["H"])):
        n = counts.get(aa, 0)
        if n:
            pos += n * (1.0 / (1.0 + 10.0 ** (ph - pka_val)))
    
    # Negative groups: C-term, D, E, C, Y
    neg = 0.0
    neg += 1.0 / (1.0 + 10.0 ** (pka_c_term - ph))
    for aa, pka_val in (("D", pka["D"]), ("E", pka["E"]), ("C", pka["C"]), ("Y", pka["Y"])):
        n = counts.get(aa, 0)
        if n:
            neg += n * (1.0 / (1.0 + 10.0 ** (pka_val - ph)))
    
    return pos - neg

def _his_affinity_score(seq: str) -> float:
    seq = seq.upper()
    if not seq:
        return 0.0
    length = len(seq)
    h_count = seq.count("H")
    frac = h_count / max(1, length)
    
    bonus = 0.0
    if "HHH" in seq:
        bonus += 0.10
    
    # crude motif bonus
    for i in range(len(seq) - 2):
        if seq[i] == "H" and seq[i + 2] == "H":
            bonus += 0.005
    
    return frac + bonus

def _bin_sorted(entries: List[ProteinEntry], fraction_count: int) -> List[List[ProteinEntry]]:
    n = len(entries)
    if fraction_count <= 0:
        return []
    if n == 0:
        return [[] for _ in range(fraction_count)]
    
    bins: List[List[ProteinEntry]] = [[] for _ in range(fraction_count)]
    for idx, e in enumerate(entries):
        # even-ish distribution
        bin_idx = int(idx * fraction_count / n)
        bin_idx = min(fraction_count - 1, max(0, bin_idx))
        bins[bin_idx].append(e)
    return bins
