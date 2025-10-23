import math, re

import numpy as np
from io import StringIO
from typing import Any, Dict, List
from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio import SeqIO
from utility.protein import Protein


class Simulation_2de():
    COLOR_PALETTE = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080'
    ]

    @staticmethod
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
                targetX = Simulation_2de.get_ph_position(clampedPH, canvas_width, min_ph, max_ph)

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


    @staticmethod
    def simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height, steps=25):
        simulation_results = []
        condensed_proteins = []
        mws:List = []

        for protein in proteins:

            mws.append(protein['mw'])

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
                    targetPosY = Simulation_2de.get_mw_position(protein['mw'], canvas_height, acrylamide_percentage, min_mw=min(mws), max_mw=max(mws))
                else:
                    targetPosY = Simulation_2de.get_distance_position(protein['mw'], canvas_height, acrylamide_percentage, min_mw=min(mws), max_mw=max(mws))

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
    

    @staticmethod
    def parse_fasta(sequences,new_proteins):
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
            protein_info['color'] = Simulation_2de.COLOR_PALETTE[len(new_proteins) % len(Simulation_2de.COLOR_PALETTE)]
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

        
    @staticmethod
    def parse_fasta_content(content: str) -> List[Dict[str, Any]]:
        sequences = []
        file = StringIO(content)
        for record in SeqIO.parse(file, "fasta"):
            header = str(record.description)
            sequence = str(record.seq)
            mw = ProteinAnalysis(sequence).molecular_weight()
            
            pH = Protein.calculate_theoretical_pi(sequence)

            info = Protein.extract_protein_info(header)
            sequences.append({
                'header': header,
                'sequence': sequence,
                'name': info['name'],
                'organism': info['organism'],
                'mw': mw,
                'pH': pH
            })
        return sequences
    

    @staticmethod
    def get_ph_position(pH, canvas_width, min_ph, max_ph):
        clampedPH = min(max(pH, min_ph), max_ph)
        return 50 + ((clampedPH - min_ph) / (max_ph - min_ph)) * (canvas_width - 100)


    @staticmethod
    def get_mw_position(mw, canvas_height, acrylamide_percentage, min_mw = 1000, max_mw = 1000000):
        log_mw = math.log10(min(max(mw, min_mw), max_mw))
        acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 15
        return 170 + ((math.log10(max_mw) - log_mw) / (math.log10(max_mw) - math.log10(min_mw))) * (canvas_height - 220) * acrylamide_factor


    @staticmethod
    def get_distance_position(mw, canvas_height, acrylamide_percentage, max_distance_traveled=6, min_mw = 1000, max_mw = 1000000):
        normalized_mw = (math.log10(min(max(mw, min_mw), max_mw)) - math.log10(min_mw)) / (math.log10(max_mw) - math.log10(min_mw))
        acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 10
        distance = max_distance_traveled * (1 - normalized_mw) * acrylamide_factor
        return 170 + (distance / (max_distance_traveled * acrylamide_factor)) * (canvas_height - 220)
if (__name__ == '__main__'):
    print(Simulation_2de().parse_fasta_content("tests\data\singleProtein.fasta"))
    
