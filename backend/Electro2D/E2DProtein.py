import random as r

colors = [(255,0,0),(160, 11, 206),(72, 100, 100),(0, 95, 95),(0,255,255),(158, 49, 49),(0, 135, 16),(255, 96, 0)]

rnaColor = (0,0,255)
dnaColor = (255,0,0)
enzymeColor = (0,255,0)
hypotheticalColor = (255,192,203)
transportColor = (117, 92, 50)
receptorColor = (176, 196, 222)
transductionColor = (255, 216, 202)


class E2DProtein:
    def __init__(self, the_id : str, the_mol_wt : float , the_pi : float, the_sequence : str, the_fcn : str):
        self.id = the_id
        self.mol_wt = the_mol_wt
        self.pi = the_pi
        self.sequence = the_sequence
        self.fcn = the_fcn

        # Sets color to one of the defined colors above based on what type of protein it is
        if("dna" in the_id.lower()):
            self.color = dnaColor
        elif("ribosomal" in the_id.lower()):
            self.color = hypotheticalColor
        elif("enzyme" in the_id.lower()):
            self.color = enzymeColor
        elif("transport" in the_id.lower()):
            self.color = transportColor
        elif("receptor" in the_id.lower() or "reception" in the_id.lower()):
            self.color = receptorColor
        elif("transduction" in the_id.lower()):
            self.color = transductionColor
        else:
            self.color = r.randint(0,len(colors)-1)

    def get_id(self):
        return self.id
    
    def get_mw(self):
        return self.mol_wt
    
    def get_color(self):
        return self.color
    
    def get_pi(self):
        return self.pi
    
    def get_sequence(self):
        return self.sequence
    
    def get_function(self):
        return self.fcn