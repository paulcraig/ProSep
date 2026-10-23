import os
import unittest

CURRENT_DIR = os.path.dirname(__file__)

from backend.logic.hydrophobic_interaction_fractionation import (
    HydrophobicInteractionFractionation as HIF,
)
from backend.logic.ion_exchange_fractionation import IonExchangeFractionation as IEF
from backend.logic.size_exclusion import SizeExclusionFractionation as SEF


class TestFractionation(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(CURRENT_DIR, "data/ls_orchid.fasta")) as fasta_file:
            self.fasta = fasta_file.read()

    def test_ion_exchange(self):
        result = IEF.process(
            fasta_content=self.fasta,
            salt_start=0,
            salt_end=1.5,
            salt_alpha=1.2,
            fraction_count=80,
            noise=0.1,
            deadband=0.05,
            ph=7,
            media_type="Q",
        )
        with open(os.path.join(CURRENT_DIR, "baselines/ion_exchange.txt")) as file:
            assert file.read() == result.__str__()

    def test_size_exclusion(self):
        result = SEF.process(
            fasta_content=self.fasta,
            gel_name="Bio-P 2.5-40.0 kDa",
            min_size=2500,
            max_size=40000,
            fraction_count=5,
            proteinList=[],
        )
        with open(os.path.join(CURRENT_DIR, "baselines/size_exclusion.txt")) as file:
            assert file.read() == result.__str__()

    def test_hydrophobic_interaction(self):
        result = HIF.process(
            fasta_content=self.fasta,
            ligand_type="butyl",
            salt_start=1.5,
            salt_end=0,
            fraction_count=80,
            noise=0.1,
            deadband=0.15,
            salt_alpha=1.2
        )
        with open(os.path.join(CURRENT_DIR, "baselines/hydrophobic_interaction.txt")) as file:
            assert file.read() == result.__str__()
            