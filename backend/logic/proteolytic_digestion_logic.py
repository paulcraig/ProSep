
from fastapi import UploadFile
import numpy as np
from io import StringIO
from typing import Any
from typing import List
import numpy as np
import matplotlib.pyplot as plt
from backend.logic.one_de_simulation import Simulation_1de
from backend.utility.protein import Protein
import random
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
            

               
                namesList = []
                for i, seq_id in enumerate(protein_dict.keys()):
                    header = protein_dict[seq_id][0]
                    header_parts = header.split('|')

                    entry = {
                        'name': ' '.join(header.split(' ')[1:]),
                        "sequence" : str(protein_dict[seq_id][1])
                    }
                    return_list.append(entry)
                    namesList.append(entry['name'])

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
        ProteolyticDigestion.updateGraph(namesList)
        return return_list
    
    def updateGraph(namesList):
        HEIGHT_OF_GRAPH = 12
        WIDTH_OF_GRAPH = 7
        x = np.linspace(0, WIDTH_OF_GRAPH, 500)
        y = np.linspace(0, HEIGHT_OF_GRAPH, 500)
        X, Y = np.meshgrid(x, y)

        region = (  
            (Y < X**3) & #left curve
            (X > 0) & #left bound of graph
            (Y <= 12) & #ceiling of graph
            (Y < (-X + 7)**3) & #right curve
            (X < 7) & #right bound of graph
            (Y >= 0) #floor of graph
        )

        Z = np.where(region, 1, np.nan)

        plt.figure(figsize=(6,6))
        plt.contourf(X, Y, Z, colors="black")

        if (len(namesList)==0):
            plt.text(3, 5, "EMPTY", fontsize=16, color="white")
        else:
            spacing = HEIGHT_OF_GRAPH / len(namesList)
            current = 0
            for name in namesList:
                plt.text((WIDTH_OF_GRAPH-1)/2,(current+current+ spacing)/2,name,fontsize=5,color="white")
                region2 = (
                    (Y < X**3) &
                    (X > 0) &
                    (Y <= current+spacing) &
                    (Y < (-X + 7)**3) &
                    (X < 7) &
                    (Y >= current)
                )
                Z2 = np.where(region2, 1, np.nan)
                rand_color = (random.random(), random.random(), random.random())


                plt.contourf(X, Y, Z2, colors=[rand_color])
                current+=spacing


        plt.xlim(0, 7)
        plt.ylim(0, 12)
        plt.axis('off')
        plt.savefig("frontend/jbio-app/src/assets/proteinGraph.png", dpi=300, bbox_inches="tight")