from collections.abc import Callable, Sequence
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
            
    @staticmethod
    def get_salt_scale(entries: Sequence[ProteinEntry], salt_alpha: float, max_salt_delta: float):
        """
        The most strongly bound protein should always fall at exactly the max salt delta.
        
        Args:
            max_binding_strength: a list of each protein that will be involved in the fractionation
            salt_alpha: a modifier on salt strength
            max_salt_delta: the highest theoretical distance between the salt start and salt end
        Returns:
            a coefficient s such that s times the effective max salt delta is equal to the highest binding strength protein in entries.
        """
        
        max_binding_strength = 0
        for entry in entries:
            max_binding_strength = max(entry.binding_strength, max_binding_strength)
        
        effective_max_salt_delta = max_salt_delta ** float(salt_alpha) 
        return max_binding_strength / effective_max_salt_delta
    
    @staticmethod
    def distribute[T: ProteinEntry](
        entries: Sequence[T],
        fraction_count: int,
        is_protein_kicked_by_salt: Callable[[T, float], bool],
        salt_start: float,
        salt_end: float,
        salt_elbow_location: float,
        salt_alpha: float,
        max_salt_delta: float
    ):
        salt_scale = BindingStrengthFractionation.get_salt_scale(entries, salt_alpha, max_salt_delta)
        
        remaining_proteins = entries
        fractions: list[list[T]] = [[] for _ in range(fraction_count)]
        wash_count = 0
        non_wash_count = 0 
        # At each fraction, we find the salt level and then find what proteins should fall at that salt level.
        # We then distribute those proteins among the rest of the fractions.
        # Each fraction can be thought of creating a distribution, where our end result is the sum of all of those distributions.
        for fraction_index in range(fraction_count):
            fraction_location = fraction_index / fraction_count
            
            salt_at_fraction = Fractionation.get_salt_level(fraction_location, salt_start, salt_end, salt_elbow_location, salt_alpha) * salt_scale
            def is_protein_kicked(protein: T, salt_at_fraction = salt_at_fraction) -> bool: # The default assignment is the closure / "binding"
                return is_protein_kicked_by_salt(protein, salt_at_fraction) # This is to create a closure around salt_at_fraction, which greatly simplifies the map call below. This is sometimes called "binding". Python generally does not respect typical closures due to most values being references, making this neccesary.
            
            
            # lets say we're at fraction 50 (of 80). We find all proteins that will start falling at fraction 50
            protein_mask = list(map(is_protein_kicked, remaining_proteins))
            falling_proteins = [entry for entry, will_fall in zip(remaining_proteins, protein_mask) if will_fall]
            staying_proteins = [entry for entry, will_fall in zip(remaining_proteins, protein_mask) if not will_fall]
            remaining_proteins = staying_proteins # and replace entries with the ones that stay
            
            # then, we find where, out of the remaining 31 fractions, those will fall.
            distributed_proteins = Fractionation.fractionate_with_inverse_gaussian(
                falling_proteins,
                fraction_count,
                offset=fraction_location # It can only fall after where it started. This does mean later fractions get "squished"
            )
            
            # Now, we have an array of length fraction_count.
            # If you show the length of each, youll get an array like [0, 0, 0, 0, 39, 402, 204, 130, 100, ...]
            # The leading zeros mean that the proteins fell off later on in the fractionation, when the salt was higher, and therefore
            # cannot fall into earlier fractions.
            # We take this distribution and add it to a sum of every other distribution.
            for i in range(fraction_count):
                for protein in distributed_proteins[i]:
                    fractions[i].append(protein)
                
            # keep track of wash/non wash counts
            salt_elbow_fraction_index = int(salt_elbow_location * fraction_count)
            if fraction_index < salt_elbow_fraction_index: # anything that falls before we begin to increase salt is wash
                wash_count += len(falling_proteins) 
            else:
                non_wash_count += len(falling_proteins)
                
        return fractions, wash_count, non_wash_count