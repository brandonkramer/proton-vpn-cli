import { createPrivateKey, generateKeyPairSync } from "node:crypto";
import { createHash } from "node:crypto";

const ED25519_SPKI_PREFIX = Buffer.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

export interface WireGuardKeyPair {
  /** PEM-encoded SubjectPublicKeyInfo Ed25519 public key for Proton certificate API. */
  publicKeyPem: string;
  /** WireGuard Interface PrivateKey (X25519, standard base64). */
  x25519PrivateKeyBase64: string;
}

function toPem(der: Buffer, label: string): string {
  const body = der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? "";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`;
}

/** Convert Ed25519 seed to X25519 private key (RFC 7748 / Proton go-vpn-lib). */
export function ed25519SeedToX25519(seed: Buffer): Buffer {
  const hash = createHash("sha512").update(seed).digest();
  hash[0]! &= 0xf8;
  hash[31]! &= 0x7f;
  hash[31]! |= 0x40;
  return hash.subarray(0, 32);
}

export function generateKeyPair(): WireGuardKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const publicKeyPem = toPem(Buffer.from(publicDer), "PUBLIC KEY");

  // Node's PKCS8 export includes algorithm OID; extract the 32-byte seed.
  const privateDer = privateKey.export({ type: "pkcs8", format: "der" });
  const seed = Buffer.from(privateDer).subarray(-32);

  // Sanity: reconstructed SPKI should match Proton's expected prefix + raw pubkey.
  const rawPub = Buffer.from(publicDer).subarray(-32);
  const expectedSpki = Buffer.concat([ED25519_SPKI_PREFIX, rawPub]);
  if (!expectedSpki.equals(Buffer.from(publicDer))) {
    // Fall back to constructing PEM from known prefix if Node's encoding differs.
    const reconstructed = toPem(expectedSpki, "PUBLIC KEY");
    const x25519 = ed25519SeedToX25519(seed);
    return {
      publicKeyPem: reconstructed,
      x25519PrivateKeyBase64: x25519.toString("base64"),
    };
  }

  // Ensure seed is valid by round-tripping through createPrivateKey.
  createPrivateKey({ key: privateDer, format: "der", type: "pkcs8" });

  const x25519 = ed25519SeedToX25519(seed);
  return {
    publicKeyPem,
    x25519PrivateKeyBase64: x25519.toString("base64"),
  };
}
