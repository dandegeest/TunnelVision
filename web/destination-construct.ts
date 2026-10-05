import type { GeneratedImage, ImageEditRequest, ImageGenerationRequest, MediaInput } from "../media/src/types.ts";

function imageRoutingEvidence(generated: GeneratedImage): {
  provider: string;
  model: string;
  modelVersion: string | null;
  predictionId: string;
  elapsedMs: number;
  outputUrl: string;
  configId?: string;
  optimizeFor?: string;
  resolution?: string;
  credits?: number;
} {
  const metadata = generated.metadata;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);
  const configId = text(metadata.configId);
  const optimizeFor = text(metadata.optimizeFor);
  const resolution = text(metadata.resolution);
  const credits = typeof metadata.credits === "number" ? metadata.credits : undefined;
  return {
    provider: generated.provider,
    model: generated.model,
    modelVersion: generated.modelVersion,
    predictionId: generated.predictionId,
    elapsedMs: generated.elapsedMs,
    outputUrl: generated.outputUrl,
    ...(configId ? { configId } : {}),
    ...(optimizeFor ? { optimizeFor } : {}),
    ...(resolution ? { resolution } : {}),
    ...(credits !== undefined ? { credits } : {}),
  };
}
import { GENERATED_OPENING_ASPECT_RATIO, parseImageAspectRatio } from "../media/src/image-aspect-ratio.ts";
import { cameraGrammarFromUnknown } from "../media/src/cinematographer/camera-grammar.ts";
import { pullForwardReferenceEnabledFromUnknown } from "../media/src/prompts/canonical-destination.ts";
import { destinationConstructionPrompt, canonicalRepairPrompt, characterRepairPrompt, openingFrameGenerationPrompt, optionalDestinationLookAhead, CHARACTER_REPAIR_REFERENCE_LIMITATION, TRAVERSAL_HOLD_REFERENCE_LIMITATION, type CanonicalReferenceEvidence } from "./src/project/destination.ts";
import type { CanonicalImageReferenceRole } from "./src/project/types.ts";
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
  candidateMediaId?: unknown;
  repairInstruction?: unknown;
  repairRole?: unknown;
  spatialInstruction?: unknown;
  cameraGrammar?: unknown;
  pullForwardReferenceEnabled?: unknown;
  subjectMediaId?: unknown;
  subjectDescription?: unknown;
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
    references?: CanonicalReferenceEvidence;
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
  const repairRole =
    input.body.repairRole === "start" || input.body.repairRole === "end" || input.body.repairRole === "character"
      ? input.body.repairRole
      : undefined;
  const isSpatialRepair = Boolean(repairInstruction && (repairRole === "start" || repairRole === "end"));
  const isCharacterRepair = Boolean(repairInstruction && repairRole === "character");
  const pullForwardReferenceEnabled = pullForwardReferenceEnabledFromUnknown(
    input.body.pullForwardReferenceEnabled,
  );
  const postedSubjectId = optionalMediaId(input.body.subjectMediaId);
  const subjectMediaId = isCharacterRepair || isSpatialRepair ? postedSubjectId : "";
  const subjectDescription =
    typeof input.body.subjectDescription === "string" ? input.body.subjectDescription.trim() : "";
  const spatialInstruction =
    typeof input.body.spatialInstruction === "string" ? input.body.spatialInstruction.trim() : "";
  const candidateMediaId = optionalMediaId(input.body.candidateMediaId);
  if (isCharacterRepair && !subjectMediaId) {
    throw new Error("Character repair requires a persistent subject reference");
  }
  if (isCharacterRepair && !candidateMediaId) {
    throw new Error("Character repair requires the failed candidate canonical");
  }
  // Ordinary B+ construction uses the previous canonical only. Character
  // repair orders the sheet first so a single-image editor still sees
  // identity, then the failed candidate, then the previous canonical.
  const extraRefId = optionalMediaId(input.body.referenceMediaId);
  const images = isCharacterRepair
    ? canonicalReferenceImages({
        repoRoot: input.repoRoot,
        subjectMediaId,
        candidateMediaId,
        continuityMediaId: sourceMediaId !== candidateMediaId ? sourceMediaId : undefined,
        repairMediaIds: [],
      })
    : canonicalReferenceImages({
        repoRoot: input.repoRoot,
        subjectMediaId: isSpatialRepair ? subjectMediaId : "",
        subjectAfterScene: isSpatialRepair,
        continuityMediaId: !isSpatialRepair && pullForwardReferenceEnabled ? sourceMediaId : undefined,
        repairMediaIds: isSpatialRepair ? [sourceMediaId, extraRefId] : extraRefId ? [extraRefId] : [],
      });
  const prompt = isCharacterRepair
    ? characterRepairPrompt({
        description: subjectDescription,
        visualDescription,
        instruction: repairInstruction,
        cameraGrammar: cameraGrammarFromUnknown(input.body.cameraGrammar),
        ...(spatialInstruction ? { spatialInstruction } : {}),
      })
    : isSpatialRepair
      ? canonicalRepairPrompt({
          role: repairRole === "start" ? "start" : "end",
          intent,
          visualDescription,
          instruction: repairInstruction,
          cameraGrammar: cameraGrammarFromUnknown(input.body.cameraGrammar),
          ...(subjectMediaId ? { holdSubject: { description: subjectDescription } } : {}),
        })
      : destinationConstructionPrompt({
          intent,
          visualDescription,
          nextDestination,
          cameraGrammar: cameraGrammarFromUnknown(input.body.cameraGrammar),
          pullForwardReferenceEnabled,
        });
  const references = canonicalReferenceEvidence(
    images,
    subjectDescription,
    isCharacterRepair
      ? CHARACTER_REPAIR_REFERENCE_LIMITATION
      : isSpatialRepair && subjectMediaId
        ? TRAVERSAL_HOLD_REFERENCE_LIMITATION
        : undefined,
  );
  const generated = images.length > 0
    ? await input.editImage({
        sourceImage: images[0]!.image,
        prompt,
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(images.length > 1 ? { referenceImages: images.slice(1).map((item) => item.image) } : {}),
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
      references,
      ...imageRoutingEvidence(generated),
      outputMediaId: recorded.mediaId,
    },
  };
}

