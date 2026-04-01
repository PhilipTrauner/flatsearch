import { glob, readFile, writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { parseArgs } from "node:util";

import { InferredImage, type InferredImages } from "../../type/inferred/images.ts";
import { assertRequiredArgs, inferenceProvider } from "../utility.ts";

const parsed = parseArgs({
  options: {
    "directory-path-in-images": {
      type: "string",
    },
    "file-path-out-inferred-images": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, ["directory-path-in-images", "file-path-out-inferred-images"]);

const {
  values: { "directory-path-in-images": input },
  values: { "file-path-out-inferred-images": output },
} = parsed;

const provider = inferenceProvider();

const paths: string[] = [];
for await (const image of glob(`${input}/*.{jpeg,jpg,png}`)) {
  paths.push(image);
}

const images: InferredImages = {
  housefront: [],
  "floor-plan": [],
  interior: [],
  other: [],
};
for (const path of paths) {
  const data = await readFile(path);
  const decoded = await provider.infer(
    {
      prompt: `is this a picture of a housefront, a floor plan, an interior shot, or other?`,
      images: [data],
    },
    InferredImage,
  );

  images[decoded.type].push(relative(input, path));
}

await writeFile(output, JSON.stringify(images, null, 4));
