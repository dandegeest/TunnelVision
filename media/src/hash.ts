import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export async function sha256File(path: string): Promise<{
  readonly sha256: string;
  readonly bytes: number;
}> {
  const [buf, info] = await Promise.all([readFile(path), stat(path)]);
  return {
    sha256: createHash("sha256").update(buf).digest("hex"),
    bytes: info.size,
  };
}

export function sha256Bytes(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
