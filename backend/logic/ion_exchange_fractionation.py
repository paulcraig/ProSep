from __future__ import annotations
from backend.utility.protein import Protein

import math
import random
from dataclasses import dataclass
from io import StringIO
from typing import Any, Dict, List

from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis

from fractionation.fractionation import Fractionation


class IonExchangeFractionation:
    @dataclass
    class ProteinEntry:
        seq_id: str
        description: str
        sequence: str
        charge: float
        molecular_weight: float
        binding_strength: float = 0.0

    MEDIA_TO_EXCHANGER = {
        "Q": "anion",   # positively charged resin, binds negative proteins
        "S": "cation",  # negatively charged resin, binds positive proteins
    }

    NORMALIZATION_MAP = {
        "X": "Q",
        "B": "D",
        "Z": "E",
        "J": "L",
        "U": "C",
        "O": "K",
        "*": "",
    }

    @staticmethod
    def _normalize_sequence(sequence: str) -> str:
        seq = sequence.strip().upper()
        for bad, replacement in IonExchangeFractionation.NORMALIZATION_MAP.items():
            seq = seq.replace(bad, replacement)
        seq = "".join(ch for ch in seq if ch.isalpha())
        return seq

    @staticmethod
    def _parse_fasta_text(fasta_content: str) -> List[Any]:
        content = fasta_content.strip()
        if not content:
            return []

        if ">" not in content:
            content = f">uploaded_sequence\n{content}\n"

        handle = StringIO(content)
        return list(SeqIO.parse(handle, "fasta"))

    @staticmethod
    def _fractionate_with_overlap(
        items: List[ProteinEntry],
        n_fractions: int,
        overlap: float,
    ) -> List[List[ProteinEntry]]:
        """
        Split retained proteins into n_fractions with optional overlap.
        Overlap is a fraction of nominal bin size.
        """
        if n_fractions <= 0:
            return []
        if not items:
            return [[] for _ in range(n_fractions)]

        total = len(items)
        bin_size = math.ceil(total / n_fractions)
        overlap_count = int(round(bin_size * overlap))

        fractions: List[List[IonExchangeFractionation.ProteinEntry]] = []
        for i in range(n_fractions):
            start = max(i * bin_size - overlap_count, 0)
            end = min((i + 1) * bin_size + overlap_count, total)
            fractions.append(items[start:end])

        return fractions

    @staticmethod
    def process(
        fasta_content: str,
        ph: float = 7.0,
        media_type: str = "Q",
        salt_start: float = 0.0,
        salt_end: float = 1.5,
        fraction_count: int = 80,
        noise: float = 0.10,
        deadband: float = 0.05,
        salt_alpha: float = 1.2,
    ) -> Dict[str, Any]:
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

        records = IonExchangeFractionation._parse_fasta_text(fasta_content)
        exchanger = IonExchangeFractionation.MEDIA_TO_EXCHANGER[media_type]

        # Salt competes with protein charge for the exchanger
        salt_factor = (salt_start + 1.0) ** float(-salt_alpha)

        entries: List[IonExchangeFractionation.ProteinEntry] = []
        skipped = 0

        for record in records:
            sequence = IonExchangeFractionation._normalize_sequence(str(record.seq))
            if not sequence:
                skipped += 1
                continue

            try:
                analyzer = ProteinAnalysis(sequence)
                charge = float(analyzer.charge_at_pH(ph))
                molecular_weight = float(analyzer.molecular_weight())

                is_electrically_attracted = (exchanger == "anion" and charge < 0) or (exchanger == "cation" and charge > 0)

                binding_strength = float(abs(charge) * salt_factor) if is_electrically_attracted else 0.0
            except Exception:
                skipped += 1
                continue

            entries.append(
                IonExchangeFractionation.ProteinEntry(
                    seq_id=record.id,
                    description=record.description,
                    sequence=sequence,
                    charge=charge,
                    molecular_weight=molecular_weight,
                    binding_strength=binding_strength,
                )
            )

        wash: List[IonExchangeFractionation.ProteinEntry] = []
        retained: List[IonExchangeFractionation.ProteinEntry] = []

        for entry in entries:
            if entry.binding_strength < deadband:
                wash.append(entry)
            else:
                retained.append(entry)

        # Weakest binder first, strongest binder last
        # This defines elution order across fractions
        retained.sort(key=lambda item: item.binding_strength)

        fraction_lists = IonExchangeFractionation._fractionate_with_overlap(
            items=retained,
            n_fractions=fraction_count,
            overlap=noise,
        )

        def pack(entry: IonExchangeFractionation.ProteinEntry) -> Dict[str, Any]:
            name = " ".join(entry.description.split(" ")[1:]) if " " in entry.description else entry.description
            return {
                "name": name,
                "id": entry.seq_id,
                "description": entry.description,
                "sequence": entry.sequence,
                "molecularWeight": round(entry.molecular_weight, 2),
                "charge": round(entry.charge, 2),
                "bindingStrength": round(entry.binding_strength, 4),
                "color": Fractionation.stable_color(entry.seq_id),
                "amount": 100/math.log(entry.molecular_weight) if entry.molecular_weight > 0 else 1,
            }

        return {
            "ok": True,
            "params": {
                "pH": ph,
                "mediaType": media_type,
                "exchanger": exchanger,
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
        }
