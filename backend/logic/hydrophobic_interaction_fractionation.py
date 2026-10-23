from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar

from backend.logic.fractionation.binding_strength_fractionation import (
    BindingStrengthFractionation,
)
from backend.logic.fractionation.fractionation import Fractionation


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
    class ProteinEntry(BindingStrengthFractionation.ProteinEntry):
        # Computed physical / simulation properties
        hydro_effective: float

        def to_json(self):
            return {
                **super().to_json(),
                "hydrophobicity": round(self.hydro_effective, 4),
            }

    # Relative ligand strengths for different HIC stationary phases
    # Stronger ligand -> stronger hydrophobic interaction
    LIGAND_FACTORS: ClassVar = {
        "butyl": 1.00,
        "octyl": 1.25,
        "phenyl": 1.45,
    }

    # Kyte-Doolittle hydrophobicity scale
    # Higher value = more hydrophobic
    HYDRO_SCALE: ClassVar = {
        "A": 1.8,
        "C": 2.5,
        "D": -3.5,
        "E": -3.5,
        "F": 2.8,
        "G": -0.4,
        "H": -3.2,
        "I": 4.5,
        "K": -3.9,
        "L": 3.8,
        "M": 1.9,
        "N": -3.5,
        "P": -1.6,
        "Q": -3.5,
        "R": -4.5,
        "S": -0.8,
        "T": -0.7,
        "V": 4.2,
        "W": -0.9,
        "Y": -1.3,
    }

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
        for i in range(len(sequence) - window + 1):
            seg = sequence[i : i + window]
            seg_score = HydrophobicInteractionFractionation._hydro_score(seg)
            best = max(best, seg_score)
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
    def process(
        fasta_content: str,
        ligand_type: str = "butyl",
        salt_start: float = 1.5,
        salt_end: float = 0.0,
        fraction_count: int = 80,
        noise: float = 0.10,
        deadband: float = 0.15,
        salt_alpha: float = 1.2,
    ) -> dict[str, Any]:
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

        # Convert selected ligand into a numeric factor
        ligand_factor = HydrophobicInteractionFractionation.LIGAND_FACTORS[ligand_type]

        # Salt increase hydrophobic binding; this is a scaling factor
        salt_factor = (salt_start + 1e-9) ** float(salt_alpha)

        basic_entries, skipped = Fractionation.convert_fasta_to_protein_entries(fasta_content)
        entries: list[HydrophobicInteractionFractionation.ProteinEntry] = []
        for basic_entry in basic_entries:
            try:
                hydro_total = HydrophobicInteractionFractionation._hydro_score(basic_entry.sequence)
                hydro_patch = HydrophobicInteractionFractionation._max_patch_score(basic_entry.sequence, window=10)
                hydro_effective = HydrophobicInteractionFractionation._effective_hydrophobicity(
                    h_total=hydro_total,
                    h_patch=hydro_patch,
                    length=len(basic_entry.sequence),
                )

                # Final binding score = protein hydrophobicity x ligand factor x salt factor
                binding_strength = float(hydro_effective * ligand_factor * salt_factor)

                entries.append(
                    HydrophobicInteractionFractionation.ProteinEntry(
                        description=basic_entry.description,
                        seq_id=basic_entry.seq_id,
                        sequence=basic_entry.sequence,
                        binding_strength=binding_strength,
                        hydro_effective=hydro_effective,
                    )
                )

            except Exception:
                skipped += 1

        # Split proteins into wash vs retained
        wash: list[HydrophobicInteractionFractionation.ProteinEntry] = []
        retained: list[HydrophobicInteractionFractionation.ProteinEntry] = []

        for entry in entries:
            if entry.binding_strength < deadband:
                wash.append(entry)
            else:
                retained.append(entry)

        # Weakest binder first, strongest binder last
        # This defines elution order across fractions
        retained.sort(key=lambda item: item.binding_strength)

        # Split retained proteins into output fractions
        fraction_lists = Fractionation.fractionate_with_overlap(items=retained, n_fractions=fraction_count, overlap=noise)

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
            "wash": [entry.to_json() for entry in wash],
            "fractions": Fractionation.process_fractions(fraction_lists),
        }
