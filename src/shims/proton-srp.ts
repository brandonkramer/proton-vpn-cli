/**
 * Thin runtime shim around @protontech/crypto/srp.
 * Initializes CryptoProxy (required for modulus OpenPGP verification) before SRP.
 * Module ids are built at runtime so `tsc` does not typecheck Proton's published .ts.
 */

export interface AuthInfo {
  Version: number;
  Modulus: string;
  ServerEphemeral: string;
  Username?: string;
  Salt: string;
}

export interface AuthCredentials {
  username?: string;
  password: string;
}

export interface SrpProofs {
  clientEphemeral: string;
  clientProof: string;
  expectedServerProof: string;
  sharedSession: Uint8Array;
}

type GetSrp = (
  info: AuthInfo,
  credentials: AuthCredentials,
  authVersion?: number,
) => Promise<SrpProofs>;

interface CryptoApiLike {
  clearKeyStore: () => Promise<unknown> | unknown;
}

interface CryptoApiConstructor {
  new (): CryptoApiLike;
  init: (options: Record<string, never>) => void;
}

interface CryptoProxyLike {
  setEndpoint: (
    endpoint: CryptoApiLike,
    onRelease?: (endpoint: CryptoApiLike) => unknown,
  ) => void;
}

let cryptoReady: Promise<void> | null = null;

async function ensureCryptoProxy(): Promise<void> {
  if (cryptoReady) {
    await cryptoReady;
    return;
  }

  cryptoReady = (async () => {
    const cryptoId = "@protontech/" + "crypto";
    const apiId = "@protontech/" + "crypto/proxy/endpoint/api.ts";

    const { CryptoProxy } = (await import(cryptoId)) as {
      CryptoProxy: CryptoProxyLike;
    };
    const { Api: CryptoApi } = (await import(apiId)) as {
      Api: CryptoApiConstructor;
    };

    CryptoApi.init({});
    CryptoProxy.setEndpoint(new CryptoApi(), (endpoint) =>
      endpoint.clearKeyStore(),
    );
  })();

  try {
    await cryptoReady;
  } catch (error) {
    cryptoReady = null;
    throw error;
  }
}

export async function getSrp(
  info: AuthInfo,
  credentials: AuthCredentials,
  authVersion?: number,
): Promise<SrpProofs> {
  await ensureCryptoProxy();
  const srpId = "@protontech/" + "crypto/srp";
  const mod = (await import(srpId)) as { getSrp: GetSrp };
  return mod.getSrp(info, credentials, authVersion);
}
