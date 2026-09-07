import type { GeneratedImage, ImageEditRequest } from "../media/src/types.ts";
import { destinationConstructionPrompt, CONSTRUCTIBLE_BEAT_ID } from "./src/project/destination.ts";
import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { resolveTrustedMedia } from "./trusted-media.ts";

export type ConstructDestinationBody = {
  sourceMediaId?: unknown;
  beatId?: unknown;
  intent?: unknown;
  visualDescription?: unknown;
};

export async function fetchGeneratedOutputBytes(url: string): Promise<{
  bytes: Buffer;
  contentType?: string;
}> {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("Generated image URL must be http or https");
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to retrieve generated image");
  }
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}

export async function constructDestinationImage(input: {
  repoRoot: string;
  body: ConstructDestinationBody;
  editImage: (request: ImageEditRequest) => Promise<GeneratedImage>;
  fetchOutput?: (url: string) => Promise<{ bytes: Buffer; contentType?: string }>;
}): Promise<{
  mediaId: string;
  imageUrl: string;
  evidence: {
    request: {
      sourceMediaId: string;
      beatId: string;
      intent: string;
      visualDescription: string;
      prompt: string;
    };
    model: string;
    modelVersion: string | null;
    predictionId: string;
    elapsedMs: number;
    outputMediaId: string;
    outputUrl: string;
  };
}> {
  const beatId = typeof input.body.beatId === "string" ? input.body.beatId.trim() : "";
  if (beatId !== CONSTRUCTIBLE_BEAT_ID) {
    throw new Error("This slice can only construct destination B");
  }
  const sourceMediaId =
    typeof input.body.sourceMediaId === "string" ? input.body.sourceMediaId.trim() : "";
  if (!sourceMediaId) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const intent = typeof input.body.intent === "string" ? input.body.intent.trim() : "";
  const visualDescription =
    typeof input.body.visualDescription === "string" ? input.body.visualDescription.trim() : "";
  const prompt = destinationConstructionPrompt({ intent, visualDescription });
  const sourceImage = resolveTrustedMedia(input.repoRoot, sourceMediaId);
  const generated = await input.editImage({ sourceImage, prompt });
  const fetchOutput = input.fetchOutput ?? fetchGeneratedOutputBytes;
  const output = await fetchOutput(generated.outputUrl);
  const registry = getActiveRuntimeMediaRegistry();
  if (!registry) {
    throw new Error("Destination construction failed.");
  }
  const recorded = registry.register(output.bytes, output.contentType);
  return {
    mediaId: recorded.mediaId,
    imageUrl: recorded.imageUrl,
    evidence: {
      request: {
        sourceMediaId,
        beatId,
        intent,
        visualDescription,
        prompt,
      },
      model: generated.model,
      modelVersion: generated.modelVersion,
      predictionId: generated.predictionId,
      elapsedMs: generated.elapsedMs,
      outputMediaId: recorded.mediaId,
      outputUrl: generated.outputUrl,
    },
  };
}
