from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File
from logic.two_de_simulation import Simulation_2de


router = APIRouter(
    prefix="/2d",
    tags=["2D Simulation"]
)


@router.post("/parse-fasta")
async def parse_fasta(files: List[UploadFile] = File(...)):
    new_proteins = []

    for _, file in enumerate(files):
        content = await file.read()
        sequences = Simulation_2de.parse_fasta_content(content.decode("utf-8"))
        Simulation_2de.parse_fasta(sequences,new_proteins)
        
    return new_proteins


@router.post("/simulate-ief")
async def run_ief_simulation(data: Dict[str, Any]):
    proteins = data.get("proteins", [])
    ph_range = data.get("phRange", {"min": 0, "max": 14})
    canvas_width = data.get("canvasWidth", 800)
    canvas_height = data.get("canvasHeight", 600)
    return Simulation_2de.simulate_ief(proteins, ph_range, canvas_width, canvas_height)


@router.post("/simulate-sds")
async def run_sds_simulation(data: Dict[str, Any]):
    proteins = data.get("proteins", [])
    y_axis_mode = data.get("yAxisMode", "mw")
    acrylamide_percentage = data.get("acrylamidePercentage", 7.5)
    canvas_height = data.get("canvasHeight", 600)
    return Simulation_2de.simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height)
