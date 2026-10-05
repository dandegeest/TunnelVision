import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  type AudioCodec,
  type EncodedPacket,
  type InputAudioTrack,
  type InputVideoTrack,
  type VideoCodec,
} from "mediabunny";
import { currentCutClips } from "../project/current-cut";
import { currentOutgoingStartDrop } from "../project/outgoing-start-drop";
import { selectedTake } from "../project/takes";
import type { Project } from "../project/types";
import {
  audioIdentitiesCompatible,
  descriptionKey,
  seamTrimPacketDecision,
  videoIdentitiesCompatible,
  type AudioPacketIdentity,
  type VideoPacketIdentity,
} from "./compatibility";

export type ContinuousPreviewClip = {
  journeyId: string;
  takeId: string;
  url: string;
  model?: string;
  durationSeconds: number;
  dropFirstFrame: boolean;
};

export type ContinuousPreviewReport = {
  ok: boolean;
  remuxOnly: boolean;
  clipCount: number;
  sourceDurationSeconds: number;
  outputDurationSeconds: number;
  sourceBytes: number;
  outputBytes: number;
  buildMs: number;
  codecs: string[];
  resolutions: string[];
  models: string[];
  warnings: string[];
  error?: string;
  boundariesRemuxed: number;
  seamTrimsRequested: number;
  seamTrimsApplied: number;
};

export type ContinuousPreviewMediaSpan = {
  journeyId: string;
  mediaStart: number;
  mediaEnd: number;
};

export type ContinuousPreviewBuild = {
  report: ContinuousPreviewReport;
  buffer: ArrayBuffer | null;
  spans: ContinuousPreviewMediaSpan[];
};

export function continuousPreviewClips(project: Project): ContinuousPreviewClip[] {
  return currentCutClips(project).map((clip, index) => {
    const journey = project.journeys.find((item) => item.id === clip.journeyId);
    const take = journey ? selectedTake(journey) : undefined;
    const drop = journey ? currentOutgoingStartDrop(project, journey) : undefined;
    return {
      journeyId: clip.journeyId,
      takeId: clip.takeId,
      url: clip.videoUrl,
      model: take?.model,
      durationSeconds: clip.durationSeconds,
      dropFirstFrame: index > 0 && drop?.dropped === true,
    };
  });
}

type OpenedClip = {
  clip: ContinuousPreviewClip;
  input: Input;
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  identity: VideoPacketIdentity;
  audioIdentity: AudioPacketIdentity | null;
  bytes: number;
  firstPacket: EncodedPacket;
  secondPacket: EncodedPacket | null;
};

function previewAborted(signal?: AbortSignal, error?: unknown): boolean {
  return signal?.aborted === true || (error instanceof DOMException && error.name === "AbortError");
}

async function openClip(clip: ContinuousPreviewClip, signal?: AbortSignal): Promise<OpenedClip> {
  const response = await fetch(clip.url, { signal });
  if (!response.ok) {
    throw new Error(`${clip.journeyId} could not be read (${response.status}).`);
  }
  const blob = await response.blob();
  const input = new Input({
    source: new BlobSource(blob),
    formats: ALL_FORMATS,
  });
  const video = await input.getPrimaryVideoTrack();
  if (!video) {
    input.dispose();
    throw new Error(`${clip.journeyId} has no video track.`);
  }
  const [codec, config, rotation, audio] = await Promise.all([
    video.getCodec(),
    video.getDecoderConfig(),
    video.getRotation(),
    input.getPrimaryAudioTrack(),
  ]);
  if (!codec || !config?.codedWidth || !config.codedHeight) {
    input.dispose();
    throw new Error(`${clip.journeyId} has no readable video decoder configuration.`);
  }
  const sink = new EncodedPacketSink(video);
  const firstPacket = await sink.getFirstPacket();
  if (!firstPacket) {
    input.dispose();
    throw new Error(`${clip.journeyId} has no video packets.`);
  }
  if (firstPacket.type !== "key") {
    input.dispose();
    throw new Error(
      `Keyframe/GOP constraint. ${clip.journeyId} does not start on a keyframe, so the clips cannot be concatenated without decoding.`,
    );
  }
  const secondPacket = await sink.getNextPacket(firstPacket);
  let audioIdentity: AudioPacketIdentity | null = null;
  if (audio) {
    const [audioCodec, audioConfig, sampleRate, numberOfChannels] = await Promise.all([
      audio.getCodec(),
      audio.getDecoderConfig(),
      audio.getSampleRate(),
      audio.getNumberOfChannels(),
    ]);
    if (!audioCodec || !audioConfig) {
      input.dispose();
      throw new Error(`${clip.journeyId} has an audio track without a decoder configuration.`);
    }
    audioIdentity = {
      journeyId: clip.journeyId,
      codec: audioCodec,
      codecString: audioConfig.codec,
      sampleRate,
      numberOfChannels,
    };
  }
  return {
    clip,
    input,
    video,
    audio,
    identity: {
      journeyId: clip.journeyId,
      codec,
      codecString: config.codec,
      width: config.codedWidth,
      height: config.codedHeight,
      descriptionKey: descriptionKey(config.description),
      rotation,
    },
    audioIdentity,
    bytes: blob.size,
    firstPacket,
    secondPacket,
  };
}

