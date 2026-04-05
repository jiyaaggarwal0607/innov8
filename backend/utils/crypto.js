import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

let ENCRYPTION_KEY;
if (process.env.ENCRYPTION_KEY) {
  ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  if (ENCRYPTION_KEY.length !== 32) {
    console.warn("WARNING: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Using insecure fallback key derivation.");
    ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  }
} else {
  console.warn("WARNING: No ENCRYPTION_KEY provided in .env! Generating a random one. Encrypted data will be unrecoverable on restart.");
  ENCRYPTION_KEY = crypto.randomBytes(32);
}

export function encrypt(text) {
  if (!text) return text;
  try {
    const stringText = typeof text !== 'string' ? JSON.stringify(text) : text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(stringText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    
    // iv:authTag:encryptedText
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error("Encryption error:", err.message);
    throw err;
  }
}

export function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string' || !encryptedData.includes(':')) {
    return encryptedData;
  }
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return encryptedData;
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error("Decryption error:", err.message);
    return null; // Return null if tampering is detected
  }
}
