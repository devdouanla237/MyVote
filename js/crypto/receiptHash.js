/*
 * Empreinte maison P2P-VoteEngine — RHE-128 (Receipt Hash Engine, version 1)
 * Algorithme original du projet : deux voies de 64 bits, absorption UTF-8,
 * mélange croisé, rotations et multiplications modulo 2^64.
 * Ce code ne reprend pas une implémentation FNV, Murmur ou SHA.
 */
(function (root) {
  'use strict';

  const MASK = 0xFFFFFFFFFFFFFFFFn;
  const BASE36 = 36n;
  const OUTPUT_LENGTH = 24;

  function rotateLeft(value, count) {
    const n = BigInt(count);
    return ((value << n) | (value >> (64n - n))) & MASK;
  }

  function mix64(value) {
    let x = value & MASK;
    x ^= x >> 29n;
    x = (x * 0x9E3779B185EBCA87n) & MASK;
    x ^= x >> 32n;
    x = (x * 0xC2B2AE3D27D4EB4Fn) & MASK;
    x ^= x >> 28n;
    return x & MASK;
  }

  function toBase36(value) {
    let result = (value & ((1n << 128n) - 1n)).toString(36);
    // 36^24 représente un espace de sortie de 24 caractères.
    const limit = BASE36 ** BigInt(OUTPUT_LENGTH);
    result = ((value % limit) + limit).toString(36);
    return result.padStart(OUTPUT_LENGTH, '0').slice(-OUTPUT_LENGTH).toUpperCase();
  }

  function receiptHash(input) {
    if (typeof input !== 'string') {
      throw new TypeError('receiptHash attend une chaîne de caractères.');
    }

    const bytes = new TextEncoder().encode(input);
    let a = 0x243F6A8885A308D3n;
    let b = 0x13198A2E03707344n;

    // Absorption : chaque octet agit sur les deux voies dans un ordre différent.
    for (let i = 0; i < bytes.length; i++) {
      const byte = BigInt(bytes[i]);
      const position = BigInt(i + 1);
      a ^= (byte + (position * 0x9E3779B1n)) & MASK;
      a = (rotateLeft(a, 11) * 0xD6E8FEB86659FD93n) & MASK;
      b ^= (a + (byte << BigInt((i % 7) + 1))) & MASK;
      b = (rotateLeft(b, 17) * 0xA5A3564E27FEC1A5n) & MASK;
      a ^= b >> 7n;
    }

    // Injection de la longueur : les chaînes avec des octets terminaux différents
    // ne partagent pas le même état simplement parce qu'un bloc serait complété.
    const length = BigInt(bytes.length);
    a ^= mix64(length ^ 0xA4093822299F31D0n);
    b ^= mix64((length << 1n) ^ 0x082EFA98EC4E6C89n);

    // Finalisation croisée : 6 tours indépendants pour diffuser les changements.
    for (let round = 0; round < 6; round++) {
      const r = BigInt(9 + round * 3);
      a = mix64((a + rotateLeft(b, Number(r))) & MASK);
      b = mix64((b ^ rotateLeft(a, Number(27n - r))) & MASK);
      a = (a * 0x9FB21C651E98DF25n + BigInt(round + 1)) & MASK;
      b = (b * 0xC6BC279692B5CC83n + BigInt(round + 17)) & MASK;
    }

    const combined = ((a << 64n) | b) & ((1n << 128n) - 1n);
    return toBase36(combined);
  }

  root.receiptHash = receiptHash;
  root.ReceiptHash = Object.freeze({ algorithm: 'RHE-128-v1', outputLength: OUTPUT_LENGTH, hash: receiptHash });
})(typeof window !== 'undefined' ? window : globalThis);
