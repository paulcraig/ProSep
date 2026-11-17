from dataclasses import dataclass

from pydantic import BaseModel, Field

from backend.logic.fractionation.fractionation import Fractionation


class RequestWithSalt(BaseModel):
    # Starting and ending salt concentrations
    salt_start: float = Field(0.0, ge=0.0, le=10.0, description="Starting salt concentration")
    salt_end: float = Field(1.5, ge=0.0, le=10.0, description="Ending salt concentration")
    salt_elbow_location: float = Field(ge=0, le=1, description="Percentage representing how far along fractionation salt begins to transition from salt to end")
    max_salt_delta: float = Field(description="The theoretically largest difference in salt levels the user could have specified")
    salt_alpha: float = Field(1.2, ge=0.0, le=5.0, description="Salt-strength exponent")

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