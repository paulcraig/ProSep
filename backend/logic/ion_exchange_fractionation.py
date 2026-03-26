from __future__ import annotations

import math
import random
from dataclasses import dataclass
from io import StringIO
from typing import Any, Dict, List

from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis


class IonExchangeFractionation:
    @dataclass
    class ProteinEntry:
        seq_id: str
        description: str
        sequence: str
        charge: float
        molecular_weight: float

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
    def _stable_color(seed: str) -> str:
        rnd = random.Random(seed)
        return "#%02x%02x%02x" % (
            rnd.randint(40, 220),
            rnd.randint(40, 220),
            rnd.randint(40, 220),
        )

    @staticmethod
    def _get_hist_percent(protstring: str) -> float:
        if not protstring:
            return 0.0
        hcount = 0
        for aa in protstring:
            if aa == "H":
                hcount += 1
        return hcount / len(protstring)

    @staticmethod
    def _find_hist_chains(protstring: str) -> Dict[str, int]:
        chain_dict: Dict[str, int] = {}
        chainlen = 1
        last_aa = ""
        for aa in protstring:
            if aa == "H":
                if last_aa == "H":
                    chainlen += 1
            elif chainlen > 1 and last_aa == "H":
                key = str(chainlen)
                if key in chain_dict:
                    chain_dict[key] = chain_dict[key] + 1
                else:
                    chain_dict[key] = 1
                chainlen = 1
            last_aa = aa

        if chainlen > 1:
            key = str(chainlen)
            if key in chain_dict:
                chain_dict[key] = chain_dict[key] + 1
            else:
                chain_dict[key] = 1
        return chain_dict

    @staticmethod
    def _hist_score(protstring: str) -> int:
        last4 = ""
        last8 = ""
        cd4 = 0
        cd8 = 0
        score = 0
        for aa in protstring:
            if len(last4) < 4:
                last4 += aa
            else:
                last4 = last4[1:] + aa

            if len(last8) < 8:
                last8 += aa
            else:
                last8 = last8[1:] + aa

            if IonExchangeFractionation._get_hist_percent(last4) >= 0.5 and cd4 < 1:
                score += 2
                cd4 = 4
            else:
                cd4 -= 1

            if IonExchangeFractionation._get_hist_percent(last8) >= 0.375 and cd8 < 1:
                score += 6
                cd8 = 8
            else:
                cd8 -= 1

        hist_chains = IonExchangeFractionation._find_hist_chains(protstring)
        for key in hist_chains:
            score += hist_chains[key] * (int(key) ** 2)
        return score

    @staticmethod
    def _param_of_interest(protdata: str) -> bool:
        return bool(IonExchangeFractionation._hist_score(protdata) >= 4)

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
        fraction_count: int = 80,
        noise: float = 0.10,
        deadband: float = 0.05,
    ) -> Dict[str, Any]:
        if media_type not in IonExchangeFractionation.MEDIA_TO_EXCHANGER:
            raise ValueError("media_type must be one of: Q, S")

        if fraction_count < 1:
            raise ValueError("fraction_count must be at least 1")
        if noise < 0:
            raise ValueError("noise must be >= 0")
        if deadband < 0:
            raise ValueError("deadband must be >= 0")

        records = IonExchangeFractionation._parse_fasta_text(fasta_content)
        exchanger = IonExchangeFractionation.MEDIA_TO_EXCHANGER[media_type]

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
                )
            )

        wash: List[IonExchangeFractionation.ProteinEntry] = []
        retained: List[IonExchangeFractionation.ProteinEntry] = []

        for entry in entries:
            if abs(entry.charge) < deadband:
                wash.append(entry)
                continue

            if exchanger == "anion":
                if entry.charge <= -deadband:
                    retained.append(entry)
                else:
                    wash.append(entry)
            else:
                if entry.charge >= deadband:
                    retained.append(entry)
                else:
                    wash.append(entry)

        retained.sort(key=lambda item: abs(item.charge))

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
                "color": IonExchangeFractionation._stable_color(entry.seq_id),
                "amount": random.uniform(1, 10),
            }

        return {
            "ok": True,
            "params": {
                "pH": ph,
                "mediaType": media_type,
                "exchanger": exchanger,
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
                    "hitCount": len([
                        entry for entry in fraction if IonExchangeFractionation._param_of_interest(entry.sequence)
                    ]),
                    "hitProteinIds": [
                        entry.seq_id for entry in fraction if IonExchangeFractionation._param_of_interest(entry.sequence)
                    ],
                    "proteins": [pack(entry) for entry in fraction],
                }
                for index, fraction in enumerate(fraction_lists)
            ],
        }
