import math, re

from fastapi import UploadFile
import numpy as np
from io import StringIO
from typing import Any, Dict, List

from Bio import SeqIO
from backend.logic.one_de_simulation import Simulation_1de
from backend.utility.protein import Protein
class ProteolyticDigestion():
    @staticmethod
    def breakUpProtein(sequence:str,two_animno_acids:str)->List:
        seperated:list = sequence.split(two_animno_acids)
        i = 0
        while (i < len(seperated)-1):
            seperated[i] =  seperated[i]+two_animno_acids
            i+=1
    
        return seperated
     

    @staticmethod
    def fileGetProteinInfo(file: UploadFile) -> Any:
        """
        Parse a single FASTA file and return protein info.
        """
        protein = Protein
        return_list = []

        try:
            filetype = (file.filename or '').split('.')[-1].lower()

            if filetype in Simulation_1de.ACCEPTED_FILE_TYPES:
                content = file.file.read().decode("utf-8")
                handle = StringIO(content)

                protein_dict = protein.parse_protein(handle)
                handle.seek(0)
            

               

                for i, seq_id in enumerate(protein_dict.keys()):
                    header = protein_dict[seq_id][0]
                    header_parts = header.split('|')

                    entry = {
                        'name': ' '.join(header.split(' ')[1:]),
                        "sequence" : str(protein_dict[seq_id][1])
                    }
                    return_list.append(entry)

            else:
                return_list = [{
                    'name': 'unsupported file format',
                  
                }]

        except Exception as e:
            return_list = [{
                'name': 'error',
                
               
            }]
            raise e

        finally:
            file.file.close()

        return return_list