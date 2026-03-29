import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { buildCloneHtml, writeCloneHtml } from "../scripts/build-clone.mjs";

test("buildCloneHtml preserves source content and rewrites relative routes to the live source origin", async () => {
  const sourceHtml = await fs.readFile(new URL("../source.html", import.meta.url), "utf8");

  const result = buildCloneHtml(sourceHtml);

  assert.match(result, /<title>Source・AI Consutling &amp; Automations for Modern Teams<\/title>/);
  assert.match(result, /Source joins the OpenAI Services Partner Program/);
  assert.match(result, /href="https:\/\/source\.framer\.media\/contact"/);
  assert.match(result, /href="https:\/\/source\.framer\.media\/about"/);
  assert.match(result, /src="https:\/\/framerusercontent\.com\//);
  assert.doesNotMatch(result, /href="\.\//);
});

test("writeCloneHtml writes the cloned homepage to the requested output path", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "website-clone-"));
  const outputPath = path.join(tempDir, "index.html");
  const sourceHtml = await fs.readFile(new URL("../source.html", import.meta.url), "utf8");

  await writeCloneHtml(sourceHtml, outputPath);

  const writtenHtml = await fs.readFile(outputPath, "utf8");
  assert.match(writtenHtml, /<title>Source・AI Consutling &amp; Automations for Modern Teams<\/title>/);
  assert.match(writtenHtml, /https:\/\/source\.framer\.media\/contact/);
});
