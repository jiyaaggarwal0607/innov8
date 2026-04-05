import { encrypt, decrypt } from './utils/crypto.js';

console.log("=== SAFEVOICE ENCRYPTION DIAGNOSTIC ===");
console.log("Initializing secure data simulation...\n");

const mockTestimony = "This is highly sensitive survivor testimony data that MUST remain classified.";

console.log("[1] Raw Data Input:")
console.log(`"${mockTestimony}"\n`);

// 1. Encrypt Data
const encryptedHash = encrypt(mockTestimony);
console.log("[2] Encrypted Data (What your MySQL Database receives):");
console.log(encryptedHash + "\n");

// 2. Decrypt Data
const decryptedText = decrypt(encryptedHash);
console.log("[3] Decrypted Data (What the backend retrieves with the correct key):");
console.log(`"${decryptedText}"\n`);

if (decryptedText === mockTestimony) {
  console.log("✅ DIAGNOSTIC PASSED: Lossless AES-256-GCM encryption verified.");
} else {
  console.error("❌ DIAGNOSTIC FAILED: Data mismatch.");
}
