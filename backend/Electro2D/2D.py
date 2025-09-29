import math
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
from Bio import SeqIO
from io import StringIO

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Amino acid properties for calculations
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

# Calculate molecular weight based on amino acid sequence
def calculate_molecular_weight(sequence):
    """Calculate molecular weight based on amino acid sequence"""
    return sum(AMINO_ACIDS.get(aa, {'mass': 0})['mass'] for aa in sequence)

# Calculate theoretical isoelectric point based on amino acid sequence
def calculate_theoretical_pi(sequence):
    """Calculate theoretical isoelectric point based on amino acid sequence"""
    # Count amino acids with pKa values
    counts = {}
    for aa in sequence:
        if aa in AMINO_ACIDS and AMINO_ACIDS[aa]['pKa'] > 0:
            counts[aa] = counts.get(aa, 0) + 1
    
    # Calculate weighted average pKa
    total_pka = sum(AMINO_ACIDS[aa]['pKa'] * count for aa, count in counts.items())
    total_count = sum(counts.values())
    
    return total_pka / total_count if total_count > 0 else 7.0

# Parse FASTA content and extract sequences
def parse_fasta_content(content):
    """Parse FASTA content and extract sequences"""
    sequences = []
    fasta_io = StringIO(content)
    
    for record in SeqIO.parse(fasta_io, "fasta"):
        header = str(record.description)
        sequence = str(record.seq)
        
        # Extract protein info
        info = extract_protein_info(header)
        
        # Calculate properties
        mw = calculate_molecular_weight(sequence)
        pH = calculate_theoretical_pi(sequence)
        
        sequences.append({
            'header': header,
            'sequence': sequence,
            'name': info['name'],
            'organism': info['organism'],
            'mw': mw,
            'pH': pH
        })
    
    return sequences

# Extract protein information from FASTA header
def extract_protein_info(header):
    """Extract protein information from FASTA header"""
    import re
    match = re.match(r'^gi\|(\d+)\|.*\|\s*(.*?)\s*\[(.*?)\]$', header)
    
    if match:
        return {
            'id': match.group(1),
            'name': match.group(2),
            'organism': match.group(3)
        }
    else:
        return {
            'id': 'unknown',
            'name': header,
            'organism': 'Unknown organism'
        }

# Calculate X position based on pH
def get_ph_position(pH, canvas_width, min_ph, max_ph):
    """Calculate X position based on pH"""
    clampedPH = min(max(pH, min_ph), max_ph)
    return 50 + ((clampedPH - min_ph) / (max_ph - min_ph)) * (canvas_width - 100)

# Calculate Y position based on molecular weight and acrylamide percentage
def get_mw_position(mw, canvas_height, acrylamide_percentage):
    """Calculate Y position based on molecular weight and acrylamide percentage"""
    min_mw = 1000
    max_mw = 1000000
    log_mw = math.log10(min(max(mw, min_mw), max_mw))
    
    # Acrylamide affects migration - higher percentage = better separation of smaller proteins
    acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 15  # Normalized factor
    
    return 170 + ((math.log10(max_mw) - log_mw) / (math.log10(max_mw) - math.log10(min_mw))) * (canvas_height - 220) * acrylamide_factor

# Calculate Y position based on distance traveled
def get_distance_position(mw, canvas_height, acrylamide_percentage, max_distance_traveled=6):
    """Calculate Y position based on distance traveled"""
    min_mw = 1000
    max_mw = 1000000
    normalized_mw = (math.log10(min(max(mw, min_mw), max_mw)) - math.log10(min_mw)) / (math.log10(max_mw) - math.log10(min_mw))
    
    # Acrylamide affects migration - higher percentage = better separation
    acrylamide_factor = 1 + (acrylamide_percentage - 7.5) / 10  # Normalized factor
    
    # Smaller proteins travel farther
    distance = max_distance_traveled * (1 - normalized_mw) * acrylamide_factor
    
    # Map to canvas coordinates
    return 170 + (distance / (max_distance_traveled * acrylamide_factor)) * (canvas_height - 220)

# Simulate isoelectric focusing
def simulate_ief(proteins, ph_range, canvas_width, canvas_height, steps=25):
    """Simulate isoelectric focusing"""
    min_ph = ph_range['min']
    max_ph = ph_range['max']
    simulation_results = []
    
    # For each protein, calculate positions over time
    for step in range(steps + 1):
        progress = step / steps
        step_results = []
        
        for protein in proteins:
            # Clone protein data for this step
            protein_data = protein.copy()
            
            # Calculate target X position based on protein's pI
            clampedPH = min(max(protein['pH'], min_ph), max_ph)
            targetX = get_ph_position(clampedPH, canvas_width, min_ph, max_ph)
            
            # For initial distribution, spread proteins randomly
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
                # Get protein from previous step
                prev_data = simulation_results[step - 1][proteins.index(protein)]
                
                # Move X position towards target with easing
                dx = targetX - prev_data['x']
                newX = prev_data['x'] + dx * (0.1 + progress * 0.2)  # Accelerate with progress
                
                # Decrease band width as progress increases
                newBandWidth = max(3, prev_data['bandWidth'] * (1 - progress * 0.8))
                
                # Calculate Y position for band formation
                baseY = 80  # Base Y position for bands
                settled = abs(dx) < 1
                
                protein_data.update({
                    'x': newX,
                    'y': baseY,
                    'bandWidth': newBandWidth,
                    'settled': settled
                })
            
            step_results.append(protein_data)
        
        simulation_results.append(step_results)
    
    return simulation_results

