/** Packet-level identity used to decide whether clips can share one sample entry. */
export type VideoPacketIdentity = {
  journeyId: string;
  codec: string;
  codecString: string;
  width: number;
  height: number;
  /** Hex of the decoder description (AVC SPS/PPS and the equivalent for other codecs). */
  descriptionKey: string;
  rotation: number;
};

export type AudioPacketIdentity = {
  journeyId: string;
  codec: string;
  codecString: string;
  sampleRate: number;
  numberOfChannels: number;
};

export function descriptionKey(description: AllowSharedBufferSource | undefined): string {
  if (!description) {
    return "";
  }
  const bytes = ArrayBuffer.isView(description)
    ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
    : new Uint8Array(description);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function videoIdentitiesCompatible(
  clips: readonly VideoPacketIdentity[],
): { ok: true } | { ok: false; reason: string } {
  const first = clips[0];
  if (!first) {
    return { ok: false, reason: "No selected traversal takes to assemble." };
  }
  for (const clip of clips.slice(1)) {
    if (clip.codec !== first.codec || clip.codecString !== first.codecString) {
      return {
        ok: false,
        reason: `Codec mismatch. ${first.journeyId} is ${first.codecString || first.codec}; ${clip.journeyId} is ${clip.codecString || clip.codec}.`,
      };
    }
    if (clip.width !== first.width || clip.height !== first.height) {
      return {
        ok: false,
        reason: `Resolution mismatch. ${first.journeyId} is ${first.width}×${first.height}; ${clip.journeyId} is ${clip.width}×${clip.height}.`,
      };
    }
    if (clip.descriptionKey !== first.descriptionKey) {
      return {
        ok: false,
        reason: `Codec configuration mismatch. ${clip.journeyId} does not share the decoder description of ${first.journeyId}.`,
      };
    }
    if (clip.rotation !== first.rotation) {
      return {
        ok: false,
        reason: `Rotation mismatch. ${first.journeyId} is ${first.rotation}°; ${clip.journeyId} is ${clip.rotation}°.`,
      };
    }
  }
  return { ok: true };
}

export function audioIdentitiesCompatible(
  clips: readonly AudioPacketIdentity[],
): { ok: true } | { ok: false; reason: string } {
  const first = clips[0];
  if (!first) {
    return { ok: true };
  }
  for (const clip of clips.slice(1)) {
    if (
      clip.codec !== first.codec ||
      clip.codecString !== first.codecString ||
      clip.sampleRate !== first.sampleRate ||
      clip.numberOfChannels !== first.numberOfChannels
    ) {
      return {
        ok: false,
        reason: `Audio mismatch. ${first.journeyId} is ${first.codecString || first.codec} ${first.sampleRate} Hz ${first.numberOfChannels}ch; ${clip.journeyId} is ${clip.codecString || clip.codec} ${clip.sampleRate} Hz ${clip.numberOfChannels}ch.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Dropping decoded frame 0 is only a packet edit when the next packet can
 * stand alone. A keyframe followed by a delta packet is the reference for
 * the rest of the GOP.
 */
export function seamTrimPacketDecision(
  firstType: "key" | "delta" | null,
  secondType: "key" | "delta" | null,
): { apply: boolean; warning?: string } {
  if (firstType !== "key") {
    return {
      apply: false,
      warning: "Seam trim was not applied. The first packet is not a keyframe.",
    };
  }
  if (secondType !== "key") {
    return {
      apply: false,
      warning:
        "Seam trim was not applied. The first packet is a keyframe later packets depend on, so dropping it needs a decode.",
    };
  }
  return { apply: true };
}
