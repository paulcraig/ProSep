export const API_URL = process.env.REACT_APP_API_URL || '/api';

let cachedPublicKey: string | null = null;

export async function getPublicKey(): Promise<string> {
  if (cachedPublicKey) {
    return cachedPublicKey;
  }

  try {
    const response = await fetch(`${API_URL}/admin/public-key`);
    const data = await response.json();
    cachedPublicKey = data.public_key;
    return cachedPublicKey || "";

  } catch (err) {
    console.error('Failed to fetch public key from server:', err);
    throw new Error('Failed to fetch RSA public key from server. Ensure server is running.');
  }
}
