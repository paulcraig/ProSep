export type StandardProtein = {
    name: string;
    molecularWeight: number;
    migrationDistance: number;
    color: string;
    id_num: string;
    id_str: string;
};

export const standards: StandardProtein[] = [
    { name: 'B-Galactosidase',    molecularWeight: 116250,  migrationDistance: 0, color: '#4dd0e1',   id_num: '6X1Q', id_str: 'pdb' },
    { name: 'Phosphorylase B',    molecularWeight: 97400,   migrationDistance: 0, color: '#d3e24aff', id_num: '3LQ8', id_str: 'pdb' },
    { name: 'Serum Albumin',      molecularWeight: 66200,   migrationDistance: 0, color: '#3d98c1ff', id_num: '1AO6', id_str: 'pdb' },
    { name: 'Ovalbumin',          molecularWeight: 45000,   migrationDistance: 0, color: '#f06292',   id_num: '1OVA', id_str: 'pdb' },
    { name: 'Carbonic Anhydrase', molecularWeight: 29000,   migrationDistance: 0, color: '#b8de7cff', id_num: '1CA2', id_str: 'pdb' },
    { name: 'Trypsin Inhibitor',  molecularWeight: 20100,   migrationDistance: 0, color: '#5c6bc0',   id_num: '2PTC', id_str: 'pdb' },
    { name: 'Lysozyme',           molecularWeight: 14400,   migrationDistance: 0, color: '#81c784',   id_num: '6LYZ', id_str: 'pdb' },
    { name: 'Aprotinin',          molecularWeight: 6500,    migrationDistance: 0, color: '#e57373',   id_num: '1AAP', id_str: 'pdb' }
];