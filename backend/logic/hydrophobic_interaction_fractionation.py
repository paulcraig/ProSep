from __future__ import annotations

import math
import random
from dataclasses import dataclass
from io import StringIO
from typing import Any, Dict, List

from Bio import SeqIO

class HydrophobicInteractionFractionation:
    """
    Simulates hydrophobic interaction chromatography (HIC).

    Main idea:
    - Proteins with more hydrophobic character bind more strongly
    - Higher starting salt strengthens hydrophobic binding
    - Proteins below the deadband go to wash
    - Retained proteins are sorted weakest -> strongest binder
    - Retained proteins are then split into fractions with optional overlap/noise
    """
    
    @dataclass
    class ProteinEntry:
        # Basic identifying information
        seq_id: str
        description: str
        sequence: str
        
        # Computed physical / simulation properties
        molecular_weight: float
        hydro_total: float
        hydro_patch: float
        hydro_effective: float
        binding_strength: float
    
    # Relative ligand strengths for different HIC stationary phases
    # Stronger ligand -> stronger hydrophobic interaction
    LIGAND_FACTORS = {
        "butyl": 1.00,
        "octyl": 1.25,
        "phenyl": 1.45,
    }
    
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
    
    # Kyte-Doolittle hydrophobicity scale
    # Higher value = more hydrophobic
    HYDRO_SCALE = {
        "A": 1.8,  "C": 2.5,  "D": -3.5, "E": -3.5, "F": 2.8,
        "G": -0.4, "H": -3.2, "I": 4.5,  "K": -3.9, "L": 3.8,
        "M": 1.9,  "N": -3.5, "P": -1.6, "Q": -3.5, "R": -4.5,
        "S": -0.8, "T": -0.7, "V": 4.2,  "W": -0.9, "Y": -1.3,
    }
    
    @staticmethod
    def _stable_color(seed: str) -> str:
        """
        Generate a deterministic color from a protein ID.
        This keeps the same protein visually consistent across renders.
        """
        rnd = random.Random(seed)
        return "#%02x%02x%02x" % (
            rnd.randint(40, 220),
            rnd.randint(40, 220),
            rnd.randint(40, 220),
        )
        
    @staticmethod
    def _normalize_sequence(sequence: str) -> str:
        """
        Clean up an input sequence:
        - uppercase it
        - replace ambiguous residues
        - remove non-letter characters
        """
        seq = sequence.strip().upper()
        for bad, replacement in HydrophobicInteractionFractionation.NORMALIZATION_MAP.items():
            seq = seq.replace(bad, replacement)
        seq = "".join(ch for ch in seq if ch.isalpha())
        return seq
    
    @staticmethod
    def _parse_fasta_text(fasta_content: str) -> List[Any]:
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
    def _fractionate_with_overlap(items: List[ProteinEntry], n_fractions: int, overlap: float) -> List[List[ProteinEntry]]:
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
        overlap_count = int(round(bin_size * overlap))

        fractions: List[List[HydrophobicInteractionFractionation.ProteinEntry]] = []
        for i in range(n_fractions):
            start = max(i * bin_size - overlap_count, 0)
            end = min((i + 1) * bin_size + overlap_count, total)
            fractions.append(items[start:end])

        return fractions
    
    @staticmethod
    def _mw_simple(sequence: str) -> float:
        """
        Approximate molecular weight from residue masses.
        """
        aa_mass = {
            "A": 89.09, "C": 121.15, "D": 133.10, "E": 147.13, "F": 165.19,
            "G": 75.07, "H": 155.16, "I": 131.17, "K": 146.19, "L": 131.17,
            "M": 149.21, "N": 132.12, "P": 115.13, "Q": 146.15, "R": 174.20,
            "S": 105.09, "T": 119.12, "V": 117.15, "W": 204.23, "Y": 181.19,
        }
        if not sequence:
            return 0.0
        return float(sum(aa_mass.get(a, 0.0) for a in sequence))
    
    @staticmethod
    def _hydro_score(sequence: str) -> float:
        """
        Total hydrophobicity over the whole sequence.
        """
        if not sequence:
            return 0.0
        total = 0.0
        for aa in sequence:
            total += HydrophobicInteractionFractionation.HYDRO_SCALE.get(aa, 0.0)
        return float(total)
    
    @staticmethod
    def _max_patch_score(sequence: str, window: int = 10) -> float:
        """
        Find the most hydrophobic local patch in the sequence since HIC binding is often strongly affected by
        local exposed hydrophobic regions, not just overall average hydrophobicity.
        """
        if not sequence:
            return 0.0
        if len(sequence) <= window:
            return HydrophobicInteractionFractionation._hydro_score(sequence)
        
        best = -1e9
        for i in range(0, len(sequence) - window + 1):
            seg = sequence[i : i + window]
            seg_score = HydrophobicInteractionFractionation._hydro_score(seg)
            if seg_score > best:
                best = seg_score
        return float(best)
    
    @staticmethod
    def _effective_hydrophobicity(h_total: float, h_patch: float, length: int) -> float:
        """
        Combine global and local hydrophobicity into a single effective score.

        - total hydrophobicity is normalized by protein length
        - patch score is normalized by the fixed patch size
        - patch is weighted more heavily because local exposed hydrophobicity
          often matters more for binding
        """
        if length <= 0:
            return 0.0
        total_norm = h_total / float(length)
        patch_norm = h_patch / 10.0
        return float(0.35 * total_norm + 0.65 * patch_norm)
    
    @staticmethod
    def process (fasta_content: str, ligand_type: str = "butyl", salt_start: float = 1.5, salt_end: float = 0.0, fraction_count: int = 80, noise: float = 0.10, deadband: float = 0.15, salt_alpha: float = 1.2) -> Dict[str, Any]:
        """
        Main HIC simulation function.

        Parameters:
        - ligand_type: resin ligand strength
        - salt_start / salt_end: salt conditions
        - fraction_count: number of output fractions
        - noise: overlap between fractions
        - deadband: minimum binding strength needed to retain a protein
        - salt_alpha: how strongly salt boosts binding
        """
        ligand_type = ligand_type.lower().strip()
        if ligand_type not in HydrophobicInteractionFractionation.LIGAND_FACTORS:
            raise ValueError("ligand_type must be one of: butyl, octyl, phenyl")
        
        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")
        if noise < 0:
            raise ValueError("noise must be >= 0")
        if deadband < 0:
            raise ValueError("deadband must be >= 0")
        if salt_start < 0 or salt_end < 0:
            raise ValueError("salt concentrations must be >= 0")
        
        # Parse all input FASTA records
        records = HydrophobicInteractionFractionation._parse_fasta_text(fasta_content)
        
        entries: List[HydrophobicInteractionFractionation.ProteinEntry] = []
        skipped = 0
        
        # Convert selected ligand into a numeric factor
        ligand_factor = HydrophobicInteractionFractionation.LIGAND_FACTORS[ligand_type]
        
        # Salt increase hydrophobic binding; this is a scaling factor
        salt_factor = (salt_start + 1e-9) ** float(salt_alpha)
        
        # Process each protein record
        for record in records:
            sequence = HydrophobicInteractionFractionation._normalize_sequence(str(record.seq))
            if not sequence:
                skipped += 1
                continue
            
            try:
                mw = HydrophobicInteractionFractionation._mw_simple(sequence)
                h_total = HydrophobicInteractionFractionation._hydro_score(sequence)
                h_patch = HydrophobicInteractionFractionation._max_patch_score(sequence, window=10)
                h_eff = HydrophobicInteractionFractionation._effective_hydrophobicity(h_total=h_total, h_patch=h_patch, length=len(sequence))
                
                # Final binding score = protein hydrophobicity x ligand factor x salt factor
                binding_strength = float(h_eff * ligand_factor * salt_factor)
            except Exception:
                skipped += 1
                continue
            
            entries.append(
                HydrophobicInteractionFractionation.ProteinEntry(
                    seq_id=record.id,
                    description=record.description,
                    sequence=sequence,
                    molecular_weight=mw,
                    hydro_total=h_total,
                    hydro_patch=h_patch,
                    hydro_effective=h_eff,
                    binding_strength=binding_strength,       
                )
            )
        
        # Split proteins into wash vs retained
        wash: List[HydrophobicInteractionFractionation.ProteinEntry] = []
        retained: List[HydrophobicInteractionFractionation.ProteinEntry] = []
        
        for entry in entries:
            if entry.binding_strength < deadband:
                wash.append(entry)
            else:
                retained.append(entry)
        
        # Weakest binder first, strongest binder last
        # This defines elution order across fractions
        retained.sort(key=lambda item: item.binding_strength)
        
        # Split retained proteins into output fractions
        fraction_lists = HydrophobicInteractionFractionation._fractionate_with_overlap(items=retained, n_fractions=fraction_count, overlap=noise)
        
        def pack(entry: HydrophobicInteractionFractionation.ProteinEntry) -> Dict[str, Any]:
            """
            Convert internal ProteinEntry object into JSON-safe frontend data.
            """
            name = " ".join(entry.description.split(" ")[1:]) if " " in entry.description else entry.description
            return {
                "name": name,
                "id": entry.seq_id,
                "description": entry.description,
                "sequence": entry.sequence,
                "molecularWeight": round(entry.molecular_weight, 2),
                "hydrophobicity": round(entry.hydro_effective, 4),
                "bindingStrength": round(entry.binding_strength, 4),
                "color": HydrophobicInteractionFractionation._stable_color(entry.seq_id),
            }
        
        # Final response for the frontend
        return {
            "ok": True,
            "params": {
                "ligandType": ligand_type,
                "saltStart": salt_start,
                "saltEnd": salt_end,
                "saltAlpha": salt_alpha,
                "fractions": fraction_count,
                "overlap": noise,
                "deadband": deadband,
            },
            "counts": {
                "total": len(entries),
                "wash": len(wash),
                "retained": len(retained),
                "skipped": skipped,
            },
            "wash": [pack(entry) for entry in wash],
            "fractions": [
                {
                    "fractionIndex": index + 1,
                    "proteinCount": len(fraction),
                    "hitCount": 0,
                    "hitProteinIds": [],
                    "proteins": [pack(entry) for entry in fraction],
                }
                for index, fraction in enumerate(fraction_lists)
            ],
        }
                
            
        
            
        
        
        