async function writeVideoPackets(
  source: EncodedVideoPacketSource,
  sink: EncodedPacketSink,
  offset: number,
  skipFirst: boolean,
  decoderConfig: VideoDecoderConfig | null,
  signal?: AbortSignal,
): Promise<number> {
  let skipped = false;
  let base: number | null = null;
  let end = offset;
  for await (const packet of sink.packets()) {
    if (previewAborted(signal)) {
      throw new DOMException("The preview build was aborted.", "AbortError");
    }
    if (skipFirst && !skipped) {
      skipped = true;
      continue;
    }
    if (base === null) {
      base = packet.timestamp;
    }
    const shifted = packet.clone({ timestamp: packet.timestamp - base + offset });
    await source.add(shifted, decoderConfig ? { decoderConfig } : undefined);
    decoderConfig = null;
    end = Math.max(end, shifted.timestamp + shifted.duration);
  }
  return end;
}

/**
 * Where the next clip may start. AAC packets are key packets, so each one must
 * land at or after the previous packet's timestamp. Encoder delay often makes
 * the audio timestamp run past the last video frame.
 */
export function continuousPreviewCursor(videoEnd: number, audioMaxTimestamp: number | null): number {
  if (audioMaxTimestamp == null || !Number.isFinite(audioMaxTimestamp)) {
    return videoEnd;
  }
  return Math.max(videoEnd, audioMaxTimestamp);
}

async function writeAudioPackets(
  source: EncodedAudioPacketSource,
  sink: EncodedPacketSink,
  offset: number,
  decoderConfig: AudioDecoderConfig | null,
): Promise<number> {
  let base: number | null = null;
  let maxTimestamp = offset;
  for await (const packet of sink.packets()) {
    if (base === null) {
      base = packet.timestamp;
    }
    const shifted = packet.clone({ timestamp: packet.timestamp - base + offset });
    await source.add(shifted, decoderConfig ? { decoderConfig } : undefined);
    decoderConfig = null;
    maxTimestamp = Math.max(maxTimestamp, shifted.timestamp);
  }
  return maxTimestamp;
}

/**
 * Demux the selected takes, shift packet timestamps, and mux one MP4.
 * Never decodes or re-encodes. Incompatible clips return a report and no buffer.
 */
