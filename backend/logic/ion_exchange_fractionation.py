from __future__ import annotations

import math
from io import StringIO
from typing import Any, Dict, List

from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis


class IonExchangeFractionation:
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
        items: List[Dict[str, Any]],
        n_fractions: int,
        overlap: float,
    ) -> List[List[Dict[str, Any]]]:
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

        fractions: List[List[Dict[str, Any]]] = []
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

        bound: List[Dict[str, Any]] = []
        wash_count = 0
        skipped = 0

        for record in records:
            sequence = IonExchangeFractionation._normalize_sequence(str(record.seq))
            if not sequence:
                skipped += 1
                continue

            try:
                analyzer = ProteinAnalysis(sequence)
                charge = float(analyzer.charge_at_pH(ph))
            except Exception:
                skipped += 1
                continue

            protein: Dict[str, Any] = {
                "id": record.id,
                "description": record.description,
                "sequence": sequence,
                "charge": round(charge, 2),
            }

            if abs(charge) < deadband:
                wash_count += 1
                continue

            if exchanger == "anion":
                if charge <= -deadband:
                    bound.append(protein)
                else:
                    wash_count += 1
            else:
                if charge >= deadband:
                    bound.append(protein)
                else:
                    wash_count += 1

        bound.sort(key=lambda item: abs(float(item["charge"])))

        for idx, protein in enumerate(bound):
            protein["index"] = idx

        fraction_lists = IonExchangeFractionation._fractionate_with_overlap(
            items=bound,
            n_fractions=fraction_count,
            overlap=noise,
        )

        seqhits: Dict[int, List[Any]] = {}
        fraction_overview: List[Dict[str, Any]] = []

        for n, temp in enumerate(fraction_lists):
            fraction_number = n + 1

            for protein in temp:
                if IonExchangeFractionation._param_of_interest(protein["sequence"]):
                    if fraction_number in seqhits:
                        seqhits[fraction_number][0] += 1
                        seqhits[fraction_number][1].append(protein["index"])
                    else:
                        seqhits[fraction_number] = [1, [protein["index"]]]

            fuzzymin = min((protein["index"] for protein in temp), default=0)
            fuzzymax = max((protein["index"] for protein in temp), default=-1) + 1

            fraction_overview.append(
                {
                    "fraction": fraction_number,
                    "fuzzymin": fuzzymin,
                    "fuzzymax": fuzzymax,
                    "protein_count": len(temp),
                    "hit_count": seqhits[fraction_number][0] if fraction_number in seqhits else 0,
                    "hit_indices": seqhits[fraction_number][1] if fraction_number in seqhits else [],
                }
            )

        display_rows = [
            {
                "index": protein["index"],
                "sequence": protein["sequence"],
                "description": protein["description"],
                f"charge_at_ph_{ph}": protein["charge"],
                "ID": protein["id"],
            }
            for protein in bound
        ]

        seqhits_list = [
            {
                "fraction": fraction,
                "hit_count": vals[0],
                "hit_indices": vals[1],
            }
            for fraction, vals in sorted(seqhits.items(), key=lambda kv: kv[0])
        ]

        return {
            "summary": {
                "processed": len(bound) + wash_count,
                "skipped": skipped,
                "bound_count": len(bound),
                "wash_count": wash_count,
                "fraction_count": fraction_count,
                "media_type": media_type,
                "exchanger": exchanger,
                "deadband": deadband,
            },
            "fraction_overview": fraction_overview,
            "filtered_proteins": display_rows,
            "seqhits": seqhits_list,
        }
