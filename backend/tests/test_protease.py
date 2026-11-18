import unittest

from backend.logic.tandem_ms import (
    Chymotrypsin,
    ProteinaseK,
    Thermolysin,
    Trypsin,
)

class TestProteases(unittest.TestCase):
    def test_trypsin_cuts_after_k_and_r(self):
        self.assertEqual(Trypsin().cut("GASKLMRWYK"), ["GASK", "LMR", "WYK"])

    def test_trypsin_does_not_cut_before_proline(self):
        # K is followed by P, so no cut there; R is not, so it cuts after R
        self.assertEqual(Trypsin().cut("GASKPLMRWYFVK"), ["GASKPLMR", "WYFVK"])

    def test_keeps_last_peptide_after_final_cut(self):
        # The Java dropped "PGFLIEW" here; the port should keep it
        self.assertEqual(Trypsin().cut("AKRPGFLIEW"), ["AK", "RPGFLIEW"])

    def test_chymotrypsin_cuts_after_f_w_y(self):
        self.assertEqual(Chymotrypsin().cut("GAFSWKY"), ["GAF", "SW", "KY"])

    def test_thermolysin_cuts_before_i_l_m_v(self):
        self.assertEqual(Thermolysin().cut("GALSMK"), ["GA", "LS", "MK"])

    def test_proteinase_k_cuts_after_its_residues(self):
        self.assertEqual(ProteinaseK().cut("GASKW"), ["GA", "SKW"])

    def test_no_cut_sites_returns_whole_sequence(self):
        self.assertEqual(Trypsin().cut("GASGAS"), ["GASGAS"])

if __name__ == "__main__":
    unittest.main()