function optionalMediaId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function canonicalReferenceImages(input: {
  repoRoot: string;
  subjectMediaId: string;
  /** Traversal reshoots keep the scene first. Character repair keeps the sheet first. */
  subjectAfterScene?: boolean;
  candidateMediaId?: string;
  continuityMediaId?: string;
  repairMediaIds: readonly string[];
}): { mediaId: string; role: CanonicalImageReferenceRole; image: MediaInput }[] {
  const images: { mediaId: string; role: CanonicalImageReferenceRole; image: MediaInput }[] = [];
  const push = (mediaId: string | undefined, role: CanonicalImageReferenceRole) => {
    if (!mediaId || images.some((item) => item.mediaId === mediaId)) {
      return;
    }
    images.push({ mediaId, role, image: resolveTrustedMedia(input.repoRoot, mediaId) });
  };
  if (!input.subjectAfterScene) {
    push(input.subjectMediaId, "subject");
  }
  push(input.candidateMediaId, "candidate");
  push(input.continuityMediaId, "continuity");
  for (const mediaId of input.repairMediaIds) {
    push(mediaId, "repair");
  }
  if (input.subjectAfterScene) {
    push(input.subjectMediaId, "subject");
  }
  return images;
}

function canonicalReferenceEvidence(
  images: readonly { mediaId: string; role: CanonicalImageReferenceRole }[],
  subjectDescription: string,
  referenceLimitation?: string,
): CanonicalReferenceEvidence {
  const subjectSupplied = images.some((item) => item.role === "subject");
  return {
    subjectSupplied,
    ...(subjectSupplied && subjectDescription ? { subjectDescription } : {}),
    referenceCount: images.length,
    references: images.map((item) => ({ role: item.role, mediaId: item.mediaId })),
    ...(referenceLimitation ? { referenceLimitation } : {}),
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
  repoRoot?: string;
  body: {
    story?: unknown;
    aspectRatio?: unknown;
    imageModel?: unknown;
    cameraGrammar?: unknown;
    subjectMediaId?: unknown;
    subjectDescription?: unknown;
  };
  generateImage: (request: ImageGenerationRequest) => Promise<GeneratedImage>;
  editImage?: (request: ImageEditRequest) => Promise<GeneratedImage>;
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
    references?: CanonicalReferenceEvidence;
  };
}> {
  const story = typeof input.body.story === "string" ? input.body.story.trim() : "";
  const subjectMediaId = optionalMediaId(input.body.subjectMediaId);
  const subjectDescription =
    typeof input.body.subjectDescription === "string" ? input.body.subjectDescription.trim() : "";
  const prompt = openingFrameGenerationPrompt(
    story,
    cameraGrammarFromUnknown(input.body.cameraGrammar),
    subjectMediaId ? { description: subjectDescription } : undefined,
  );
  const aspectRatio = GENERATED_OPENING_ASPECT_RATIO;
  const images =
    subjectMediaId && input.repoRoot
      ? canonicalReferenceImages({
          repoRoot: input.repoRoot,
          subjectMediaId,
          repairMediaIds: [],
        })
      : [];
  if (subjectMediaId && images.length === 0) {
    throw new Error("Persistent subject reference requires a project root");
  }
  const references = canonicalReferenceEvidence(images, subjectDescription);
  const generated = images.length > 0
    ? await (input.editImage ?? missingOpeningEdit)({
        sourceImage: images[0]!.image,
        prompt,
        aspectRatio,
      })
    : await input.generateImage({ prompt, aspectRatio });
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
      references,
      ...imageRoutingEvidence(generated),
      outputMediaId: recorded.mediaId,
    },
  };
}

function missingOpeningEdit(): Promise<GeneratedImage> {
  return Promise.reject(new Error("Opening frame generation requires editImage when a persistent subject reference is set"));
}
