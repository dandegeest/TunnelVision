import { describe, expect, it } from "vitest";
import {
  audioIdentitiesCompatible,
  seamTrimPacketDecision,
  videoIdentitiesCompatible,
  type VideoPacketIdentity,
} from "./compatibility";
import { continuousPreviewCursor } from "./remux";

const clip = (journeyId: string, patch: Partial<VideoPacketIdentity> = {}): VideoPacketIdentity => ({
  journeyId,
  codec: "avc",
  codecString: "avc1.4d6032",
  width: 1928,
  height: 1072,
  descriptionKey: "014d6032",
  rotation: 0,
  ...patch,
});

describe("MediaBunny remux compatibility", () => {
  it("accepts clips that share a decoder configuration", () => {
    expect(videoIdentitiesCompatible([clip("A-B"), clip("B-C")])).toEqual({ ok: true });
  });

  it("refuses a codec mismatch without transcoding", () => {
    const result = videoIdentitiesCompatible([
      clip("A-B"),
      clip("B-C", { codec: "vp9", codecString: "vp09.00.10.08" }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Codec mismatch/);
    }
  });

  it("refuses a decoder-description mismatch", () => {
    const result = videoIdentitiesCompatible([clip("A-B"), clip("B-C", { descriptionKey: "different" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Codec configuration mismatch/);
    }
  });

  it("refuses a resolution mismatch", () => {
    const result = videoIdentitiesCompatible([clip("A-B"), clip("B-C", { width: 1280, height: 720 })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/Resolution mismatch/);
    }
  });

  it("keeps a stored seam trim only when the next packet is also a keyframe", () => {
    expect(seamTrimPacketDecision("key", "delta").apply).toBe(false);
    expect(seamTrimPacketDecision("key", "delta").warning).toMatch(/needs a decode/);
    expect(seamTrimPacketDecision("key", "key")).toEqual({ apply: true });
  });

  it("starts the next clip after audio that runs past the video", () => {
    expect(continuousPreviewCursor(6.041666666666667, 6.048)).toBe(6.048);
    expect(continuousPreviewCursor(5.083333333333334, 5.0)).toBe(5.083333333333334);
    expect(continuousPreviewCursor(5, null)).toBe(5);
  });

  it("treats mixed audio as incompatible", () => {
    const result = audioIdentitiesCompatible([
      { journeyId: "A-B", codec: "aac", codecString: "mp4a.40.2", sampleRate: 48000, numberOfChannels: 2 },
      { journeyId: "B-C", codec: "aac", codecString: "mp4a.40.2", sampleRate: 44100, numberOfChannels: 2 },
    ]);
    expect(result.ok).toBe(false);
  });
});
