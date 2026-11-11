from rdkit import Chem
from rdkit.Chem import Descriptors, AllChem, rdMolDescriptors
import logging
import math
import threading
import time
from pyPept.sequence import Sequence, correct_pdb_atoms
from pyPept.molecule import Molecule
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class PeptideRetentionPredictor:
    AA_RETENTION_TIMES = {
        "A": 2.10,
        "R": 2.47,
        "N": 1.92,
        "D": 1.97,
        "C": 2.12,
        "E": 2.13,
        "Q": 2.00,
        "G": 1.87,
        "H": 2.02,
        "I": 8.98,
        "L": 9.40,
        "K": 2.02,
        "M": 4.97,
        "F": 11.60,
        "P": 2.60,
        "S": 1.85,
        "T": 1.90,
        "W": 12.02,
        "Y": 8.63,
        "V": 4.17,
    }

    @staticmethod
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

    @staticmethod
    def peptide_to_smiles(peptide):
        try:
            biln = PeptideRetentionPredictor.normalize_to_biln(peptide)
            seq = Sequence(biln)
            seq = correct_pdb_atoms(seq)
            mol = Molecule(seq).get_molecule(fmt="ROMol")
            return Chem.MolToSmiles(mol, isomericSmiles=True)
        except Exception:
            return None

    @staticmethod
    def log_sum_aa(peptide):
        total = sum(
            PeptideRetentionPredictor.AA_RETENTION_TIMES.get(aa.upper(), 0)
            for aa in peptide
        )
        if total == 0:
            raise ValueError("log_sum_aa total is 0. Invalid peptide?")
        return math.log10(total)

    @staticmethod
    def vdw_2d_estimation(mol):
        # Testing using a 2D estimation of van der waals volume which should 
        # be much faster for larger peptides as compared to 3D embeddings
        # https://pubmed.ncbi.nlm.nih.gov/12968888/

        # Essentially we calculate total volume, and then subtract estimated overlapped volume
        # volume = sum(sphere vol of all atoms) - (5.92 * N(B)) - (14.7 * R(A)) - (3.8 * R(NA))
        # N(B) - number of bonds
        # R(A) - number of aromatic rings
        # R(NA) - number of nonaromatic rings

        # These should be the only relevant atoms when it comes to peptides
        sphere_volumes = {'H': 7.24, 'C': 20.58, 'N': 15.60, 'O': 14.71, 'S':24.43}
        summed_atoms_volumes = sum(sphere_volumes[atom.GetSymbol()] for atom in mol.GetAtoms())

        nb = mol.GetNumBonds()
        ra = rdMolDescriptors.CalcNumAromaticRings(mol)
        rna = rdMolDescriptors.CalcNumAliphaticRings(mol)

        return summed_atoms_volumes - (5.92 * nb) - (14.7 * ra) - (3.8 * rna)

    @staticmethod
    def compute_rdkit_features(smiles, volume_type='3D', numConfs=1):
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            raise ValueError("Invalid SMILES")
        mol = Chem.AddHs(mol)

        vdw_vol = 1
        if volume_type == '3D':
            params = AllChem.ETKDGv3()
            # we only use the first configuration found for our calculations anyway, no need to find 10
            cids = AllChem.EmbedMultipleConfs(mol, numConfs=numConfs, params=params)

            # TODO: do we prefer accuracy, or giving a result back to the user?
            # currently if the conf resolution fails this result will be pretty inaccurate
            # the alternative would be saying resolution failed for the specific peptide
            if not cids:
                AllChem.EmbedMolecule(mol)
                vdw_vol = 1 # Will remove the vdw_vol's impact from the calculation
            else:
                vdw_vol = AllChem.ComputeMolVolume(mol, confId=cids[0])

        elif volume_type == '2D':
            try:
                vdw_vol = PeptideRetentionPredictor.vdw_2d_estimation(mol)
            except: pass

        clog_p = Descriptors.MolLogP(mol)

        return math.log10(vdw_vol), clog_p

    @staticmethod
    def predict(peptide: str, volume_type: str = '3D', num_confs: int = 1, method: str = 'rdkit') -> dict:
        if method == 'deeplc':
            return DeepLCPredictor.predict_multiple([peptide])[0]
        try:
            start = time.perf_counter()
            smiles = PeptideRetentionPredictor.peptide_to_smiles(peptide)
            if not smiles:
                raise ValueError("Invalid peptide sequence")
            log_sum = PeptideRetentionPredictor.log_sum_aa(peptide)
            log_vdw, clog_p = PeptideRetentionPredictor.compute_rdkit_features(
                smiles, volume_type=volume_type, numConfs=num_confs
            )
            
            # Magic numbers here? Not sure where these coefficiants are coming from
            # Likely worth another look at for better accuracy
            tr_pred = 8.02 + 14.86 * log_sum - 5.77 * log_vdw + 0.28 * clog_p 

            return {
                "peptide": peptide,
                "smiles": smiles,
                "log_sum_aa": log_sum,
                "log_vdw_vol": log_vdw,
                "clog_p": clog_p,
                "predicted_tr": tr_pred,
                # Tracking for comparison
                "method": "rdkit",
                "volume_type": volume_type,
                "num_confs": num_confs,
                "compute_time": (time.perf_counter() - start) * 1000, 
            }
        
        except Exception as e:
            return {"peptide": peptide, "error": str(e)}

    @staticmethod
    def predict_multiple(peptides: list[str], volume_type: str = '3D', num_confs: int = 1, method: str = 'rdkit') -> list[dict]:
        if method == 'deeplc':
            return DeepLCPredictor.predict_multiple(peptides)
        results = []
        with ThreadPoolExecutor() as executor:
            results = list(
                executor.map(
                    lambda p: PeptideRetentionPredictor.predict(p, volume_type, num_confs),
                    peptides,
                )
            )
        return results


