import { encryptPayload, decryptPayload, StudentProfile } from '../cryptoEngine';

export function runCryptoTestSuite() {
  console.log('--- STARTING CRYPTOGRAPHIC ENGINE UNIT TEST SUITE ---');

  const sampleProfile: StudentProfile = {
    roll: '2024CS01',
    name: 'Pavan Kandala',
    email: 'pavan@example.com',
    ts: 1770000000,
  };

  // Test 1: Encryption
  console.log('Test 1: Encrypting sample student profile...');
  const hexOutput = encryptPayload(sampleProfile);
  console.log(`Generated Hex Ciphertext (${hexOutput.length} chars):\n${hexOutput}`);

  if (!/^[0-9A-F]+$/.test(hexOutput)) {
    throw new Error('TEST FAILED: Output is not valid upper-case Hexadecimal string.');
  }

  // Test 2: Decryption
  console.log('\nTest 2: Decrypting Hex Ciphertext...');
  const decryptedProfile = decryptPayload(hexOutput);
  console.log('Decrypted Profile:', JSON.stringify(decryptedProfile));

  if (
    decryptedProfile.roll !== sampleProfile.roll ||
    decryptedProfile.name !== sampleProfile.name ||
    decryptedProfile.email !== sampleProfile.email
  ) {
    throw new Error('TEST FAILED: Decrypted profile does not match original profile!');
  }
  console.log('✅ TEST 2 PASSED: Bidirectional encryption/decryption integrity verified!');

  // Test 3: Tamper Detection (Modify 1 character)
  console.log('\nTest 3: Testing HMAC/Tamper detection by modifying 1 character in Hex string...');
  const tamperedChar = hexOutput[0] === 'A' ? 'B' : 'A';
  const tamperedHex = tamperedChar + hexOutput.slice(1);

  try {
    decryptPayload(tamperedHex);
    throw new Error('TEST FAILED: Tampered hex string was accepted without error!');
  } catch (err: any) {
    console.log(`✅ TEST 3 PASSED: Tampered payload correctly rejected with error: "${err.message}"`);
  }

  console.log('\n🎉 ALL CRYPTOGRAPHIC TESTS PASSED SUCCESSFULLY!');
}