export async function buildContinuousPreview(
  clips: readonly ContinuousPreviewClip[],
  signal?: AbortSignal,
): Promise<ContinuousPreviewBuild> {
  const started = performance.now();
  const warnings: string[] = [];
  const opened: OpenedClip[] = [];
  const empty = (error: string, partial?: Partial<ContinuousPreviewReport>): ContinuousPreviewBuild => ({
    buffer: null,
    spans: [],
    report: {
      ok: false,
      remuxOnly: false,
      clipCount: clips.length,
      sourceDurationSeconds: clips.reduce((sum, clip) => sum + clip.durationSeconds, 0),
      outputDurationSeconds: 0,
      sourceBytes: opened.reduce((sum, clip) => sum + clip.bytes, 0),
      outputBytes: 0,
      buildMs: performance.now() - started,
      codecs: [...new Set(opened.map((clip) => clip.identity.codecString || clip.identity.codec))],
      resolutions: [...new Set(opened.map((clip) => `${clip.identity.width}×${clip.identity.height}`))],
      models: [...new Set(clips.map((clip) => clip.model).filter((model): model is string => Boolean(model)))],
      warnings,
      error,
      boundariesRemuxed: 0,
      seamTrimsRequested: clips.filter((clip) => clip.dropFirstFrame).length,
      seamTrimsApplied: 0,
      ...partial,
    },
  });

  if (clips.length === 0) {
    return empty("No selected traversal takes to assemble.");
  }

  try {
    for (const clip of clips) {
      if (previewAborted(signal)) {
        throw new DOMException("The preview build was aborted.", "AbortError");
      }
      opened.push(await openClip(clip, signal));
    }
  } catch (error) {
    for (const clip of opened) {
      if (!clip.input.disposed) {
        clip.input.dispose();
      }
    }
    if (previewAborted(signal, error)) {
      throw error;
    }
    return empty(error instanceof Error ? error.message : "MediaBunny could not read a selected take.");
  }

  const videoCheck = videoIdentitiesCompatible(opened.map((clip) => clip.identity));
  if (!videoCheck.ok) {
    for (const clip of opened) {
      clip.input.dispose();
    }
    return empty(videoCheck.reason);
  }

  const audioClips = opened.flatMap((clip) => (clip.audioIdentity ? [clip.audioIdentity] : []));
  const includeAudio = audioClips.length === opened.length;
  if (audioClips.length > 0 && audioClips.length < opened.length) {
    warnings.push("Audio was omitted. Some selected takes have an audio track and some do not.");
  } else if (includeAudio) {
    const audioCheck = audioIdentitiesCompatible(audioClips);
    if (!audioCheck.ok) {
      warnings.push(`${audioCheck.reason} Audio was omitted. Video was still remuxed.`);
    }
  }
  const audioOk = includeAudio && audioIdentitiesCompatible(audioClips).ok;

  const skipFirst: boolean[] = [];
  let seamTrimsApplied = 0;
  for (const clip of opened) {
    if (!clip.clip.dropFirstFrame) {
      skipFirst.push(false);
      continue;
    }
    const decision = seamTrimPacketDecision(clip.firstPacket.type, clip.secondPacket?.type ?? null);
    if (decision.apply) {
      skipFirst.push(true);
      seamTrimsApplied += 1;
    } else {
      skipFirst.push(false);
      if (decision.warning) {
        warnings.push(`${clip.clip.journeyId}: ${decision.warning}`);
      }
    }
  }

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target,
  });
  const videoCodec = opened[0]!.identity.codec as VideoCodec;
  const videoSource = new EncodedVideoPacketSource(videoCodec);
  const firstConfig = await opened[0]!.video.getDecoderConfig();
  output.addVideoTrack(videoSource, firstConfig ? { decoderConfig: firstConfig } : undefined);
  let audioSource: EncodedAudioPacketSource | null = null;
  let audioConfig: AudioDecoderConfig | null = null;
  if (audioOk && opened[0]?.audio) {
    audioConfig = await opened[0].audio.getDecoderConfig();
    const audioCodec = opened[0].audioIdentity?.codec as AudioCodec | undefined;
    if (audioCodec && audioConfig) {
      audioSource = new EncodedAudioPacketSource(audioCodec);
      output.addAudioTrack(audioSource, { decoderConfig: audioConfig });
    }
  }

  try {
    await output.start();
    let offset = 0;
    const spans: ContinuousPreviewMediaSpan[] = [];
    for (let index = 0; index < opened.length; index += 1) {
      const clip = opened[index]!;
      const mediaStart = offset;
      const videoEnd = await writeVideoPackets(
        videoSource,
        new EncodedPacketSink(clip.video),
        offset,
        skipFirst[index] === true,
        index === 0 ? firstConfig : null,
        signal,
      );
      let audioMaxTimestamp: number | null = null;
      if (audioSource && clip.audio && audioConfig) {
        audioMaxTimestamp = await writeAudioPackets(
          audioSource,
          new EncodedPacketSink(clip.audio),
          offset,
          index === 0 ? audioConfig : null,
        );
      }
      offset = continuousPreviewCursor(videoEnd, audioMaxTimestamp);
      spans.push({ journeyId: clip.clip.journeyId, mediaStart, mediaEnd: offset });
      clip.input.dispose();
    }
    videoSource.close();
    audioSource?.close();
    await output.finalize();
    const buffer = target.buffer;
    if (!buffer) {
      return empty("MediaBunny finalized without an output buffer.", {
        seamTrimsApplied,
        warnings,
      });
    }
    return {
      buffer,
      spans,
      report: {
        ok: true,
        remuxOnly: true,
        clipCount: clips.length,
        sourceDurationSeconds: clips.reduce((sum, clip) => sum + clip.durationSeconds, 0),
        outputDurationSeconds: offset,
        sourceBytes: opened.reduce((sum, clip) => sum + clip.bytes, 0),
        outputBytes: buffer.byteLength,
        buildMs: performance.now() - started,
        codecs: [...new Set(opened.map((clip) => clip.identity.codecString || clip.identity.codec))],
        resolutions: [...new Set(opened.map((clip) => `${clip.identity.width}×${clip.identity.height}`))],
        models: [...new Set(clips.map((clip) => clip.model).filter((model): model is string => Boolean(model)))],
        warnings,
        boundariesRemuxed: Math.max(0, clips.length - 1),
        seamTrimsRequested: clips.filter((clip) => clip.dropFirstFrame).length,
        seamTrimsApplied,
      },
    };
  } catch (error) {
    if (output.state !== "finalized" && output.state !== "canceled") {
      await output.cancel().catch(() => undefined);
    }
    for (const clip of opened) {
      if (!clip.input.disposed) {
        clip.input.dispose();
      }
    }
    if (previewAborted(signal, error)) {
      throw error;
    }
    return empty(error instanceof Error ? error.message : "MediaBunny remux failed.");
  }
}
