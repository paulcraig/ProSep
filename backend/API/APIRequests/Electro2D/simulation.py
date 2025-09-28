import math, re
import numpy as np
from Bio import SeqIO
from io import StringIO
from typing import List, Dict, Any
from fastapi import APIRouter, UploadFile, File
import httpx


router = APIRouter(
    prefix="/api",
    tags=["2D Simulation"]
)


AMINO_ACIDS = {
    'A': {'mass': 71.07, 'pKa': 0},
    'R': {'mass': 156.18, 'pKa': 12.48},
    'N': {'mass': 114.08, 'pKa': 0},
    'D': {'mass': 115.08, 'pKa': 3.65},
    'C': {'mass': 103.14, 'pKa': 8.18},
    'E': {'mass': 129.11, 'pKa': 4.25},
    'Q': {'mass': 128.13, 'pKa': 0},
    'G': {'mass': 57.05, 'pKa': 0},
    'H': {'mass': 137.14, 'pKa': 6.00},
    'I': {'mass': 113.16, 'pKa': 0},
    'L': {'mass': 113.16, 'pKa': 0},
    'K': {'mass': 128.17, 'pKa': 10.53},
    'M': {'mass': 131.19, 'pKa': 0},
    'F': {'mass': 147.17, 'pKa': 0},
    'P': {'mass': 97.11, 'pKa': 0},
    'S': {'mass': 87.07, 'pKa': 0},
    'T': {'mass': 101.10, 'pKa': 0},
    'W': {'mass': 186.21, 'pKa': 0},
    'Y': {'mass': 163.17, 'pKa': 10.07},
    'V': {'mass': 99.13, 'pKa': 0}
}

# -------------------------------------------------------------------
# Core helpers
# -------------------------------------------------------------------
def calculate_molecular_weight(sequence: str) -> float:
    return sum(AMINO_ACIDS.get(aa, {'mass': 0})['mass'] for aa in sequence)


def calculate_theoretical_pi(sequence: str) -> float:
    counts = {}
    for aa in sequence:
        if aa in AMINO_ACIDS and AMINO_ACIDS[aa]['pKa'] > 0:
            counts[aa] = counts.get(aa, 0) + 1

    total_pka = sum(AMINO_ACIDS[aa]['pKa'] * count for aa, count in counts.items())
    total_count = sum(counts.values())
    return total_pka / total_count if total_count > 0 else 7.0

def find_links(list_of_ids: List[str], use_uniparc_fallback: bool = True):
    UNIPROT_URL = "https://www.uniprot.org/uniprotkb"
    PDB_URL = "https://data.rcsb.org/rest/v1/core/entry"
    NCBI_URL = "https://www.ncbi.nlm.nih.gov/protein"

    protein_links = {}

    with httpx.Client() as client:
        for pid in list_of_ids:
            protein_links[pid] = None  # default in case of no links

            # NCBI
            if pid.replace(".", "").isdigit() or pid.startswith(("NP_", "XP_", "CAA", "AFP")):
                r = client.get(
                    f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=protein&id={pid}&retmode=json"
                )
                if r.status_code == 200:
                    protein_links[pid] = f"{NCBI_URL}/{pid}"
                    continue

            # PDB
            if len(pid) == 4 and pid.isalnum():
                r = client.get(f"{PDB_URL}/{pid}")
                if r.status_code == 200:
                    protein_links[pid] = f"https://www.rcsb.org/structure/{pid}"
                    continue

            # UniProt
            if pid.isalnum() and not pid.replace(".", "").isdigit():
                r = client.get(f"{UNIPROT_URL}/{pid}")
                if r.status_code == 200:
                    protein_links[pid] = f"{UNIPROT_URL}/{pid}"
                elif use_uniparc_fallback:
                    protein_links[pid] = f"https://www.uniprot.org/uniparc/{pid}"

    return protein_links


def parse_fasta_content(content: str) -> List[Dict[str, Any]]:
    sequences = []
    fasta_io = StringIO(content)
    for record in SeqIO.parse(fasta_io, "fasta"):
        header = str(record.description)
        sequence = str(record.seq)
        mw = calculate_molecular_weight(sequence)
        pH = calculate_theoretical_pi(sequence)

        info = extract_protein_info(header)
        sequences.append({
            'header': header,
            'sequence': sequence,
            'name': info['name'],
            'organism': info['organism'],
            'mw': mw,
            'pH': pH
        })
    return sequences


def extract_protein_info(header: str) -> Dict[str, str]:
    match = re.match(r'^gi\|(\d+)\|.*\|\s*(.*?)\s*\[(.*?)\]$', header)
    if match:
        return {'id': match.group(1), 'name': match.group(2), 'organism': match.group(3)}
    return {'id': 'unknown', 'name': header, 'organism': 'Unknown organism'}


