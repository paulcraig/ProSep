from __future__ import annotations

from dataclasses import dataclass
from typing import Any, ClassVar

from Bio.SeqUtils.ProtParam import ProteinAnalysis

from backend.logic.fractionation.binding_strength_fractionation import (
    BindingStrengthFractionation,
)
from backend.logic.fractionation.fractionation import Fractionation


class IonExchangeFractionation:
    @dataclass
    class ProteinEntry(BindingStrengthFractionation.ProteinEntry):
        charge: float

        def to_json(self):
            return {
                **super().to_json(),
                "charge": round(self.charge, 2),
            }

    MEDIA_TO_EXCHANGER: ClassVar = {
        "Q": "anion",  # positively charged resin, binds negative proteins
        "S": "cation",  # negatively charged resin, binds positive proteins
    }

    @staticmethod
    def process(
        fasta_content: str,
        salt_elbow_location: float,
        max_salt_delta: float,
        ph: float = 7.0,
        media_type: str = "Q",
        salt_start: float = 0.0,
        salt_end: float = 1.5,
        fraction_count: int = 80,
        noise: float = 0.10,
        deadband: float = 0.05,
        salt_alpha: float = 1.2,
    ) -> dict[str, Any]:
        """
        Main IEF simulation function.

        Parameters:
        - ph: pH used to compute net charge
        - media_type: resin media (Q anion / S cation)
        - salt_start / salt_end: salt conditions
        - fraction_count: number of output fractions
        - noise: overlap between fractions
        - deadband: minimum binding strength needed to retain a protein
        - salt_alpha: how strongly salt weakens binding
        """
        if media_type not in IonExchangeFractionation.MEDIA_TO_EXCHANGER:
            raise ValueError("media_type must be one of: Q, S")

        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")
        if noise < 0:
            raise ValueError("noise must be >= 0")
        if deadband < 0:
            raise ValueError("deadband must be >= 0")
        if salt_start < 0 or salt_end < 0:
            raise ValueError("salt concentrations must be >= 0")
        if salt_elbow_location < 0 or salt_elbow_location > 1:
            raise ValueError("salt elbow location must be between 0 and 1")

        exchanger = IonExchangeFractionation.MEDIA_TO_EXCHANGER[media_type]

        basic_entries, skipped = Fractionation.convert_fasta_to_protein_entries(fasta_content)
        entries: list[IonExchangeFractionation.ProteinEntry] = []
        for basic_entry in basic_entries:
            try:
                analyzer = ProteinAnalysis(basic_entry.sequence)
                charge = float(analyzer.charge_at_pH(ph))

                is_electrically_attracted = (exchanger == "anion" and charge < 0) or (exchanger == "cation" and charge > 0)

                binding_strength = float(abs(charge)) if is_electrically_attracted else 0.0

                entries.append(
                    IonExchangeFractionation.ProteinEntry(
                        seq_id=basic_entry.seq_id,
                        description=basic_entry.description,
                        sequence=basic_entry.sequence,
                        charge=charge,
                        binding_strength=binding_strength,
                    )
                )

            except Exception:
                skipped += 1
                continue
            
        def is_protein_kicked_by_salt(protein: IonExchangeFractionation.ProteinEntry, salt_at_fraction: float) -> bool:
            return protein.binding_strength < salt_at_fraction
        fractions, wash_count, non_wash_count = BindingStrengthFractionation.distribute(
            entries,
            fraction_count,
            is_protein_kicked_by_salt,
            salt_start,
            salt_end,
            salt_elbow_location,
            salt_alpha,
            max_salt_delta
        )

        return {
            "ok": True,
            "params": {
                "pH": ph,
                "mediaType": media_type,
                "exchanger": exchanger,
                "saltStart": salt_start,
                "saltEnd": salt_end,
                "saltAlpha": salt_alpha,
                "saltElbowLocation": salt_elbow_location,
                "maxSaltDelta": max_salt_delta,
                "fractions": fraction_count,
                "overlap": noise,
                "deadband": deadband,
            },
            "counts": {
                "total": wash_count + non_wash_count,
                "wash": wash_count,
                "retained": non_wash_count,
                "skipped": skipped,
            },
            "fractions": Fractionation.process_fractions(fractions),
        }
