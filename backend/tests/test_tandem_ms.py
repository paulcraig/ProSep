import unittest

from backend.logic.tandem_ms import (
    Chymotrypsin,
    Ion,
    ProteinaseK,
    TandemMS,
    Thermolysin,
    Trypsin,
)


class TestIon(unittest.TestCase):
    def test_peptide_mass_subtracts_water_per_bond(self):
        """GASK = G + A + S + K free masses minus 3 waters. 361.39622 is what the original Java gives."""
        ion = TandemMS().convertStringToIon("GASK")
        self.assertAlmostEqual(ion.totalMass, 361.39622, places=4)

    def test_single_amino_acid_has_no_water_loss(self):
        ion = Ion()
        ion.addAminoAcid("G")
        self.assertAlmostEqual(ion.totalMass, 75.07, places=4)


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


class TestRunAnalysis(unittest.TestCase):
    """Graph 1: digestion spectrum"""

    def test_one_peak_per_unique_mz(self):
        result = TandemMS().runAnalysis("GASKLMRWYK", "trypsin")
        sequences = sorted(s for p in result["peaks"].values() for s in p["sequences"])
        self.assertEqual(sequences, ["GASK", "LMR", "WYK"])
        self.assertEqual(result["mostHits"], 1)

    def test_duplicate_peptides_add_hits(self):
        result = TandemMS().runAnalysis("GASKGASK", "trypsin")
        self.assertEqual(len(result["peaks"]), 1)
        self.assertEqual(result["mostHits"], 2)

    def test_mz_limits_filter_peaks(self):
        # GASK is ~361, so a 0-300 window should drop it
        result = TandemMS().runAnalysis("GASK", "trypsin", lowerLimit=0, upperLimit=300)
        self.assertEqual(result["peaks"], {})
        self.assertEqual(result["mostHits"], 0)

    def test_cleans_case_and_whitespace(self):
        messy = TandemMS().runAnalysis("  gask lmr ", "trypsin")
        clean = TandemMS().runAnalysis("GASKLMR", "trypsin")
        self.assertEqual(messy, clean)

    def test_protease_name_is_case_insensitive(self):
        upper = TandemMS().runAnalysis("GAFSWKY", "Chymotrypsin")
        lower = TandemMS().runAnalysis("GAFSWKY", "chymotrypsin")
        self.assertEqual(upper, lower)
        sequences = sorted(s for p in lower["peaks"].values() for s in p["sequences"])
        self.assertEqual(sequences, ["GAF", "KY", "SW"])

    def test_unknown_protease_raises_value_error(self):
        with self.assertRaises(ValueError):
            TandemMS().runAnalysis("GASK", "pepsin")

    def test_invalid_letter_raises_value_error(self):
        with self.assertRaises(ValueError):
            TandemMS().runAnalysis("GASBK", "trypsin")

    def test_digits_raise_value_error(self):
        with self.assertRaises(ValueError):
            TandemMS().runAnalysis("GAS4K", "trypsin")


class TestSequencePeaks(unittest.TestCase):
    """Graph 2: b/y fragments for one peptide"""

    def setUp(self):
        self.result = TandemMS().sequencePeaks("GASK")

    def test_fragment_mz_values(self):
        b = [round(f["mz"], 3) for f in self.result["fragments"] if f["type"] == "b"]
        y = [round(f["mz"], 3) for f in self.result["fragments"] if f["type"] == "y"]
        self.assertEqual(b, [58.063, 129.137, 216.212, 344.389])
        self.assertEqual(y, [147.2, 234.275, 305.349, 362.404])

    def test_b_gaps_read_sequence_forwards(self):
        letters = [g["letter"] for g in self.result["gaps"] if g["type"] == "b"]
        self.assertEqual(letters, ["A", "S", "Q or K"])  # G-A-S-K, minus the first residue

    def test_y_gaps_read_sequence_backwards(self):
        letters = [g["letter"] for g in self.result["gaps"] if g["type"] == "y"]
        self.assertEqual(letters, ["S", "A", "G"])  # K-S-A-G, minus the first residue

    def test_invalid_letter_raises_value_error(self):
        with self.assertRaises(ValueError):
            TandemMS().sequencePeaks("GAXK")

    def test_ambiguous_masses(self):
        self.assertEqual(TandemMS().sequencePeaks("GL")["gaps"][0]["letter"], "I or L")
        self.assertEqual(TandemMS().sequencePeaks("GI")["gaps"][0]["letter"], "I or L")


if __name__ == "__main__":
    unittest.main()