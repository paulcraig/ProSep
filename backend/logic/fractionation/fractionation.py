
import random


class Fractionation:
    @staticmethod
    def stable_color(seed: str) -> str:
        """
        Generate a deterministic color from a protein ID.
        This keeps the same protein visually consistent across renders.
        """
        rnd = random.Random(seed)
        return "#%02x%02x%02x" % (
            rnd.randint(40, 220),
            rnd.randint(40, 220),
            rnd.randint(40, 220),
        )