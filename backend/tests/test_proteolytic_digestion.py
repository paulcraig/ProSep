import unittest

from backend.logic.proteolytic_digestion_logic import ProteolyticDigestion


class TestProteolyticDigestion(unittest.TestCase):
    def test_trypsin_cuts_after_lysine_and_arginine(self):
        fragments = ProteolyticDigestion.breakUpProtein("AAKBBRCC", "KR")

        self.assertEqual(fragments, ["AAK", "BBR", "CC"])

    def test_trypsin_does_not_cut_before_proline(self):
        fragments = ProteolyticDigestion.breakUpProtein("AAKPBRKCC", "KR")

        self.assertEqual(fragments, ["AAKPBR", "K", "CC"])

    def test_pepsin_cuts_after_each_configured_residue(self):
        fragments = ProteolyticDigestion.breakUpProtein("AAFLWWYGG", "FLWY")

        self.assertEqual(fragments, ["AAF", "L", "W", "W", "Y", "GG"])

    def test_single_residue_cleavage_remains_supported(self):
        fragments = ProteolyticDigestion.breakUpProtein("AAARBB", "R")

        self.assertEqual(fragments, ["AAAR", "BB"])


if __name__ == "__main__":
    unittest.main()
