import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { z } from "zod";

import { InferredAdressPrecision } from "../../type/inferred/address.ts";
import { InferredDescription } from "../../type/inferred/description.ts";
import { InferredFloorPlans } from "../../type/inferred/floor-plans.ts";
import { Manifest } from "../../type/manifest.ts";
import { assertRequiredArgs, inferenceProvider } from "../utility.ts";

const parsed = parseArgs({
  options: {
    "file-path-in-manifest": {
      type: "string",
    },
    "file-path-in-inferred-description": {
      type: "string",
    },
    "file-path-in-inferred-traits": {
      type: "string",
    },
    "file-path-in-inferred-floor-plans": {
      type: "string",
    },
    "file-path-out-inferred-address": {
      type: "string",
    },
  },
});
assertRequiredArgs(parsed, [
  "file-path-in-manifest",
  "file-path-in-inferred-description",
  "file-path-in-inferred-traits",
  "file-path-in-inferred-floor-plans",
  "file-path-out-inferred-address",
]);

const maybeAppendDistrict = (address: string, district: string) =>
  address.includes(district) || address.includes("Bezirk")
    ? address
    : `${address} ${district} Wien, Österreich`;

const {
  values: { "file-path-in-manifest": inputManifest },
  values: { "file-path-in-inferred-description": inputInferredDescription },
  values: { "file-path-in-inferred-floor-plans": inputInferredFloorPlans },
  values: { "file-path-out-inferred-address": output },
} = parsed;

const provider = inferenceProvider();

const manifest = Manifest.decode(JSON.parse(await readFile(inputManifest, "utf-8")));

const inferredDescription = InferredDescription.decode(
  JSON.parse(await readFile(inputInferredDescription, "utf-8")),
);

const inferredFloorPlans = InferredFloorPlans.decode(
  JSON.parse(await readFile(inputInferredFloorPlans, "utf-8")),
);

const candidates = [
  typeof manifest.structured.address !== "undefined"
    ? maybeAppendDistrict(manifest.structured.address, manifest.structured.district)
    : undefined,
  typeof inferredDescription?.address === "string"
    ? maybeAppendDistrict(inferredDescription.address, manifest.structured.district)
    : undefined,
  ...(typeof inferredFloorPlans !== "undefined"
    ? Object.values(inferredFloorPlans).map((floorPlan) =>
        typeof floorPlan?.address === "string"
          ? maybeAppendDistrict(floorPlan.address, manifest.structured.district)
          : undefined,
      )
    : []),
].flatMap((candidate) => (typeof candidate === "string" ? [candidate] : []));

const inferred: Record<InferredAdressPrecision, string[]> = {
  house: [],
  street: [],
  unknown: [],
};
for (const candidate of candidates) {
  const result = await provider.infer(
    {
      prompt: `how precise is address?
address is always in vienna, austria and does not need to include the city name

precision "house" must include a numerical house number and the name of a street that actually exists
a postal code (e.g. "1020") is not a house number (e.g. <street>, <postal-code>)

precision "street" must include the name of a street that actually exists
a numbered district alone (e.g. "2. Wiener Gemeindebezirk", "02. Bezirk, Leopoldstadt", "Wien, 02. Bezirk, Leopoldstadt") is not a street address

"unknown" is everything that doesn't meet those criteria
an approximate location (e.g. "nahe dem Wiener Prater und dem Viertel 2, Wien 1020 Wien, Österreich") should be classified as "unknown"
a district name, postal code, and city name alone (e.g. "Leopoldstadt, 1020 Wien, Austria") should be classified as "unknown"
a postal code, and city name alone (e.g. "1020 Wien") should be classified as "unknown"


${candidate}`,
    },
    z.object({
      precision: InferredAdressPrecision,
    }),
  );

  inferred[result.precision].push(candidate);
}

await writeFile(output, JSON.stringify(inferred, null, 4));
