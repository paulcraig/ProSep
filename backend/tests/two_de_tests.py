# @author Amr Mualla, Mack Leonard
# Testing for Protein Class
# To run: python3 -m unittest backend.Electro1DTests.ProteinTest
# import unittest

# from Bio.SeqUtils.ProtParam import ProteinAnalysis

# from backend.logic.protein_util import *


# class TestProtein(unittest.TestCase):

#     def setUp(self):
#         self.protein = Protein()

#     def test_default_values(self):
#         self.assertEqual(self.protein.name, "notSet")
#         self.assertEqual(self.protein.full_name, "notSet")
#         self.assertEqual(self.protein.abbr, "notSet")
#         self.assertEqual(self.protein.mw, 0)
#         self.assertEqual(self.protein.color, (0, 0, 255))

#     def test_set_start_position(self):
#         self.protein.set_start_position(10, 20)
#         self.assertEqual(self.protein.x1, 10)
#         self.assertEqual(self.protein.y1, 20)
#         self.assertEqual(self.protein.start_y, 20)
#         self.assertEqual(self.protein.y1_float, 20.0)

#     def test_reset_decider(self):
#         self.protein.decider = 5
#         self.protein.counter = 3
#         self.protein.reset_decider()
#         self.assertEqual(self.protein.decider, 1)
#         self.assertEqual(self.protein.counter, 1)

#     def test_incr_position(self):
#         self.protein.y1_float = 10.0
#         self.protein.speed = 1.0
#         self.protein.incr_position()
#         self.assertEqual(self.protein.y1_float, 11.0)
#         self.assertEqual(self.protein.y1, 11)

#     def test_match_position(self):
#         self.protein.x1 = 10
#         self.protein.y1 = 10
#         self.protein.width = 5
#         self.protein.height = 5
#         self.assertTrue(self.protein.match_position(11, 11))
#         self.assertFalse(self.protein.match_position(20, 20))

#     def test_set_width(self):
#         self.protein.set_width(10)
#         self.assertEqual(self.protein.width, 10)

#     def test_get_decider(self):
#         self.protein.decider = 1
#         self.assertEqual(self.protein.get_decider(), 1)

#     def test_set_decider(self):
#         self.protein.decider = 0
#         self.protein.set_decider(1)
#         self.assertEqual(self.protein.get_decider(), 1)

#     def test_set_concentration(self):
#         self.protein.set_concentration(5)
#         self.assertEqual(self.protein.concentration, 5)

#     def test_match_plot_position(self):
#         self.protein.plot_x_pos = 10
#         self.protein.plot_y_pos = 10
#         self.assertTrue(self.protein.match_plot_position(11, 11))
#         self.assertFalse(self.protein.match_plot_position(20, 20))

   
      

   

   

#     def test_set_distance(self):
#         expected_distance = 116.0610424
#         with open("backend/Electro1DTests/Electro1DSampleTestFiles/electrophoresis1dStandards.fasta") as file:
#             parsed_protein = parse_protein(file)
#         self.protein.set_host_scale_factor(.001)
#         actual_distance = self.protein.set_distance(parsed_protein, list(parsed_protein.keys())[0],
#                                                     self.protein.scale_factor)
#         self.assertAlmostEqual(expected_distance, actual_distance)

# if __name__ == "__main__":
#     unittest.main()
