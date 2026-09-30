const BLOCKED_PROTOCOLS = new Set([
  "http:",
  "https:",
  "javascript:",
  "data:",
  "blob:",
  "file:",
  "ftp:",
  "mailto:",
]);

function normalizeEbkPath(path: string): string {
  return path.replaceAll("\\", "/").trim();
}

export function assertSafeEbkPath(path: string): void {
  if (typeof path !== "string" || !path.trim()) {
    throw new Error("Invalid EBK path: path is empty.");
  }

  const normalizedPath = normalizeEbkPath(path);

  if (normalizedPath.includes("\0")) {
    throw new Error("Unsafe EBK path: null bytes are not allowed.");
  }

  if (normalizedPath.startsWith("/") || /^[a-zA-Z]:\//.test(normalizedPath)) {
    throw new Error(`Unsafe EBK path: absolute paths are not allowed: ${path}`);
  }

  const segments = normalizedPath.split("/");

  if (segments.some((segment) => segment === "..")) {
    throw new Error(`Unsafe EBK path: parent traversal is not allowed: ${path}`);
  }

  const protocolMatch = normalizedPath.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)/);

  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();

    if (BLOCKED_PROTOCOLS.has(protocol)) {
      throw new Error(`Unsafe EBK path: protocol is not allowed: ${protocol}`);
    }

    throw new Error(`Unsafe EBK path: URL protocols are not allowed: ${protocol}`);
  }

  let decodedPath = normalizedPath;

  try {
    decodedPath = decodeURIComponent(normalizedPath);
  } catch {
    throw new Error(`Unsafe EBK path: invalid percent encoding: ${path}`);
  }

  const decodedSegments = normalizeEbkPath(decodedPath).split("/");

  if (decodedSegments.some((segment) => segment === "..")) {
    throw new Error(`Unsafe EBK path: encoded parent traversal is not allowed: ${path}`);
  }
}

export function sanitizeEbkPath(path: string): string {
  assertSafeEbkPath(path);
  return normalizeEbkPath(path);
}

export function assertSafeAssetSrc(src: string): void {
  assertSafeEbkPath(src);
}
