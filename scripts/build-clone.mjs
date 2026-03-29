import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_ORIGIN = "https://source.framer.media";

function absolutizeUrl(value) {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();

  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    /^[a-z]+:/i.test(trimmed) ||
    trimmed.startsWith("//")
  ) {
    return value;
  }

  return new URL(trimmed, `${SOURCE_ORIGIN}/`).toString();
}

function absolutizeSrcset(value) {
  return value
    .split(",")
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);

      if (!parts[0]) {
        return candidate;
      }

      parts[0] = absolutizeUrl(parts[0]);
      return parts.join(" ");
    })
    .join(", ");
}

function replaceAttribute(html, attributeName, replacer) {
  return html.replace(
    new RegExp(`\\b${attributeName}=(["'])([\\s\\S]*?)\\1`, "gi"),
    (_, quote, value) => `${attributeName}=${quote}${replacer(value)}${quote}`
  );
}

export function buildCloneHtml(sourceHtml) {
  let result = sourceHtml;

  for (const attribute of ["href", "src", "action", "poster"]) {
    result = replaceAttribute(result, attribute, absolutizeUrl);
  }

  result = replaceAttribute(result, "srcset", absolutizeSrcset);

  return result;
}

export async function writeCloneHtml(sourceHtml, outputPath) {
  await fs.writeFile(outputPath, buildCloneHtml(sourceHtml), "utf8");
}

async function main() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(currentDir, "..");
  const sourcePath = path.join(projectRoot, "source.html");
  const outputPath = path.join(projectRoot, "index.html");
  const sourceHtml = await fs.readFile(sourcePath, "utf8");

  await writeCloneHtml(sourceHtml, outputPath);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
