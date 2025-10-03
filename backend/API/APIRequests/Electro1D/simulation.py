import os, random
from typing import Any
from fastapi import APIRouter, UploadFile

from backend.API.BodyFormats.ResponseClasses import ProteinInfo
from backend.Electro1D import Protein


router = APIRouter(
    prefix='/1d',
    tags=['1D Simulation']
)

ACCEPTED_FILE_TYPES = ['fasta', 'fas', 'fa', 'fna', 'ffn', 'faa', 'mpfa', 'frn']


@router.post('/ProteinInfo/File', response_model=list[ProteinInfo])
async def fileGetProteinInfo(file: UploadFile) -> Any:
    '''
    Parse a single FASTA file and return protein info.
    '''
    protein = Protein
    return_list = []
    temp_data_file = None
    
    try:
        filetype = file.filename.split('.')[-1]
        if filetype in ACCEPTED_FILE_TYPES:
            temp_data_file = open('temp_data_file.faa', 'w+')
            content = file.file.read().decode('utf-8')
            temp_data_file.write(content)

            protein_dict = protein.parse_protein('temp_data_file.faa')
            weight_list = protein.get_mw('temp_data_file.faa')
            i = 0

            for seq_id in protein_dict.keys():
                header_parts = protein_dict[seq_id][0].split('|')
                if len(header_parts) > 1:
                    return_list.append({
                        'name': ' '.join(protein_dict[seq_id][0].split(' ')[1:]),
                        'molecularWeight': weight_list[i],
                        'color': '#' + hex(random.randrange(0, 2**24))[2:],
                        'id_num': header_parts[1],
                        'id_str': header_parts[0]
                    })

                else:
                    return_list.append({
                        'name': ' '.join(protein_dict[seq_id][0].split(' ')[1:]),
                        'molecularWeight': weight_list[i],
                        'color': '#' + hex(random.randrange(0, 2**24))[2:],
                        'id_num': header_parts[0],
                        'id_str': ''
                    })
                i += 1

        else:
            return_list = [{
                'name': 'unsupported file format',
                'molecularWeight': 0,
                'color': '',
                'id_num': '',
                'id_str': '',
            }]

    except Exception:
        return_list = [{
            'name': 'error',
            'molecularWeight': 0,
            'color': '',
            'id_num': '',
            'id_str': '',
        }]

    finally:
        file.file.close()
        if temp_data_file is not None:
            temp_data_file.close()

            try:
                os.remove('temp_data_file.faa')
            except Exception:
                pass

    return return_list



def sort_files(file_list: list[UploadFile]):
    n = len(file_list)

    for i in range(n - 1):
        swapped = False

        for j in range(0, n - i - 1):
            if file_list[j].filename > file_list[j + 1].filename:
                swapped = True
                file_list[j], file_list[j + 1] = file_list[j + 1], file_list[j]

        if not swapped:
            return


@router.post('/BatchFileProtein/Batch', response_model=list[list[ProteinInfo]])
async def batchFileGetProteinInfo(files: list[UploadFile]) -> Any:
    '''
    Parse a batch of FASTA files and return lists of proteins per well.
    '''
    well_data = []
    sort_files(files)

    for file in files:
        filetype = file.filename.split('.')[-1]

        if filetype in ACCEPTED_FILE_TYPES:
            well_data.append(await fileGetProteinInfo(file))
            
    return well_data
