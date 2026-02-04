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

def _entries_to_fasta(entries: List[ProteinEntry]) -> str:
    out = StringIO()
    recs = []
    for e in entries:
        recs.append(SeqRecord(seq=e.seq, id=e.id_str, description=""))
        
    # SeqRecord(seq=...) expects Seq; BioPython accepts str too, but be explicit if needed.
    # To keep dependency minimal, just write manually if SeqRecord complains.
    
    try: 
        SeqIO.write(recs, out, "fasta")
        return out.getvalue()
    except Exception:
        # manual FASTA fallback
        lines = []
        for e in entries:
            lines.append(f">{e.id_str}")
            s = e.seq
            for i in range(0, len(s), 60):
                lines.append(s[i : i + 60])
        return "\n".join(lines) + ("\n" if lines else "")

def _entries_to_1de_protein_dicts(entries: List[ProteinEntry], *, start_id_num: int = 1) -> List[Dict]:
    out: List[Dict] = []
    for i, e in enumerate(entries):
        out.append(
            {
                "name": e.name,
                "moleularWeight": float(e.mw),
                "color": "blue",
                "id_num": start_id_num + i,
                "id_str": e.id_str,
            }
        )
    return out
        
def run_sample_prep(fasta_text: str, *, method: Method, fraction_count: int = 7, ph: float = 7.0, ion_mode: IonMode = "cation", min_kda: float = 20.0, max_kda: float = 200.0) -> List[Dict]:
    if fraction_count != 7:
        # Per current UI decision: keep 7 fractions fixed for now.
        fraction_count = 7
    
    entries = _to_entries_from_fasta_text(fasta_text)
    
    # Produce fraction bins (list[list[ProteinEntry]])
    bins: List[List[ProteinEntry]]
    
    if method == "size_exclusion":
        # Convert kDa to Da
        min_da = float(min_kda) * 1000.0
        max_da = float(max_kda) * 1000.0
        below = [e for e in entries if e.mw < min_da]
        above = [e for e in entries if e.mw > max_da]
        inside = [e for e in entries if min_da <= e.mw <= max_da]
        inside_sorted = sorted(inside, key=lambda e: e.mw)
        
        # Two fixed buckets + remaining bins
        remaining = max(0, fraction_count - 2)
        inside_bins = _bin_sorted(inside_sorted, remaining) if remaining > 0 else []
        
        bins = []
        bins.append(sorted(below, key=lambda e: e.mw))
        bins.extend(inside_bins)
        bins.append(sorted(above, key=lambda e: e.mw))
        
        # Ensure excatly fraction_count
        if len(bins) < fraction_count:
            bins.extend([[] for _ in range(fraction_count - len(bins))])
        if len(bins) > fraction_count:
            bins = bins[:fraction_count]
    elif method == "ion_exchange":
        # Compute net charge and sort depending on mode.
        scored: List[Tuple[ProteinEntry, float]] = [(e, _estimate_net_charge(e.seq, ph)) for e in entries]
        if ion_mode == "cation":
            scored.sort(key=lambda t: t[1], reverse=True) # most positive first
        else:
            scored.sort(key=lambda t: t[1]) # most negative first
        sorted_entries = [e for e, _ in scored]
        bins = _bin_sorted(sorted_entries, fraction_count)
    elif method == "affinity":
        scored = [(e, _his_affinity_score(e.seq)) for e in entries]
        scored.sort(key=lambda t: t[1], reverse=True)
        sorted_entries = [e for e, _ in scored]
        bins = _bin_sorted(sorted_entries, fraction_count) 
    else:
        raise ValueError(f"Unknown method: {method}")
    
    #Build response
    out: List[Dict] = []
    
    # Keep id_num stable per fraction starting at 1 (each lane independent)
    for i, b in enumerate(bins, start=1):
        frac_name = f"fraction_{i}"
        fasta = _entries_to_fasta(b)
        proteins = _entries_to_1de_protein_dicts(b, start_id_num=1)
        out.append(
            {
                "name": frac_name,
                "display_name": frac_name,
                "count": len(b),
                "filename": f"{frac_name}.fasta",
                "fasta": fasta,
                "proteins": proteins,
            }
        )
    return out

def build_fractions_from_upload(upload_file, *, method: Method, fraction_count: int = 7, ph: float = 7.0, ion_mode: IonMode = "cation", min_kda: float = 20.0, max_kda: float = 200.0) -> List[Dict]:
    try:
        upload_file.file.seek(0)
        raw = upload_file.file.read()
        if isinstance(raw, bytes):
            text = raw.decode("utf-8", errors="replace")
        else:
            text = str(raw)
    except Exception as e:
        raise ValueError(f"Failed to read uploaded file: {e}") from e
    
    return run_sample_prep(text, method=method, fraction_count=fraction_count, ph=ph, ion_mode=ion_mode, min_kda=min_kda, max_kda=max_kda)

    


            
