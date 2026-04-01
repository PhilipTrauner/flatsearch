import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { z } from "zod";

import { InferredDescription } from "../../type/inferred/description.ts";
import { InferredFloorPlans } from "../../type/inferred/floor-plans.ts";
import { InferredImages } from "../../type/inferred/images.ts";
import { Manifest } from "../../type/manifest.ts";
import { assertRequiredArgs, inferenceProvider, wantedProperties } from "../utility.ts";

import type { InferredAddress } from "../../type/inferred/address.ts";

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
    "file-path-in-inferred-images": {
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
  "file-path-in-inferred-images",
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
  values: { "file-path-in-inferred-images": inputInferredImages },
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

const AdressPrecision = z.enum(["house", "street", "district"]);
type AdressPrecision = z.infer<typeof AdressPrecision>;

const addresses: Record<AdressPrecision, string[]> = {
  house: [],
  street: [],
  district: [],
};
for (const candidate of candidates) {
  const Codec = z.object({
    precision: AdressPrecision.meta({
      description:
        '"house" includes a house number, street address, and district\n"street" includes street address and district\n"district" only includes district',
    }),
  });

  const result = await provider.infer(
    {
      prompt: `how precise is address? ${wantedProperties(Codec).join(", ")}\n\n${candidate}`,
    },
    Codec,
  );

  addresses[result.precision].push(candidate);
}

let address: string | undefined = addresses.house.at(0);
if (typeof address === "undefined") {
  const inferredImages = InferredImages.decode(
    JSON.parse(await readFile(inputInferredImages, "utf-8")),
  );

  geoGuess: {
    if (inferredImages.housefront.length === 0) {
      break geoGuess;
    }

    const result = await provider.infer(
      {
        prompt: `find precise address of pictured house near ${addresses.street.at(0) ?? addresses.district.at(0) ?? candidates[0]}, assume no address when uncertain`,
        images: await Promise.all(
          inferredImages.housefront.map((image) =>
            readFile(join(dirname(inputInferredImages), "image", image)),
          ),
        ),
      },
      z.object({
        address: z.union([z.string(), z.null()]),
      }),
    );

    if (result.address !== null) {
      address = result.address;
    }
  }
}

const inferredAddress: InferredAddress = {
  address: address ?? null,
};
await writeFile(output, JSON.stringify(inferredAddress, null, 4));
