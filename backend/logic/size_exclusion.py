from Bio import SeqIO
from Bio.SeqUtils.ProtParam import ProteinAnalysis as PA
from fastapi import UploadFile

class SizeExclusionFractionation:
    GEL_DICT = {
        "Bio-P 0.1-1.8 kDa": [100, 1800],
        "Bio-P 0.8-4.0 kDa": [800, 4000],
        "Bio-P 1.0-6.0 kDa": [1000, 6000],
        "Bio-P 1.5-20.0 kDa": [1500, 20000],
    }

    def __init__(self, gel_select: str, file: UploadFile):
        self.gel_select = gel_select
        self.size_min, self.size_max = self.GEL_DICT[gel_select]
        self.proteins = self._read_file(file)

  

    def write(self):
        toBig = []
        toSmall = []
        inside = []

        for record in self.proteins:
            seq = str(record.seq).replace("X", "Q")
            mw = PA(seq).molecular_weight()
            if mw < self.size_min:
                toSmall.append(record.id)  # return ID or sequence
            elif mw > self.size_max:
                toBig.append(record.id)
            else:
                inside.append(record.id)

        return {"toBig": toBig, "toSmall": toSmall, "inside": inside}
    

    @staticmethod
    def getGelDict():
        return SizeExclusionFractionation.GEL_DICT
            
    
  

def main():
    file = "C:/Users/fayja/OneDrive/Desktop/coding/college/senior project/ProSep/backend/tests/data/electrophoresis1dStandards.fasta"
    SizeExclusionFractionation(file,"test",{"Bio-P 0.1-1.8 kDa" : [100,1800]}).write()
    #SizeExclusionFractionation(file,"test",{"Bio-P 0.1-1.8 kDa" : [100,1800]}).toDataFrame()

    def process(
        fasta_content: str,
      
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

if (__name__ == "__main__"):
    main()
    