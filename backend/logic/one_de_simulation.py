import random, logging

from typing import Any
from io import StringIO
from fastapi import UploadFile
from backend.utility.protein import Protein


logging.basicConfig(level=logging.DEBUG)


class Simulation_1de():
    ACCEPTED_FILE_TYPES = ['fasta', 'fas', 'fa', 'fna', 'ffn', 'faa', 'mpfa', 'frn','faa']

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
                weight_list = protein.get_mw(handle)

                logging.debug(protein_dict)
                logging.info(weight_list)

                for i, seq_id in enumerate(protein_dict.keys()):
                    header = protein_dict[seq_id][0]
                    header_parts = header.split('|')

                    entry = {
                        'name': ' '.join(header.split(' ')[1:]),
                        'molecularWeight': weight_list[i],
                        'color': '#%02x%02x%02x' % tuple(int(x*255) for x in __import__('colorsys').hls_to_rgb(random.random(), 0.5, 0.7)),
                        'id_num': header_parts[1] if len(header_parts) > 1 else header_parts[0],
                        'id_str': header_parts[0] if len(header_parts) > 1 else ''
                    }
                    return_list.append(entry)

            else:
                return_list = [{
                    'name': 'unsupported file format',
                    'molecularWeight': 0,
                    'color': '',
                    'id_num': '',
                    'id_str': '',
                }]

        except Exception as e:
            logging.exception("Error parsing protein file")
            return_list = [{
                'name': 'error',
                'molecularWeight': 0,
                'color': '',
                'id_num': '',
                'id_str': '',
                'errorDetail': str(e),
            }]

        finally:
            file.file.close()

        return return_list


    @staticmethod
    def batchFileGetProteinInfo(files: list[UploadFile]) -> Any:
        '''
        Parse a batch of FASTA files and return lists of proteins per well.
        '''
        well_data = []
        files.sort(key=lambda f: f.filename or "")

        for file in files:
            filetype = filetype = (file.filename or '').split('.')[-1]

            if filetype in Simulation_1de.ACCEPTED_FILE_TYPES:
                well_data.append(Simulation_1de.fileGetProteinInfo(file))
                
        return well_data
