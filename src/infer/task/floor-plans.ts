import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { InferredFloorPlan, type InferredFloorPlans } from "../../type/inferred/floor-plans.ts";
import { InferredImages } from "../../type/inferred/images.ts";
import { assertRequiredArgs, inferenceProvider, wantedProperties } from "../utility.ts";

const parsed = parseArgs({
  options: {
    "file-path-in-inferred-images": {
      type: "string",
    },
    "file-path-out-inferred-floor-plans": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, ["file-path-in-inferred-images", "file-path-out-inferred-floor-plans"]);

const {
  values: { "file-path-in-inferred-images": input },
  values: { "file-path-out-inferred-floor-plans": output },
} = parsed;

const images = InferredImages.decode(JSON.parse(await readFile(input, "utf-8")));

const provider = inferenceProvider();

const floorPlans: InferredFloorPlans = {};
for (const path of images["floor-plan"]) {
  const data = await readFile(join(dirname(input), "image", path));
  const decoded = await provider.infer(
    {
      prompt: `extract ${wantedProperties(InferredFloorPlan).join(", ")} from image, exclude imprecise, exclude not determinable`,
      images: [data],
    },
    InferredFloorPlan,
  );

  floorPlans[path] = decoded;
}

await writeFile(output, JSON.stringify(floorPlans, null, 4));
