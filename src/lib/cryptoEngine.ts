import CryptoJS from 'crypto-js';

export interface StudentProfile {
  roll: string;
  name: string;
  email: string;
  ts: number;
}

export interface EncryptedPacket {
  p: StudentProfile;
  h: string;
}

// Fallback default keys if env vars are missing
const DEFAULT_AES_KEY = 'EventQR256BitMasterSecretKey2026!';
const DEFAULT_3DES_KEY = 'Event3DESMasterSecretKey24!';
const DEFAULT_HMAC_SALT = 'EventQRHMACIntegritySalt2026#';
const DEFAULT_XOR_BYTE = 0x5a; // 90

function getKeys() {
  const aesKey = process.env.NEXT_PUBLIC_AES_SECRET_KEY || DEFAULT_AES_KEY;
  const tripleDesKey = process.env.NEXT_PUBLIC_3DES_SECRET_KEY || DEFAULT_3DES_KEY;
  const hmacSalt = process.env.NEXT_PUBLIC_HMAC_SALT || DEFAULT_HMAC_SALT;

  let xorByte = DEFAULT_XOR_BYTE;
  const rawXor = process.env.NEXT_PUBLIC_XOR_SHIFT_BYTE;
  if (rawXor) {
    if (rawXor.startsWith('0x') || rawXor.startsWith('0X')) {
      xorByte = parseInt(rawXor, 16);
    } else {
      xorByte = parseInt(rawXor, 10);
    }
  }

  return { aesKey, tripleDesKey, hmacSalt, xorByte };
}

/**
 * Generate HMAC-SHA256 signature for payload
 */
export function generateHMAC(payload: StudentProfile, salt?: string): string {
  const key = salt || getKeys().hmacSalt;
  const dataString = JSON.stringify(payload);
  return CryptoJS.HmacSHA256(dataString, key).toString(CryptoJS.enc.Hex);
}

/**
 * Encrypt a StudentProfile using deterministic multi-layer encryption
 * Pipeline: HMAC-SHA256 -> AES -> Triple-DES -> Bitwise XOR Shift -> Hex Encoding
 * Ensures the QR code is PERMANENT and UNIQUE for a given student ID.
 */
export function encryptPayload(profile: StudentProfile): string {
  const { aesKey, tripleDesKey, hmacSalt, xorByte } = getKeys();

  // Layer 0: Integrity Checksum (HMAC-SHA256)
  const hmacSignature = generateHMAC(profile, hmacSalt);
  const packet: EncryptedPacket = {
    p: profile,
    h: hmacSignature,
  };
  const jsonPayload = JSON.stringify(packet);

  // Layer 1: Deterministic AES Encryption (ECB Mode)
  const aesKeyHex = CryptoJS.SHA256(aesKey);
  const aesCipher = CryptoJS.AES.encrypt(jsonPayload, aesKeyHex, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();

  // Layer 2: Deterministic Triple-DES Encryption (ECB Mode)
  const tripleDesKeyHex = CryptoJS.SHA256(tripleDesKey);
  const tripleDesCipher = CryptoJS.TripleDES.encrypt(aesCipher, tripleDesKeyHex, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();

  // Layer 3: Custom Bitwise XOR Array Mask Shift
  const xorBytes: number[] = [];
  for (let i = 0; i < tripleDesCipher.length; i++) {
    const charCode = tripleDesCipher.charCodeAt(i);
    xorBytes.push(charCode ^ xorByte);
  }

  // Layer 4: Hexadecimal Conversion (Uppercase Hex)
  let hexString = '';
  for (let i = 0; i < xorBytes.length; i++) {
    const hex = xorBytes[i].toString(16).padStart(2, '0');
    hexString += hex;
  }

  return hexString.toUpperCase();
}

/**
 * Decrypt a Hex QR string back into a verified StudentProfile
 * Reverse Pipeline: Hex Parsing -> Bitwise XOR Unmask -> Triple-DES Decrypt -> AES Decrypt -> HMAC Validation
 */
export function decryptPayload(hexPayload: string): StudentProfile {
  const { aesKey, tripleDesKey, hmacSalt, xorByte } = getKeys();

  const cleanHex = hexPayload.trim().toUpperCase();

  // Validation: Hex string length must be even and valid hex characters
  if (!/^[0-9A-F]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
    throw new Error('INVALID_HEX_FORMAT: Scanned data is not a valid Hexadecimal payload.');
  }

  // Layer 4 Reverse: Hex to XOR Byte Array
  const xorBytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byteHex = cleanHex.substring(i, i + 2);
    xorBytes.push(parseInt(byteHex, 16));
  }

  // Layer 3 Reverse: Bitwise XOR Unmasking
  let tripleDesCipher = '';
  for (let i = 0; i < xorBytes.length; i++) {
    const originalCharCode = xorBytes[i] ^ xorByte;
    tripleDesCipher += String.fromCharCode(originalCharCode);
  }

  // Layer 2 Reverse: Triple-DES Decryption
  let aesCipher = '';
  try {
    const tripleDesKeyHex = CryptoJS.SHA256(tripleDesKey);
    const bytes = CryptoJS.TripleDES.decrypt(tripleDesCipher, tripleDesKeyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    aesCipher = bytes.toString(CryptoJS.enc.Utf8);
    if (!aesCipher) {
      throw new Error('DECRYPTION_FAILED_3DES');
    }
  } catch (err) {
    throw new Error('CORRUPTED_CIPHER: Triple-DES decryption failed. Keys may be mismatched.');
  }

  // Layer 1 Reverse: AES Decryption
  let jsonPayload = '';
  try {
    const aesKeyHex = CryptoJS.SHA256(aesKey);
    const bytes = CryptoJS.AES.decrypt(aesCipher, aesKeyHex, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    jsonPayload = bytes.toString(CryptoJS.enc.Utf8);
    if (!jsonPayload) {
      throw new Error('DECRYPTION_FAILED_AES');
    }
  } catch (err) {
    throw new Error('CORRUPTED_CIPHER: AES decryption failed. Key mismatch or corrupted string.');
  }

  // Layer 0 Reverse: Parse Packet & Verify HMAC Checksum
  let packet: EncryptedPacket;
  try {
    packet = JSON.parse(jsonPayload);
  } catch (err) {
    throw new Error('INVALID_JSON: Decrypted string is not a valid JSON packet.');
  }

  if (!packet.p || !packet.h) {
    throw new Error('INVALID_PACKET_STRUCTURE: Payload missing student data or HMAC signature.');
  }

  // HMAC Checksum Validation
  const expectedHMAC = generateHMAC(packet.p, hmacSalt);
  if (expectedHMAC !== packet.h) {
    throw new Error('HMAC_TAMPER_ERROR: Security signature mismatch! Ticket has been tampered with or modified.');
  }

  return packet.p;
}
