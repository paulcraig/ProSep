from rdkit import Chem
from rdkit.Chem import Descriptors, AllChem
import math
from pyPept.sequence import Sequence, correct_pdb_atoms
from pyPept.molecule import Molecule
from concurrent.futures import ThreadPoolExecutor

class PeptideRetentionPredictor:
    AA_RETENTION_TIMES = {
        'A': 2.10, 'R': 2.47, 'N': 1.92, 'D': 1.97, 'C': 2.12, 'E': 2.13, 'Q': 2.00, 'G': 1.87, 'H': 2.02,
        'I': 8.98, 'L': 9.40, 'K': 2.02, 'M': 4.97, 'F': 11.60, 'P': 2.60, 'S': 1.85, 'T': 1.90, 'W': 12.02,
        'Y': 8.63, 'V': 4.17
    }

    def normalize_to_biln(peptide: str) -> str:
        seq = peptide.strip()
        has_ac = seq.startswith("Ac-")
        has_nh2 = seq.endswith("-NH2")
        seq_clean = seq.replace("Ac-", "").replace("-NH2", "").strip()
        aa_chain = "-".join(list(seq_clean.upper()))
        if has_ac and has_nh2:
            return f"ac-{aa_chain}-am"
        elif has_ac:
            return f"ac-{aa_chain}"
        elif has_nh2:
            return f"{aa_chain}-am"
        else:
            return aa_chain

    def peptide_to_smiles(peptide):
        try:
            biln = PeptideRetentionPredictor.normalize_to_biln(peptide)
            seq = Sequence(biln)
            seq = correct_pdb_atoms(seq)
            mol = Molecule(seq).get_molecule(fmt='ROMol')
            return Chem.MolToSmiles(mol, isomericSmiles=True)
        except Exception:
            return None

    def log_sum_aa(peptide):
        total = sum(PeptideRetentionPredictor.AA_RETENTION_TIMES.get(aa.upper(), 0) for aa in peptide)
        if total == 0:
            raise ValueError("log_sum_aa total is 0. Invalid peptide?")
        return math.log10(total)

    def compute_rdkit_features(smiles):
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError("Invalid SMILES")
        mol = Chem.AddHs(mol)
        cids = AllChem.EmbedMultipleConfs(mol, numConfs=10)
        vdw_vol = AllChem.ComputeMolVolume(mol, confId=cids[0])
        clog_p = Descriptors.MolLogP(mol)
        return math.log10(vdw_vol), clog_p

    @staticmethod
    def predict(peptides: list[str]) -> list[dict]:
        results = []
        def _process(peptide):
            try:
                smiles = PeptideRetentionPredictor.peptide_to_smiles(peptide)
                if not smiles:
                    raise ValueError("Invalid peptide sequence")
                log_sum = PeptideRetentionPredictor.log_sum_aa(peptide)
                log_vdw, clog_p = PeptideRetentionPredictor.compute_rdkit_features(smiles)
                tr_pred = 8.02 + 14.86 * log_sum - 5.77 * log_vdw + 0.28 * clog_p
                return {
                    'peptide': peptide,
                    'smiles': smiles,
                    'log_sum_aa': log_sum,
                    'log_vdw_vol': log_vdw,
                    'clog_p': clog_p,
                    'predicted_tr': tr_pred
                }
            except Exception as e:
                return {
                    'peptide': peptide,
                    'error': str(e)
                }
        with ThreadPoolExecutor() as executor:
            results = list(executor.map(_process, peptides))
        return results
