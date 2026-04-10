import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { InferredAddress } from "../../type/inferred/address.ts";
import { InferredImages } from "../../type/inferred/images.ts";
import { assertRequiredArgs, inferenceProvider } from "../utility.ts";

import type { InferredLocation } from "../../type/inferred/location.ts";

const parsed = parseArgs({
  options: {
    "file-path-in-inferred-address": {
      type: "string",
    },
    "file-path-in-inferred-images": {
      type: "string",
    },

    "file-path-out-inferred-location": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, [
  "file-path-in-inferred-address",
  "file-path-in-inferred-images",
  "file-path-out-inferred-location",
]);

const {
  values: { "file-path-in-inferred-address": inputInferredAddress },
  values: { "file-path-in-inferred-images": inputInferredImages },
  values: { "file-path-out-inferred-location": output },
} = parsed;

const provider = inferenceProvider();

const inferredAddress = InferredAddress.decode(
  JSON.parse(await readFile(inputInferredAddress, "utf-8")),
);

const inferredImages = InferredImages.decode(
  JSON.parse(await readFile(inputInferredImages, "utf-8")),
);

const near =
  inferredAddress.house.at(0) ?? inferredAddress.street.at(0) ?? inferredAddress.unknown.at(0);

let guessed: string | null = null;
if (inferredImages.housefront.length === 0 && typeof near !== "undefined") {
  const result = await provider.infer(
    {
      prompt: `address of picture near ${near}`,
      images: await Promise.all(
        inferredImages.housefront
          .slice(0, 8)
          .map((image) => readFile(join(dirname(inputInferredImages), "image", image))),
      ),
    },
    z.object({
      address: z.union([z.string(), z.null()]),
    }),
  );

  guessed = result.address;
}

const inferredLocation: InferredLocation = {
  guessed,
};
await writeFile(output, JSON.stringify(inferredLocation, null, 4));
