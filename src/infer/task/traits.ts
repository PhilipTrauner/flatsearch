import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { InferredTraits } from "../../type/inferred/traits.ts";
import { Manifest } from "../../type/manifest.ts";
import { assertRequiredArgs, inferenceProvider, wantedProperties } from "../utility.ts";

const parsed = parseArgs({
  options: {
    "file-path-in-manifest": {
      type: "string",
    },
    "file-path-out-inferred-traits": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, ["file-path-in-manifest", "file-path-out-inferred-traits"]);

const {
  values: { "file-path-in-manifest": input },
  values: { "file-path-out-inferred-traits": output },
} = parsed;

const provider = inferenceProvider();

const manifest = Manifest.parse(JSON.parse(await readFile(input, "utf-8")));

const response = await provider.infer(
  {
    prompt: `extract ${wantedProperties(InferredTraits).join(", ")} from text, exclude impercise, exclude ranges\n\n${Object.entries(
      manifest.traits,
    )
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n")}`,
  },
  InferredTraits,
);

await writeFile(output, JSON.stringify(response, null, 4));
