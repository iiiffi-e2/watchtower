import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
]);

function isPrivateIpv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

function isBlockedHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith(".local")) return true;
  if (lower.endsWith(".internal")) return true;
  const ipType = isIP(lower);
  if (ipType === 4) return isPrivateIpv4(lower);
  if (ipType === 6) return isPrivateIpv6(lower);
  return false;
}

export function validateMonitorUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, error: "Invalid URL." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URL must use http or https." };
  }

  if (isBlockedHost(url.hostname)) {
    return { ok: false, error: "URL host is not allowed." };
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}
