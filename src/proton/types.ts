export interface AuthInfoResponse {
  Code: number;
  Version: number;
  Modulus: string;
  ServerEphemeral: string;
  Salt: string;
  SRPSession: string;
  "2FA"?: {
    Enabled: number;
    TOTP: number;
  };
  Error?: string;
}

export interface Session {
  Code: number;
  AccessToken: string;
  RefreshToken: string;
  TokenType: string;
  Scopes: string[];
  UID: string;
  UserID: string;
  EventID?: string;
  ServerProof?: string;
  PasswordMode?: number;
  ExpiresIn: number;
  Error?: string;
  "2FA"?: {
    Enabled: number;
    TOTP: number;
  };
}

export interface SavedSession {
  session: Session;
  username: string;
  savedAt: string;
  expiresAt: string;
}

export interface LogicalServer {
  ID: string;
  Name: string;
  EntryCountry: string;
  ExitCountry: string;
  Domain: string;
  Tier: number;
  Features: number;
  Region: string;
  City: string;
  Score: number;
  Load: number;
  Status: number;
  Servers: PhysicalServer[];
  HostCountry?: string;
}

export interface PhysicalServer {
  ID: string;
  EntryIP: string;
  ExitIP: string;
  Domain: string;
  Status: number;
  Label: string;
  X25519PublicKey: string;
  Generation?: number;
  ServicesDownReason?: string;
}

export interface LogicalsResponse {
  Code: number;
  LogicalServers: LogicalServer[];
  Error?: string;
}

export interface VpnCertificateResponse {
  Code: number;
  Error?: string;
  SerialNumber: string;
  ClientKeyFingerprint: string;
  ClientKey: string;
  Certificate: string;
  ExpirationTime: number;
  RefreshTime: number;
  Mode: string;
  DeviceName: string;
  ServerPublicKeyMode?: string;
  ServerPublicKey?: string;
}

export interface ActiveTunnel {
  interfaceName: string;
  confPath: string;
  serverName: string;
  country: string;
  city: string;
  connectedAt: string;
}

export const FEATURE_SECURE_CORE = 1;
export const FEATURE_TOR = 2;
export const FEATURE_P2P = 4;
export const FEATURE_STREAMING = 8;
export const FEATURE_IPV6 = 16;

export const STATUS_ONLINE = 1;
export const TIER_FREE = 0;
export const TIER_PLUS = 2;
export const TIER_PM = 3;

export const API_CODE_OK = 1000;
export const API_CODE_MULTI = 1001;
export const API_CODE_PASSWORD_WRONG = 8002;
export const API_CODE_HUMAN_VERIFICATION = 9001;
export const API_CODE_APP_VERSION_BAD = 5003;
export const API_CODE_MAILBOX_PASSWORD = 10013;
export const API_CODE_SCOPE = 9100;

export function isSuccessCode(code: number): boolean {
  return code === API_CODE_OK || code === API_CODE_MULTI;
}

export function tierName(tier: number): string {
  switch (tier) {
    case TIER_FREE:
      return "Free";
    case TIER_PLUS:
      return "Plus";
    case TIER_PM:
      return "Visionary";
    default:
      return "Unknown";
  }
}

export function featureNames(features: number): string[] {
  const names: string[] = [];
  if (features & FEATURE_SECURE_CORE) names.push("SecureCore");
  if (features & FEATURE_TOR) names.push("Tor");
  if (features & FEATURE_P2P) names.push("P2P");
  if (features & FEATURE_STREAMING) names.push("Streaming");
  if (features & FEATURE_IPV6) names.push("IPv6");
  return names;
}
