import { createHash } from "node:crypto";
import { copyFile, readFile, stat } from "node:fs/promises";

export function pngDimensions(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes.toString("ascii", 1, 4) !== "PNG") {
    throw new Error("not a PNG");
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

export function isApproximately16x9(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }
  return Math.abs(width / height - 16 / 9) <= 0.02;
}

export async function copyExactFile(source: string, destination: string): Promise<{
  readonly sha256: string;
  readonly bytes: number;
}> {
  await copyFile(source, destination);
  const [src, dest, info] = await Promise.all([
    readFile(source),
    readFile(destination),
    stat(destination),
  ]);
  if (Buffer.compare(src, dest) !== 0) {
    throw new Error(`byte copy mismatch: ${destination}`);
  }
  return {
    sha256: createHash("sha256").update(dest).digest("hex"),
    bytes: info.size,
  };
}
