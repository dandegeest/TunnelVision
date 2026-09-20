import assert from "node:assert/strict";
import { test } from "node:test";

import { extractOutputUrl, extractPredictionOutputUrl } from "../src/replicate/output.ts";

test("extracts a URL from a FileOutput object or an array of them", () => {
  assert.equal(extractOutputUrl("https://replicate.delivery/out.png"), "https://replicate.delivery/out.png");
  assert.equal(
    extractOutputUrl([{ href: "https://replicate.delivery/file.png" }]),
    "https://replicate.delivery/file.png",
  );
  assert.equal(
    extractOutputUrl({ url: () => "https://replicate.delivery/method.png" }),
    "https://replicate.delivery/method.png",
  );
  assert.equal(
    extractOutputUrl({ video: "https://replicate.delivery/kling3.mp4" }),
    "https://replicate.delivery/kling3.mp4",
  );
});

test("uses urls.stream when a succeeded prediction has a null output", () => {
  const stream = "https://stream.replicate.com/v1/files/jbxs-walonuadhqfa7suiapt6aablclidv2g44mf67pncq5mlc7d4lpuq";
  assert.equal(
    extractPredictionOutputUrl({
      output: null,
      urls: {
        stream,
        get: "https://api.replicate.com/v1/predictions/j30kned3snrmt0d0qwca6rept8",
        cancel: "https://api.replicate.com/v1/predictions/j30kned3snrmt0d0qwca6rept8/cancel",
        web: "https://replicate.com/p/j30kned3snrmt0d0qwca6rept8",
      },
    }),
    stream,
  );
});

test("prefers prediction.output over urls.stream", () => {
  assert.equal(
    extractPredictionOutputUrl({
      output: "https://replicate.delivery/out.mp4",
      urls: { stream: "https://stream.replicate.com/v1/files/other" },
    }),
    "https://replicate.delivery/out.mp4",
  );
});

test("does not treat prediction control URLs as media output", () => {
  assert.equal(
    extractPredictionOutputUrl({
      output: null,
      urls: {
        get: "https://api.replicate.com/v1/predictions/j30kned3snrmt0d0qwca6rept8",
        cancel: "https://api.replicate.com/v1/predictions/j30kned3snrmt0d0qwca6rept8/cancel",
        web: "https://replicate.com/p/j30kned3snrmt0d0qwca6rept8",
      },
    }),
    null,
  );
});
