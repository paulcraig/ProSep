from E2DProtein import *

minPercentAcrylamide : float = 0.0
maxPercentAcrylamide : float = 0.0


def set_percent(the_lower_percent : float, the_higher_percent : float):
    minPercentAcrylamide = the_lower_percent
    maxPercentAcrylamide = the_higher_percent




class ProteinDot:

    # Member variables
    DIAMETER : int = 7
    show_all_dots = False
    show_me = True

    def __init__(self, the_protein : E2DProtein, the_x : float, the_y : float):
        self.x = the_x
        self.y = the_y
        self.protein = the_protein
        self.mw = the_protein.get_mw()
        self.color = the_protein.get_color()


    def __init__(self, the_color : tuple, the_x : float, the_y : float):
        self.x = the_x
        self.y = the_y
        self.color = the_color

   
    def change_y(self):
        if(minPercentAcrylamide != maxPercentAcrylamide):
            self.y = (10* 1 / ((self.y-48)* (maxPercentAcrylamide - minPercentAcrylamide)/532)+ minPercentAcrylamide)* (2)* .25 * (100000/self.mw)+ self.y
        else:
            self.y = (10 * 1 / minPercentAcrylamide) * (2) * .25 * (100000 / self.mw) + self.y
        # Make call to repaint

    # Resets y-position to 48 when the simulation is reset
    def restart(self):
        self.y = 48

    def get_x(self):
        return self.x
    
    def get_y(self):
        return self.y
    
    def get_diameter(self):
        return self.DIAMETER
    
    def set_show(self):
        self.show_all_dots = not self.show_all_dots
    
    def show(self):
        self.show_me=True

    def no_show(self):
        self.show_me=False

    def get_show(self):
        return self.show_me
    
    def get_show_dots(self):
        return self.show_all_dots
    
    def get_protien(self):
        return self.protein
    
    def get_color(self):
        return self.color
    
    def set_color(self, the_color):
        self.color = the_color

    # def draw(self, Graphics g):
    #     graphic = g
    #     if(self.show_all_dots & self.show):
    #         # g.setColor(self.color)
    #         # g.drawOval((int)self.x, (int)self.y, (int)self.DIAMETER, (int)self.DIAMETER)
    #         # g.fillOval((int)self.x, (int)self.y, (int)self.DIAMETER, (int)self.DIAMETER)
    #         # g.setColor(Color(54, 100, 139))

    # def update():
    #     draw(graphic)
    
