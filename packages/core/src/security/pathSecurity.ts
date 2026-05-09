const BLOCKED_PROTOCOLS = [
  "http:",
  "https:",
  "javascript:",
  "data:",
  "blob:",
  "file:",
  "ftp:",
  "mailto:",
];

export function assertSafeEbkPath(path: string): void {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid EBK path.");
  }

  const normalizedPath = path.replace("\\", "/").trim();

  if (!normalizedPath) {
    throw new Error("Invalid EBK path: path is empty.");
  }

  if (normalizedPath.startsWith("/")) {
    throw new Error(`Unsafe EBK path: absolute paths are not allowed: ${path}`);
  }

  if (normalizedPath.includes("../") || normalizedPath.includes("..\\")) {
    throw new Error(`Unsafe EBK path: parent traversal is not allowed: ${path}`);
  }

  if (normalizedPath === ".." || normalizedPath.startsWith("../")) {
    throw new Error(`Unsafe EBK path: parent traversal is not allowed: ${path}`);
  }

  try {
    const url = new URL(normalizedPath);

    if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
      throw new Error(`Unsafe EBK path: protocol is not allowed: ${url.protocol}`);
    }
  } catch {
    // This is expected for normal relative paths like pages/start.html.
  }
}

export function sanitizeEbkPath(path: string): string {
  assertSafeEbkPath(path);

  return path.replace("\\", "/").trim();
}

export function assertSafeAssetSrc(src: string): void {
  assertSafeEbkPath(src);
}