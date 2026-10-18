from typing import Any, Dict, Literal

from fastapi import APIRouter
from pydantic import BaseModel, conint, root_validator, validator

from backend.logic.tandem_ms import TandemMS


router = APIRouter(prefix="/tandem_ms", tags=["Tandem MS"])

ProteaseName = Literal["Trypsin", "Chymostrypsin", "Thermolysin", "ProteinaseK"]
PROTEIN_SEQUENCE_LETTERS = frozenset("ACDEFGHIKLMNPQRSTVWY")


class TandemMSRequest(BaseModel):
    protein_string: str
    protease: ProteaseName
    lower_bound: conint(strict=True, ge=0, le=3000)
    upper_bound: conint(strict=True, ge=0, le=3000)

    @validator("protein_string", pre=True)
    def normalize_protein_string(cls, value: Any) -> str:
        if not isinstance(value, str):
            raise ValueError("protein_string must be text")
        sequence = "".join(value.split()).upper()
        if not sequence or any(residue not in PROTEIN_SEQUENCE_LETTERS for residue in sequence):
            raise ValueError("protein_string must contain only standard amino-acid letters")
        return sequence

    @root_validator
    def validate_bounds(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        lower_bound = values.get("lower_bound")
        upper_bound = values.get("upper_bound")
        if lower_bound is not None and upper_bound is not None and lower_bound > upper_bound:
            raise ValueError("lower_bound must not exceed upper_bound")
        return values


@router.post("/plot", response_model=Dict[str, Any])
async def plot_tandem_ms(body: TandemMSRequest) -> Dict[str, Any]:
    protease_names = {
        "Trypsin": "MassSpec.Trypsin",
        "Chymostrypsin": "MassSpec.Chymotrypsin",
        "Thermolysin": "MassSpec.Thermolysin",
        "ProteinaseK": "Proteinase K",
    }
    result = TandemMS().runAnalysis(
        sequence=body.protein_string,
        proteaseChoice=protease_names[body.protease],
        lowerLimit=body.lower_bound,
        upperLimit=body.upper_bound,
    )

    grouped_peaks: Dict[str, Dict[str, Any]] = {}
    for peak in result["peaks"]:
        mz_key = f"{round(float(peak['mz']), 5):.5f}"
        grouped_peak = grouped_peaks.setdefault(mz_key, {"sequence": [], "IonHits": 0})
        grouped_peak["sequence"].append(peak["sequence"])
        grouped_peak["IonHits"] += 1

    return {
        "peaks": grouped_peaks,
        "hits": result["mostHits"],
    }