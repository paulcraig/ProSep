import unittest

from Bio import Seq
from backend.utility.protein import Protein

class TestProtein(unittest.TestCase):
   
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
    def test_get_mw(self):
        file = "backend/tests/data/singleProtein.fasta"
        first_seq = next(iter(Protein.parse_protein(file).values()))[1]
        expected = sum(Protein.AMINO_ACIDS.get(aa, {'mass': 0.0})['mass'] for aa in str(first_seq))
        actual = Protein.get_mw(file)[0]
        
        acceptedError = .01
        self.assertTrue((actual >= expected*(1-acceptedError) and actual <= expected*(1+acceptedError)))
         
       
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
    file = "backend/tests/data/singleProtein.fasta"
    t: Seq.Seq = list(list(Protein.parse_protein(file).values())[0][1])
    print(list(t))
