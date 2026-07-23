/** Proton VPN API base URL used by official clients. */
export const DEFAULT_API_URL = "https://vpn-api.proton.me";

export const AUTH_INFO_PATH = "/auth/info";
export const AUTH_PATH = "/auth";
export const AUTH_2FA_PATH = "/auth/2fa";
export const AUTH_REFRESH_PATH = "/auth/refresh";
export const CERTIFICATE_PATH = "/vpn/v1/certificate";
export const LOGICALS_PATH = "/vpn/v1/logicals";
/** Lightweight VPN entitlement endpoint used for session verification. */
export const VPN_PATH = "/vpn";
/** How long a cached logicals response is considered fresh. */
export const LOGICALS_TTL_MS = 10 * 60 * 1000;

/**
 * App version header. Using the Linux VPN client format avoids some CAPTCHA
 * challenges that web client versions trigger. Bump when Proton rejects it (5003).
 */
export const APP_VERSION = "linux-vpn@4.13.1";
export const USER_AGENT = "ProtonVPN/4.13.1 (Linux; Ubuntu)";

export const WIREGUARD_PORT = 51820;
export const WIREGUARD_IPV4 = "10.2.0.2/32";
export const DEFAULT_DNS_IPV4 = "10.2.0.1";
export const DEFAULT_ALLOWED_IPS = "0.0.0.0/0";

export const TUNNEL_INTERFACE = "protonvpn";
export const CERT_DURATION = "525600 min"; // 365 days
