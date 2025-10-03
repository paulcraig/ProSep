import  re
import numpy as np
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File
from protein_util import Protein
from Electro2D.electro2d_util import Electro2d_util
router = APIRouter(
    prefix="/2d",
    tags=["2D Simulation"]
)
# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------
@router.post("/parse-fasta")
async def parse_fasta(files: List[UploadFile] = File(...)):
    

    color_palette = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080'
    ]
    new_proteins = []

    for i, file in enumerate(files):
        content = await file.read()
        sequences = Protein.parse_fasta_content(content.decode("utf-8"))

        # Collect all IDs from this file
        id_list = [seq['header'].split("|")[1] for seq in sequences]

        # Fetch links for all IDs in this file
        links_dict = Protein.find_links(id_list)

        for seq in sequences:
            pid = seq['header'].split("|")[1]
            display_name = seq['header'].split("|")[-1]

            # Extract UniProt ID if present
            uniprot_match = re.search(
                r'[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}',
                seq['header']
            )
            uniprotId = uniprot_match.group(0) if uniprot_match else "N/A"

            protein_info = {}
            protein_info['name'] = seq['name']
            protein_info['fullName'] = seq['name']
            protein_info['organism'] = seq['organism']
            protein_info['uniprotId'] = uniprotId
            protein_info['mw'] = seq['mw']
            protein_info['pH'] = seq['pH']
            protein_info['color'] = color_palette[len(new_proteins) % len(color_palette)]
            protein_info['sequence'] = seq['sequence']
            protein_info['x'] = 50
            protein_info['y'] = 300
            protein_info['currentpH'] = 7
            protein_info['velocity'] = 0
            protein_info['settled'] = False
            protein_info['ID'] = pid
            protein_info['Link'] = links_dict.get(pid) or "N/A"
            protein_info['display_name'] = display_name

            new_proteins.append(protein_info.copy())

    return new_proteins

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

