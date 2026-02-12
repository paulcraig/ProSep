import os, hashlib, base64

from pathlib import Path
from typing import Optional

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey


class AuthService:
    """
    RSA-based password authentication.
    """
    HASH_FILE = Path("data/admin_hash.txt")
    PRIVATE_KEY_FILE = Path("data/rsa_private.pem")
    PUBLIC_KEY_FILE = Path("data/rsa_public.pem")


    @classmethod
    def _ensure_data_dir(cls) -> None:
        os.makedirs("data", exist_ok=True)


    @classmethod
    def _get_private_key(cls) -> RSAPrivateKey:
        cls._ensure_data_dir()
        
        if cls.PRIVATE_KEY_FILE.exists():
            with open(cls.PRIVATE_KEY_FILE, "rb") as f:
                private_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
                if not isinstance(private_key, RSAPrivateKey):
                    raise TypeError("Loaded key is not an RSA private key")
                
                return private_key
        
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend()
        )
        
        with open(cls.PRIVATE_KEY_FILE, "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        public_key = private_key.public_key()

        with open(cls.PUBLIC_KEY_FILE, "wb") as f:
            f.write(public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ))
        
        print(f"Generated new RSA key pair:")
        print(f"> Private key: {cls.PRIVATE_KEY_FILE}")
        print(f"> Public key: {cls.PUBLIC_KEY_FILE}")
        print(f"Fetch public key from GET /admin/public-key")
        
        return private_key


    @classmethod
    def get_public_key_pem(cls) -> str:
        cls._ensure_data_dir()
        
        if cls.PUBLIC_KEY_FILE.exists():
            with open(cls.PUBLIC_KEY_FILE, "r") as f:
                return f.read().strip()
        
        private_key = cls._get_private_key()
        public_key = private_key.public_key()

        pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        with open(cls.PUBLIC_KEY_FILE, "wb") as f:
            f.write(pem)
        
        return pem.decode('utf-8').strip()


    @classmethod
    def decrypt_password(cls, encrypted_b64: str) -> Optional[str]:
        try:
            private_key = cls._get_private_key()
            encrypted = base64.b64decode(encrypted_b64)
            
            plaintext = private_key.decrypt(
                encrypted,
                padding.PKCS1v15()
            )
            
            return plaintext.decode('utf-8')
        
        except Exception as e:
            print(f"Decryption error: {e}")
            return None


    @classmethod
    def hash_password(cls, plaintext: str) -> str:
        return hashlib.sha256(plaintext.encode('utf-8')).hexdigest()


    @classmethod
    def get_stored_hash(cls) -> Optional[str]:
        cls._ensure_data_dir()
        try:
            with open(cls.HASH_FILE, "r") as f:
                return f.read().strip()
            
        except FileNotFoundError:
            return None


    @classmethod
    def verify(cls, encrypted_password: str) -> bool:
        plaintext = cls.decrypt_password(encrypted_password)
        if not plaintext:
            return False
        
        password_hash = cls.hash_password(plaintext)
        stored_hash = cls.get_stored_hash()
        
        return bool(stored_hash and stored_hash == password_hash)


    @classmethod
    def set_hash(cls, encrypted_password: str) -> bool:
        cls._ensure_data_dir()
        
        plaintext = cls.decrypt_password(encrypted_password)
        if not plaintext:
            return False
        
        password_hash = cls.hash_password(plaintext)
        
        try:
            with open(cls.HASH_FILE, "w") as f:
                f.write(password_hash)
            return True
        except Exception:
            return False