def get_ph_position(pH, canvas_width, min_ph, max_ph):
    clampedPH = min(max(pH, min_ph), max_ph)
    return 50 + ((clampedPH - min_ph) / (max_ph - min_ph)) * (canvas_width - 100)


def get_mw_position(mw, canvas_height, acrylamide_percentage):
    min_mw = 1000
    max_mw = 1000000
    log_mw = math.log10(min(max(mw, min_mw), max_mw))
    acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 15
    return 170 + ((math.log10(max_mw) - log_mw) / (math.log10(max_mw) - math.log10(min_mw))) * (canvas_height - 220) * acrylamide_factor


def get_distance_position(mw, canvas_height, acrylamide_percentage, max_distance_traveled=6):
    min_mw = 1000
    max_mw = 1000000
    normalized_mw = (math.log10(min(max(mw, min_mw), max_mw)) - math.log10(min_mw)) / (math.log10(max_mw) - math.log10(min_mw))
    acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 10
    distance = max_distance_traveled * (1 - normalized_mw) * acrylamide_factor
    return 170 + (distance / (max_distance_traveled * acrylamide_factor)) * (canvas_height - 220)

# -------------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------------
@router.post("/parse-fasta")
async def parse_fasta(files: List[UploadFile] = File(...)):
    import re

    color_palette = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080'
    ]
    new_proteins = []

    for i, file in enumerate(files):
        content = await file.read()
        sequences = parse_fasta_content(content.decode("utf-8"))

        # Collect all IDs from this file
        id_list = [seq['header'].split("|")[1] for seq in sequences]

        # Fetch links for all IDs in this file
        links_dict = find_links(id_list)

        for seq in sequences:
            pid = seq['header'].split("|")[1]
            display_name = seq['header'].split("|")[2]

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
    return simulate_ief(proteins, ph_range, canvas_width, canvas_height)


@router.post("/simulate-sds")
async def run_sds_simulation(data: Dict[str, Any]):
    proteins = data.get("proteins", [])
    y_axis_mode = data.get("yAxisMode", "mw")
    acrylamide_percentage = data.get("acrylamidePercentage", 7.5)
    canvas_height = data.get("canvasHeight", 600)
    return simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height)

# -------------------------------------------------------------------
# Simulation functions
# -------------------------------------------------------------------
def simulate_ief(proteins, ph_range, canvas_width, canvas_height, steps=25):
    min_ph = ph_range['min']
    max_ph = ph_range['max']
    simulation_results = []

    for step in range(steps + 1):
        progress = step / steps
        step_results = []
        for protein in proteins:
            protein_data = protein.copy()
            clampedPH = min(max(protein['pH'], min_ph), max_ph)
            targetX = get_ph_position(clampedPH, canvas_width, min_ph, max_ph)

            if step == 0:
                startX = np.random.uniform(50, canvas_width - 50)
                spreadY = np.random.uniform(50, 70)
                protein_data.update({
                    'x': startX,
                    'y': spreadY,
                    'currentpH': min_ph + ((startX - 50) / (canvas_width - 100)) * (max_ph - min_ph),
                    'bandWidth': 40,
                    'settled': False
                })
            else:
                prev_data = simulation_results[step - 1][proteins.index(protein)]
                dx = targetX - prev_data['x']
                newX = prev_data['x'] + dx * (0.1 + progress * 0.2)
                newBandWidth = max(3, prev_data['bandWidth'] * (1 - progress * 0.8))
                settled = abs(dx) < 1
                protein_data.update({
                    'x': newX,
                    'y': 80,
                    'bandWidth': newBandWidth,
                    'settled': settled
                })
            step_results.append(protein_data)
        simulation_results.append(step_results)

    return simulation_results


def simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height, steps=25):
    simulation_results = []
    condensed_proteins = []
    for protein in proteins:
        protein_data = protein.copy()
        protein_data.update({
            'y': 150,
            'condensing': True,
            'bandWidth': 3
        })
        condensed_proteins.append(protein_data)
    simulation_results.append(condensed_proteins)

    for step in range(1, steps + 1):
        step_results = []
        for i, protein in enumerate(proteins):
            protein_data = protein.copy()
            prev_data = simulation_results[step - 1][i]
            if y_axis_mode == 'mw':
                targetPosY = get_mw_position(protein['mw'], canvas_height, acrylamide_percentage)
            else:
                targetPosY = get_distance_position(protein['mw'], canvas_height, acrylamide_percentage)

            if targetPosY >= 600:
                targetPosY = 600

            protein_data.update({
                'x': prev_data['x'],
                'y': prev_data['y'] + (targetPosY - prev_data['y']) * 0.1,
                'condensing': False,
                'bandWidth': prev_data['bandWidth']
            })
            step_results.append(protein_data)
        simulation_results.append(step_results)

    return simulation_results