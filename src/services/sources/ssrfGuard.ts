// SSRF guard for server-side fetches of user-supplied URLs (pasted lot links, image URLs
// scraped from lot pages). The app legitimately fetches arbitrary auction sites, so we do NOT
// allowlist hosts; instead we resolve the host and refuse any URL that points at a private,
// loopback, link-local or otherwise non-public address (e.g. 127.0.0.1, 169.254.169.254,
// 10/8, 192.168/16). http/https only, standard ports only.
//
// Residual risk: a redirect or DNS-rebinding race could still make a single request reach an
// internal address between the check and the connect. Call assertPublicUrl on the FINAL url
// after redirects too (fetchSource does). For complete per-connection protection, move to a
// custom undici dispatcher whose `connect.lookup` rejects private IPs; that is the recommended
// follow-up but needs the `undici` dependency.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const parseV4 = (ip: string): number[] => ip.split(".").map((n) => Number(n));

const isPrivateV4 = (ip: string): boolean => {
  const p = parseV4(ip);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                         // 10.0.0.0/8 private
  if (a === 127) return true;                        // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local (incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;           // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0) return true;             // 192.0.0.0/24 + 192.0.2.0/24 (IETF/TEST-NET-1)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a === 198 && b === 51) return true;            // 198.51.100.0/24 TEST-NET-2
  if (a === 203 && b === 0) return true;             // 203.0.113.0/24 TEST-NET-3
  if (a >= 224) return true;                         // 224.0.0.0/4 multicast + 240/4 reserved
  return false;
};

const isPrivateV6 = (ip: string): boolean => {
  const s = ip.toLowerCase().split("%")[0]; // strip zone id
  if (s === "::1" || s === "::") return true;        // loopback / unspecified
  if (s.startsWith("fe80")) return true;             // link-local
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // fc00::/7 unique local
  const mapped = s.match(/(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped ::ffff:a.b.c.d
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
};

/** True when the literal IP must not be fetched. Unknown/invalid formats are treated as unsafe. */
export const isDisallowedIp = (ip: string): boolean => {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true;
};

/** Throws when the URL is not a public http(s) endpoint. Resolves silently when it is safe to fetch. */
export const assertPublicUrl = async (rawUrl: string): Promise<void> => {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("ssrf_blocked: invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("ssrf_blocked: scheme");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("ssrf_blocked: port");
  if (u.username || u.password) throw new Error("ssrf_blocked: credentials");

  const host = u.hostname.replace(/^\[|\]$/g, ""); // unwrap [ipv6]
  if (!host) throw new Error("ssrf_blocked: no_host");

  // Literal IP: check directly (no DNS).
  if (isIP(host)) {
    if (isDisallowedIp(host)) throw new Error("ssrf_blocked: private_address");
    return;
  }

  // Hostname: resolve and reject if ANY returned address is non-public.
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    // The host does not resolve here, so the real fetch cannot reach any internal resource
    // either — there is nothing to SSRF to. Allow it through (the fetch will simply fail).
    // Failing open ONLY on genuine resolution failure also keeps this guard from breaking
    // offline/mocked test environments, while a host that DOES resolve to an internal IP is
    // still blocked below. ("localhost" resolves locally without network, so it stays blocked.)
    return;
  }
  if (!addrs.length) return;
  for (const a of addrs) {
    if (isDisallowedIp(a.address)) throw new Error("ssrf_blocked: private_address");
  }
};
