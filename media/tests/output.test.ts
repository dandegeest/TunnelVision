import assert from "node:assert/strict";
import { test } from "node:test";

import { extractOutputUrl } from "../src/replicate/output.ts";

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
});
