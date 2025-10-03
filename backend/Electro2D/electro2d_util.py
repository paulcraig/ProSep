import numpy as np

from backend.protein_util import Protein


class Electro2d_util():
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
                targetX = Protein.get_ph_position(clampedPH, canvas_width, min_ph, max_ph)

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
                    targetPosY = Protein.get_mw_position(protein['mw'], canvas_height, acrylamide_percentage)
                else:
                    targetPosY = Protein.get_distance_position(protein['mw'], canvas_height, acrylamide_percentage)

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