class DeepLCPredictor:
    RESIDUES = frozenset("ACDEFGHIKLMNPQRSTVWY")

    _model = None
    _device = None
    _lock = threading.Lock()

    @staticmethod
    def to_proforma(peptide: str) -> str:
        seq = peptide.strip()
        acetyl = seq.startswith("Ac-")
        amidated = seq.endswith("-NH2")
        if acetyl:
            seq = seq[3:]
        if amidated:
            seq = seq[:-4]
        
        n_residues = len(seq) 
        if n_residues == 0: raise ValueError("Empty peptide sequence")

        unsupported = set(seq) - DeepLCPredictor.RESIDUES
        if unsupported:
            raise ValueError(f"Unsupported residue(s) for DeepLC: {''.join(sorted(unsupported))}")

        proforma = ("Q[Gln->pyro-Glu]") + seq
        if amidated:
            proforma += "[Amidated]"
        if acetyl:
            proforma = "[Acetyl]-" + proforma
        return proforma

    @classmethod
    def get_model(cls):
        if cls._model is None:
            with cls._lock:
                if cls._model is None:
                    start = time.perf_counter()
                    import torch
                    import deeplc
                    from deeplc._model_ops import load_model
                    from deeplc.core import DEFAULT_MODEL

                    device = "cuda" if torch.cuda.is_available() else "cpu"
                    model = load_model(DEFAULT_MODEL, device=device)

                    deeplc.predict(
                        ["[Acetyl]-PEPTIDE", "Q[Gln->pyro-Glu]PEPTIDE[Amidated]"],
                        model=model,
                        predict_kwargs={"device": device, "show_progress": False},
                    )

                    cls._device = device
                    cls._model = model
                    logger.info(
                        "Loaded DeepLC model on %s in %.1f s",
                        device,
                        time.perf_counter() - start,
                    )
        return cls._model

    @classmethod
    def predict_multiple(cls, peptides: list[str]) -> list[dict]:
        results: list[dict | None] = [None] * len(peptides)
        batch: list[tuple[int, str]] = []
        for i, peptide in enumerate(peptides):
            try:
                batch.append((i, cls.to_proforma(peptide)))
            except ValueError as e:
                results[i] = {"peptide": peptide, "error": str(e)}

        if batch:
            try:
                import deeplc

                model = cls.get_model()
                start = time.perf_counter()
                predictions = deeplc.predict(
                    [proforma for _, proforma in batch],
                    model=model,
                    predict_kwargs={"device": cls._device, "show_progress": False},
                )

                per_peptide_ms = (time.perf_counter() - start) * 1000 / len(batch)
            except Exception as e:
                logger.exception("DeepLC prediction failed")
                for i, _ in batch:
                    results[i] = {
                        "peptide": peptides[i],
                        "error": f"DeepLC prediction failed: {e}",
                    }
            else:
                for (i, proforma), tr in zip(batch, predictions):
                    results[i] = {
                        "peptide": peptides[i],
                        "proforma": proforma,
                        "predicted_tr": float(tr),
                        "method": "deeplc",
                        "batch_size": len(batch),
                        "compute_time": per_peptide_ms,
                    }
        return results
