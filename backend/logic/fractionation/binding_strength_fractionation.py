from dataclasses import dataclass

from backend.logic.fractionation.fractionation import Fractionation


class BindingStrengthFractionation:
    @dataclass
    class ProteinEntry(Fractionation.ProteinEntry):
        # Computed information
        binding_strength: float
        
        def to_json(self):
            return {
                **super().to_json(),
                "color": Fractionation.stable_color(self.seq_id),
                "bindingStrength": round(self.binding_strength, 4),
            }