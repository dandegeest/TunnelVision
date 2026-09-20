import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { MediaGenerationError } from "../errors.ts";

export async function downloadRunwayOutput(
  outputUrl: string,
  outputPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImpl(outputUrl);
  } catch (error) {
    throw new MediaGenerationError("provider_unavailable", "Failed to download Runway output", {
      cause: error,
    });
  }
  if (!response.ok) {
    throw new MediaGenerationError(
      "generation_failed",
      `Failed to download Runway output (${response.status})`,
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, bytes);
}
