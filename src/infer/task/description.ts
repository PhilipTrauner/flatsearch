import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { InferredDescription } from "../../type/inferred/description.ts";
import { Manifest } from "../../type/manifest.ts";
import { assertRequiredArgs, inferenceProvider, wantedProperties } from "../utility.ts";

const parsed = parseArgs({
  options: {
    "file-path-in-manifest": {
      type: "string",
    },
    "file-path-out-inferred-description": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, ["file-path-in-manifest", "file-path-out-inferred-description"]);

const {
  values: { "file-path-in-manifest": input },
  values: { "file-path-out-inferred-description": output },
} = parsed;

const provider = inferenceProvider();

const manifest = Manifest.parse(JSON.parse(await readFile(input, "utf-8")));

const response = await provider.infer(
  {
    prompt: `extract ${wantedProperties(InferredDescription).join(", ")} from text, exclude imprecise, exclude optional extras, only consider facts about the main unit when multiple units are mentioned\n\n${manifest.description}`,
  },
  InferredDescription,
);

await writeFile(output, JSON.stringify(response, null, 4));
