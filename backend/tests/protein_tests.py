import unittest

from Bio.SeqUtils.ProtParam import ProteinAnalysis
from Bio import SeqIO
from Bio import Seq
from backend.utility.protein import Protein

class TestProtein(unittest.TestCase):
    def setUp(self):
        self.protein = Protein()
    def test_calculate_molecular_weight(self):
        #needs to be reworked for when I (Jacob) get the formulas from paul
        sequence:dict = Protein.parse_protein("backend/tests/data/singleProtein.fasta")
        sequence = sequence[[x for x in sequence.keys()][0]][1]
        expected = ProteinAnalysis(sequence).molecular_weight()
        achual = Protein.calculate_molecular_weight(sequence)
        self.assertAlmostEqual(expected/10000,achual/10000,2) #if its within 100 units of each other it will pass
    def test_parse_single_protein(self):
        expcted = {'gi|2765658|emb|Z78533.1|CIZ78533': 
                   ('gi|2765658|emb|Z78533.1|CIZ78533 C.irapeanum 5.8S rRNA gene and ITS1 and ITS2 DNA', 
                    Seq.Seq('''CGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTGATGAGACCGTGGAATAAACGATCGAGTG
                                AATCCGGAGGACCGGTGTACTCAGCTCACCGGGGGCATTGCTCCCGTGGTGACCCTGATTTGTTGTTGGG
                                CCGCCTCGGGAGCGTCCATGGCGGGTTTGAACCTCTAGCCCGGCGCAGTTTGGGCGCCAAGCCATATGAA
                                AGCATCACCGGCGAATGGCATTGTCTTCCCCAAAACCCGGAGCGGCGGCGTGCTGTCGCGTGCCCAATGA
                                ATTTTGATGACTCTCGCAAACGGGAATCTTGGCTCTTTGCATCGGATGGAAGGACGCAGCGAAATGCGAT
                                AAGTGGTGTGAATTGCAAGATCCCGTGAACCATCGAGTCTTTTGAACGCAAGTTGCGCCCGAGGCCATCA
                                GGCTAAGGGCACGCCTGCTTGGGCGTCGCGCTTCGTCTCTCTCCTGCCAATGCTTGCCCGGCATACAGCC
                                AGGCCGGCGTGGTGCGGATGTGAAAGATTGGCCCCTTGTGCCTAGGTGCGGCGGGTCCAAGAGCTGGTGT
                                TTTGATGGCCCGGAACCCGGCAAGAGGTGGACGGATGCTGGCAGCAGCTGCCGTGCGAATCCCCCATGTT
                                GTCGTGCTTGTCGGACAGGCAGGAGAACCCTTCCGAACCCCAATGGAGGGCGGTTGACCGCCATTCGGAT
                                GTGACCCCAGGTCAGGCGGGGGCACCCGCTGAGTTTACGC'''), 
                    740)}
        
        achual = Protein.parse_protein("backend/tests/data/singleProtein.fasta")
        
        self.assertEqual(achual.keys(),expcted.keys()) #had trouble comparing entire dict when I know they would be the same
    def test_parse_multi_protein(self):
        expected = {'gi|2765658|emb|Z78533.1|CIZ78533': 
                        ('gi|2765658|emb|Z78533.1|CIZ78533 C.irapeanum 5.8S rRNA gene and ITS1 and ITS2 DNA', 
                        Seq.Seq('CGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTGATGAGACCGTGG...CGC'), 
                        740), 
                    'gi|2765657|emb|Z78532.1|CCZ78532': 
                        ('gi|2765657|emb|Z78532.1|CCZ78532 C.californicum 5.8S rRNA gene and ITS1 and ITS2 DNA', 
                        Seq.Seq('CGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTGTTGAGACAACAG...GGC'),
                        753)}
        achual = Protein.parse_protein("backend/tests/data/twoProteins.fasta")
        self.assertEqual(achual.keys(),expected.keys()) #had trouble comparing entire dict when I know they would be the same

    def test_parse_different_protein_file_extentions(self):
         ACCEPTED_FILE_TYPES = ['fasta', 'fas', 'fa', 'fna', 'ffn', 'faa', 'mpfa', 'frn','faa']
         expected = {'gi|2765658|emb|Z78533.1|CIZ78533': 
                        ('gi|2765658|emb|Z78533.1|CIZ78533 C.irapeanum 5.8S rRNA gene and ITS1 and ITS2 DNA', 
                        Seq.Seq('''CGTAACAAGGTTTCCGTAGGTGAACCTGCGGAAGGATCATTGATGAGACCGTGGAATAAACGATCGAGTG
                                    AATCCGGAGGACCGGTGTACTCAGCTCACCGGGGGCATTGCTCCCGTGGTGACCCTGATTTGTTGTTGGG'''), 
                        140), }
         for type in ACCEPTED_FILE_TYPES:
             achual = Protein.parse_protein(f"backend/tests/data/different_extensions/single.{type}")
             self.assertEqual(achual.keys(),expected.keys()) #had trouble comparing entire dict when I know they would be the same
    def test_find_one_link(self):
        #Tests finding links to external websites for each protein
        protiens:dict = Protein.parse_protein("backend/tests\data/twoProteins.fasta")
        notExpected = 0
        for key in protiens.keys():
            achual = Protein.find_links(key)
            self.assertNotEqual(notExpected,achual)
    def test_get_indiviudal_mw(self):
        #Need to write once I (Jacob) gets the formulas
        achual = Protein.get_individual_mw(Protein.parse_protein("backend/tests/data/singleProtein.fasta"))   
    def test_get_one_amino_acid_count(self):
        expected =[ {'A': 144,'C': 200,'D': 0,'E': 0,'F': 0,'G': 241,'H': 0,'I': 0,'K': 0,'L': 0,'M': 0,'N': 0,'P': 0,'Q': 0,'R': 0,'S': 0,'T': 155,'V': 0,'W': 0, 'Y': 0}]
        achual = Protein.get_amino_acid_count("backend/tests/data/singleProtein.fasta")
        self.assertEqual(expected,achual)
    def test_get_many_amino_acid_count(self):
        expected = [{'A': 144, 'C': 200, 'D': 0, 'E': 0, 'F': 0, 'G': 241, 'H': 0, 'I': 0, 'K': 0, 'L': 0, 'M': 0, 'N': 0, 'P': 0, 'Q': 0, 'R': 0, 'S': 0, 'T': 155, 'V': 0, 'W': 0, 'Y': 0}, 
                    {'A': 184, 'C': 161, 'D': 0, 'E': 0, 'F': 0, 'G': 204, 'H': 0, 'I': 0, 'K': 0, 'L': 0, 'M': 0, 'N': 0, 'P': 0, 'Q': 0, 'R': 0, 'S': 0, 'T': 204, 'V': 0, 'W': 0, 'Y': 0}]
        
        achual = Protein.get_amino_acid_count("backend/tests/data/twoProteins.fasta")
        self.assertEqual(expected,achual)

if (__name__ == "__main__"):
    t = TestProtein()
    t.test_get_many_amino_acid_count()