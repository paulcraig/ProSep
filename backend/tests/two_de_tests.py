
#To run: python3 -m unittest backend.Electro1DTests.ProteinTest
import unittest

from Bio.SeqUtils.ProtParam import ProteinAnalysis

from backend.logic.two_de_simulation import *


class TestProtein(unittest.TestCase):
    def setUp(self):
        self.protein = Protein()
    
    def test_parse_fasta(self):
        pass

   


    # def test_set_distance(self):
    #     expected_distance = 116.0610424
    #     with open("backend/Electro1DTests/Electro1DSampleTestFiles/electrophoresis1dStandards.fasta") as file:
    #         parsed_protein = parse_protein(file)
    #     self.protein.set_host_scale_factor(.001)
    #     actual_distance = self.protein.set_distance(parsed_protein, list(parsed_protein.keys())[0],
    #                                                 self.protein.scale_factor)
    #     self.assertAlmostEqual(expected_distance, actual_distance)


if __name__ == "__main__":
    unittest.main()