# Simulate SDS-PAGE
def simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height, steps=25):
    """Simulate SDS-PAGE"""
    simulation_results = []
    
    # First condense proteins at the bottom of IEF band
    condensed_proteins = []
    for protein in proteins:
        protein_data = protein.copy()
        protein_data.update({
            'y': 150,  # Move to bottom of IEF band
            'condensing': True,
            'bandWidth': 3  # Reduce band width
        })
        condensed_proteins.append(protein_data)
    
    simulation_results.append(condensed_proteins)
    
    # Then start SDS-PAGE migration
    for step in range(1, steps + 1):
        step_results = []
        
        for i, protein in enumerate(proteins):
            protein_data = protein.copy()
            prev_data = simulation_results[step - 1][i]
            
            # Calculate target Y position based on molecular weight or distance traveled
            if y_axis_mode == 'mw':
                targetPosY = get_mw_position(protein['mw'], canvas_height, acrylamide_percentage)
            else:
                targetPosY = get_distance_position(protein['mw'], canvas_height, acrylamide_percentage)
            
            if targetPosY >= 600:
                targetPosY == 600
            # Move gradually toward target position
            protein_data.update({
                'x': prev_data['x'],
                'y': prev_data['y'] + (targetPosY - prev_data['y']) * 0.1,
                'condensing': False,
                'bandWidth': prev_data['bandWidth']
            })
            
            step_results.append(protein_data)
        
        simulation_results.append(step_results)
    
    return simulation_results

@app.route('/api/parse-fasta', methods=['POST'])
def parse_fasta():

    """Parse uploaded FASTA files"""
    if 'files' not in request.files:
        return jsonify({'error': 'No files provided'}), 400
    
    files = request.files.getlist('files')
    color_palette = [
        '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
        '#FFA500', '#800080', '#008000', '#FFC0CB', '#A52A2A', '#808080'
    ]
    
    new_proteins = []
    
    for i, file in enumerate(files):
        if not file.filename.endswith(('.fasta', '.fa')):
            continue
        
        content = file.read().decode('utf-8')
        sequences = parse_fasta_content(content)
        
        for idx, seq in enumerate(sequences):
            # Extract UniProt ID if possible
            uniprotId = 'N/A'
            import re
            uniprot_match = re.search(r'[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2}', seq['header'])
            if uniprot_match:
                uniprotId = uniprot_match.group(0)
            
            new_proteins.append({
                'name': seq['name'],
                'fullName': seq['name'],
                'organism': seq['organism'],
                'uniprotId': uniprotId,
                'pdbId': 'N/A',
                'function': 'Imported from FASTA file',
                'mw': seq['mw'],
                'pH': seq['pH'],
                'color': color_palette[(len(new_proteins) + i) % len(color_palette)],
                'sequence': seq['sequence'],
                'x': 50,
                'y': 300,
                'currentpH': 7,
                'velocity': 0,
                'settled': False
            })
    
    return jsonify(new_proteins)

# API endpoint to run the isoelectric focusing part of the simulation
@app.route('/api/simulate-ief', methods=['POST'])
def run_ief_simulation():
    """Run isoelectric focusing simulation"""
    data = request.json
    proteins = data.get('proteins', [])
    ph_range = data.get('phRange', {'min': 0, 'max': 14})
    canvas_width = data.get('canvasWidth', 800)
    canvas_height = data.get('canvasHeight', 600)
    
    results = simulate_ief(proteins, ph_range, canvas_width, canvas_height)
    return jsonify(results)

# API endpoint to run the SDS-PAGE simulation
@app.route('/api/simulate-sds', methods=['POST'])
def run_sds_simulation():
    """Run SDS-PAGE simulation"""
    data = request.json
    proteins = data.get('proteins', [])
    y_axis_mode = data.get('yAxisMode', 'mw')
    acrylamide_percentage = data.get('acrylamidePercentage', 7.5)
    canvas_height = data.get('canvasHeight', 600)
    
    results = simulate_sds(proteins, y_axis_mode, acrylamide_percentage, canvas_height)
    return jsonify(results)

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='2D Electrophoresis Simulation Backend')
    parser.add_argument('--host', default='129.21.34.127', help='Server host')
    parser.add_argument('--port', type=int, default=5000, help='Server port')
    args = parser.parse_args()
    
    app.run(host=args.host, port=args.port, debug=True)
