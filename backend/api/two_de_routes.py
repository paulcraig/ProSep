import  re
import numpy as np
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File
from protein_util import Protein
from simulation_2de import Electro2d_util
router = APIRouter(
    prefix="/2d",
    tags=["2D Simulation"]
)
# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------
@router.post("/parse-fasta")
async def parse_fasta(files: List[UploadFile] = File(...)):
    

    return Electro2d_util.parse_fasta(files)

@router.post("/simulate-ief")
async def run_ief_simulation(data: Dict[str, Any]):
    proteins = data.get("proteins", [])
    ph_range = data.get("phRange", {"min": 0, "max": 14})
    canvas_width = data.get("canvasWidth", 800)
    canvas_height = data.get("canvasHeight", 600)
    return Electro2d_util.simulate_ief(proteins, ph_range, canvas_width, canvas_height)


@router.post("/simulate-sds")
async def run_sds_simulation(data: Dict[str, Any]):
    proteins = data.get("proteins", [])
    y_axis_mode = data.get("yAxisMode", "mw")
    acrylamide_percentage = data.get("acrylamidePercentage", 7.5)
    canvas_height = data.get("canvasHeight", 600)
    return Electro2d_util.simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height)

