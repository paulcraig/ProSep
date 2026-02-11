from typing import Optional
from pathlib import Path
import os


class AuthService:
    """
    Stores a hashed password in a file...
    Tokenless: direct hash comparison on each request... we need HTTPS...
    """
    HASH_FILE = Path("data/admin_hash.txt")


    @classmethod
    def _ensure_data_dir(cls) -> None:
        """
        Ensure data directory exists.
        """
        os.makedirs(os.path.dirname(cls.HASH_FILE), exist_ok=True)


    @classmethod
    def get_stored_hash(cls) -> Optional[str]:
        """
        Retrieve the stored hashed password.
        """
        cls._ensure_data_dir()

        try:
            with open(cls.HASH_FILE, "r") as f:
                return f.read().strip()
            
        except FileNotFoundError:
            return None


    @classmethod
    def verify(cls, provided_hash: str) -> bool:
        """
        Verify if the provided hash matches the stored one.
        """
        stored = cls.get_stored_hash()
        return bool(stored and stored == provided_hash.strip())


    @classmethod
    def set_hash(cls, new_hash: str) -> bool:
        """
        Set or overwrite the stored hash.
        """
        cls._ensure_data_dir()

        try:
            with open(cls.HASH_FILE, "w") as f:
                f.write(new_hash.strip())

            return True
        
        except Exception:
            return False
