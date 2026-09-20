import type { GeneratedImage, ImageEditRequest, ImageGenerationRequest } from "../media/src/types.ts";
import { GENERATED_OPENING_ASPECT_RATIO, parseImageAspectRatio } from "../media/src/image-aspect-ratio.ts";
import { cameraGrammarFromUnknown } from "../media/src/cinematographer/camera-grammar.ts";
import { pullForwardReferenceEnabledFromUnknown } from "../media/src/prompts/canonical-destination.ts";
import { destinationConstructionPrompt, canonicalRepairPrompt, openingFrameGenerationPrompt, optionalDestinationLookAhead } from "./src/project/destination.ts";
import { getActiveRuntimeMediaRegistry } from "./runtime-media.ts";
import { resolveTrustedMedia } from "./trusted-media.ts";

export type ConstructDestinationBody = {
  sourceMediaId?: unknown;
  beatId?: unknown;
  intent?: unknown;
  visualDescription?: unknown;
  nextDestination?: unknown;
  aspectRatio?: unknown;
  imageModel?: unknown;
  referenceMediaId?: unknown;
  repairInstruction?: unknown;
  repairRole?: unknown;
  cameraGrammar?: unknown;
  pullForwardReferenceEnabled?: unknown;
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
  generateImage?: (request: ImageGenerationRequest) => Promise<GeneratedImage>;
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
      nextDestination?: { intent: string; visualDescription: string };
      prompt: string;
      aspectRatio?: { width: number; height: number };
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
  if (!/^[A-Z]+$/.test(beatId)) {
    throw new Error("Destination is not ready to construct");
  }
  const sourceMediaId =
    typeof input.body.sourceMediaId === "string" ? input.body.sourceMediaId.trim() : "";
  if (!sourceMediaId) {
    throw new Error("Starting frame has no trusted media identity");
  }
  const intent = typeof input.body.intent === "string" ? input.body.intent.trim() : "";
  const visualDescription =
    typeof input.body.visualDescription === "string" ? input.body.visualDescription.trim() : "";
  const nextDestination = optionalDestinationLookAhead(input.body.nextDestination);
  const aspectRatio = parseImageAspectRatio(input.body.aspectRatio);
  const repairInstruction =
    typeof input.body.repairInstruction === "string" ? input.body.repairInstruction.trim() : "";
  const repairRole = input.body.repairRole === "start" || input.body.repairRole === "end" ? input.body.repairRole : undefined;
  const isRepair = Boolean(repairInstruction && repairRole);
  const pullForwardReferenceEnabled = pullForwardReferenceEnabledFromUnknown(
    input.body.pullForwardReferenceEnabled,
  );
  const prompt = isRepair
    ? canonicalRepairPrompt({
        role: repairRole!,
        intent,
        visualDescription,
        instruction: repairInstruction,
        cameraGrammar: cameraGrammarFromUnknown(input.body.cameraGrammar),
      })
    : destinationConstructionPrompt({
        intent,
        visualDescription,
        nextDestination,
        cameraGrammar: cameraGrammarFromUnknown(input.body.cameraGrammar),
        pullForwardReferenceEnabled,
      });
  // Pull-forward is sourceImage on ImageEditRequest (previous canonical).
  // referenceImages is a separate extra-input list — today Agent repair's
  // opposite canonical. This toggle must not drop those unrelated refs.
  const extraRefId =
    typeof input.body.referenceMediaId === "string" ? input.body.referenceMediaId.trim() : "";
  const referenceImages =
    extraRefId && extraRefId !== sourceMediaId
      ? [resolveTrustedMedia(input.repoRoot, extraRefId)]
      : undefined;
  // Always resolve the preceding-canonical identity. Attach it as the
  // image-edit source only when pull-forward is on, or this is repair.
  const sourceImage = resolveTrustedMedia(input.repoRoot, sourceMediaId);
  const attachPreviousCanonical = isRepair || pullForwardReferenceEnabled;
  const generated = attachPreviousCanonical
    ? await input.editImage({
        sourceImage,
        prompt,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(referenceImages ? { referenceImages } : {}),
      })
    : await generateWithoutPullForward({
        generateImage: input.generateImage,
        prompt,
        aspectRatio,
      });
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
        ...(nextDestination ? { nextDestination } : {}),
        prompt,
        ...(aspectRatio ? { aspectRatio } : {}),
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

async function generateWithoutPullForward(input: {
  generateImage?: (request: ImageGenerationRequest) => Promise<GeneratedImage>;
  prompt: string;
  aspectRatio?: { width: number; height: number };
}): Promise<GeneratedImage> {
  if (!input.generateImage) {
    throw new Error("Destination construction requires generateImage when pull-forward reference is off");
  }
  return input.generateImage({
    prompt: input.prompt,
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
  });
}

export async function generateOpeningFrameImage(input: {
  body: { story?: unknown; aspectRatio?: unknown; imageModel?: unknown; cameraGrammar?: unknown };
  generateImage: (request: ImageGenerationRequest) => Promise<GeneratedImage>;
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
      aspectRatio: { width: number; height: number };
    };
    model: string;
    modelVersion: string | null;
    predictionId: string;
    elapsedMs: number;
    outputMediaId: string;
    outputUrl: string;
  };
}> {
  const story = typeof input.body.story === "string" ? input.body.story.trim() : "";
  const prompt = openingFrameGenerationPrompt(story, cameraGrammarFromUnknown(input.body.cameraGrammar));
  const aspectRatio = GENERATED_OPENING_ASPECT_RATIO;
  const generated = await input.generateImage({ prompt, aspectRatio });
  const fetchOutput = input.fetchOutput ?? fetchGeneratedOutputBytes;
  const output = await fetchOutput(generated.outputUrl);
  const registry = getActiveRuntimeMediaRegistry();
  if (!registry) {
    throw new Error("Opening frame generation failed.");
  }
  const recorded = registry.register(output.bytes, output.contentType);
  return {
    mediaId: recorded.mediaId,
    imageUrl: recorded.imageUrl,
    evidence: {
      request: {
        sourceMediaId: "",
        beatId: "A",
        intent: story,
        visualDescription: "",
        prompt,
        aspectRatio,
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
