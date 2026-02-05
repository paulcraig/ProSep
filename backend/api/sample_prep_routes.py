from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from backend.utility.sample_prep import build_fractions_from_upload

router = APIRouter(prefix="/sample_prep", tags=["sample_prep"])

@router.post("/run")
async def run_sample_prep(
    file: UploadFile = File(...),
    method: str = Form(...), # ion_exchange | size_exclusion | affinity
    
    #7 for now
    fraction_count: int = Form(7),
    
    # Ion exchange params
    ph: float = Form(7.0),
    ion_mode: str = Form("cation"), # cation | anion
    
    # Size exclusion params (kDa)
    min_kda: float = Form(20.0),
    max_kda: float = Form(200.0),
):
    try:
        fractions = build_fractions_from_upload(
            file,
            method=method,
            fraction_count=fraction_count,
            ph=ph,
            ion_mode=ion_mode,
            min_kda=min_kda,
            max_kda=max_kda,
        )
        return {"fractions": fractions}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample prep failed: {e}")