import { createWriteStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { parseArgs } from "node:util";

import selectAll, { selectOne } from "css-select";
import type { ChildNode } from "domhandler";
import mime from "mime-types";
import { parse } from "parse5";
import { adapter } from "parse5-htmlparser2-tree-adapter";
import { z } from "zod";

import { pathImages, pathManifest } from "./base.ts";
import { assertRequiredArgs } from "./infer/utility.ts";
import { stringToNumber } from "./type/index.ts";

import type { Manifest, ManifestStructured } from "./type/manifest.ts";

const args = parseArgs({
  options: {
    "output-directory": {
      type: "string",
    },
    "empty-output-directory": {
      type: "boolean",
      default: false,
    },
  },
});

assertRequiredArgs(args, ["output-directory"]);

const RED = "\u001b[0;31m";
const GREEN = "\u001b[0;32m";

const RESET = "\u001b[0m";

const {
  values: { "output-directory": outputDirectory, "empty-output-directory": emptyOutputDirectory },
} = args;

if (emptyOutputDirectory) {
  await rm(outputDirectory, { recursive: true, force: true });
}

await mkdir(outputDirectory, { recursive: true });

const extractText = (node: ChildNode): string => {
  let buffered: string = "";

  if (adapter.isTextNode(node)) {
    return `${node.data}`;
  } else if (adapter.isElementNode(node)) {
    for (const child of node.childNodes) {
      if (adapter.isElementNode(child) && child.tagName === "br") {
        buffered += "\n";
      } else {
        buffered += extractText(child);
      }
    }
  }

  return buffered;
};

const directoryName = (url: URL) => `${url}`.replace("https://www.", "");

let continueReason;
for await (const line of createInterface({ input: process.stdin })) {
  process.stdout.write(`[*] ${line}`);

  try {
    continueReason = "unspecified";

    let url: URL;
    try {
      url = new URL(line);
    } catch (e) {
      console.warn(`invalid url <${line}>`);
      console.error(e);
      continue;
    }

    switch (url.hostname) {
      case "www.willhaben.at": {
        const result = await fetch(url, { method: "GET" });
        if (result.redirected) {
          console.warn(`posting <${url}> not available anymore`);
          continue;
        }

        const html = await result.text();

        const document = parse(html, { treeAdapter: adapter });

        let description = "";
        {
          const found = selectAll('[data-testid^="ad-description-"]', document.childNodes);

          if (found.length === 0) {
            console.error(`missing description on <${url}>`);
            process.exit(1);
          }

          for (const node of found) {
            description += extractText(node);
          }
        }

        let traits: Record<string, string | true>;
        {
          const all: Map<string, string | true> = new Map();

          const found = selectAll('[data-testid="attribute-item"]', document.childNodes);
          for (const node of found) {
            const title = selectOne('[data-testid="attribute-title"]', node);
            if (title === null) {
              console.error(`expected title in attribute item on <${url}>`);
              process.exit(1);
            }

            const value = selectOne('[data-testid="attribute-value"]', node);
            if (value === null) {
              console.error(`expected value in attribute item on <${url}>`);
              process.exit(1);
            }

            const trimmedValue = extractText(value).trim();

            all.set(extractText(title).trim(), trimmedValue.length === 0 ? true : trimmedValue);
          }

          traits = Object.fromEntries(all.entries());
        }

        let structured: ManifestStructured;
        {
          const found = selectOne('script[type="application/ld+json"]', document);
          if (found === null) {
            console.error(`missing metadata on <${url}>`);
            process.exit(1);
          }

          const content = found.children[0];
          if (!adapter.isTextNode(content)) {
            console.error(`expected text node as first child of metadata on <${url}>`);
            process.exit(1);
          }

          const lines = content.data.trim().split("\n");
          if (lines.length !== 1) {
            console.error(
              `only expected one line in first child text node of metadata on <${url}>`,
            );
            process.exit(1);
          }

          const parsed = JSON.parse(lines[0]);

          const Codec = z.object({
            "@type": z.literal("Product"),
            name: z.string(),
            offers: z.object({
              "@type": z.literal("Offer"),
              price: stringToNumber,
              priceCurrency: z.literal("EUR"),
              itemCondition: z.enum([
                "NewCondition",
                "RefurbishedCondition",
                "UsedCondition",
                "DamagedCondition",
              ]),
              availableAtOrFrom: z.object({
                "@type": z.literal("Accommodation"),
                numberOfRooms: z.optional(
                  z.object({
                    "@type": z.literal("QuantitativeValue"),
                    value: z.optional(stringToNumber),
                  }),
                ),
                floorSize: z.object({
                  "@type": z.literal("QuantitativeValue"),
                  value: z.optional(stringToNumber),
                }),
                floorLevel: z.optional(z.string()),
                address: z.object({
                  "@type": z.literal("PostalAddress"),
                  postalCode: z.string(),
                  streetAddress: z.string(),
                }),
                geo: z.optional(
                  z.object({
                    "@type": z.literal("GeoCoordinates"),
                    latitude: z.optional(z.number()),
                    longitude: z.optional(z.number()),
                  }),
                ),
              }),
            }),
          });

          const decoded = Codec.safeParse(parsed);
          if (!decoded.success) {
            console.error(`malformed metadata on <${url}>`);
            console.error(decoded.error);
            console.dir(parsed, { depth: null });
            process.exit(1);
          }

          let condition;
          switch (decoded.data.offers.itemCondition) {
            case "NewCondition":
              condition = "new" as const;
              break;
            case "RefurbishedCondition":
              condition = "renovated" as const;
              break;
            case "UsedCondition":
              condition = "used" as const;
              break;
            case "DamagedCondition":
              condition = "damaged" as const;
              break;
          }

          structured = {
            url: String(url),
            name: decoded.data.name,
            district: decoded.data.offers.availableAtOrFrom.address.postalCode,
            address: decoded.data.offers.availableAtOrFrom.address.streetAddress,
            area: decoded.data.offers.availableAtOrFrom.floorSize.value,
            rooms: decoded.data.offers.availableAtOrFrom.numberOfRooms?.value,
            price: decoded.data.offers.price,
            floor: decoded.data.offers.availableAtOrFrom.floorLevel,
            condition,
            ...(typeof decoded.data.offers.availableAtOrFrom.geo !== "undefined" &&
            typeof decoded.data.offers.availableAtOrFrom.geo.longitude !== "undefined" &&
            typeof decoded.data.offers.availableAtOrFrom.geo.latitude !== "undefined"
              ? {
                  coordinates: {
                    approximate: {
                      longitude: decoded.data.offers.availableAtOrFrom.geo.longitude,
                      latitude: decoded.data.offers.availableAtOrFrom.geo.latitude,
                    },
                  },
                }
              : {}),
          };
        }

        const images: string[] = [];
        {
          const found = selectAll(
            '[data-testid^="carousel-cell-image-"] > button > img',
            document.childNodes,
          );
          if (found.length === 0) {
            console.error(`missing images on <${url}>`);
            process.exit(1);
          }
          for (const element of found) {
            if (!adapter.isElementNode(element) || adapter.getTagName(element) !== "img") {
              console.error(`expected element node as childen of carousel on <${url}>`);
              process.exit(1);
            }
            const image = element.attribs["data-flickity-lazyload"] ?? element.attribs.src;
            if (typeof image === "undefined") {
              console.error(`missing url for carousel image on <${image}>`);
              process.exit(1);
            }

            images.push(image);
          }
        }

        const path = join(outputDirectory, directoryName(url));
        const imagePath = pathImages(path);

        await mkdir(path, { recursive: true });
        await mkdir(imagePath, { recursive: true });

        for (const [idx, image] of images.entries()) {
          const extension = image.slice(image.lastIndexOf(".") + 1);

          const result = await fetch(image, { method: "GET" });
          if (result.body === null) {
            console.warn(`could not download image <${image}> of <${url}>`);
            continue;
          }

          await pipeline(
            Readable.fromWeb(result.body),
            createWriteStream(join(imagePath, `${idx}.${extension}`)),
          );
        }

        const manifest: Manifest = {
          structured,
          description,
          traits,
        };

        await writeFile(pathManifest(path), JSON.stringify(manifest, null, 4));

        break;
      }
      case "www.immobilienscout24.at": {
        {
          const result = await fetch(url, {
            method: "GET",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0",
            },
          });
          if (result.redirected) {
            console.warn(`posting <${url}> not available anymore`);
            continue;
          }

          const html = await result.text();

          const document = parse(html, { treeAdapter: adapter });

          // skip multi-listings
          {
            const found = selectOne('[data-testid="ItemList-structured-data"]', document);
            if (found !== null) {
              continue;
            }
          }

          let extracted;
          {
            const found = selectAll("script", document);
            if (found.length === 0) {
              console.error(`no scripts on <${url}>`);
              process.exit(1);
            }

            for (const script of found) {
              const content = script.children.at(0);
              if (typeof content === "undefined") {
                continue;
              }

              if (!adapter.isTextNode(content)) {
                console.error(`expected text node as first child of script on <${url}>`);
                process.exit(1);
              }

              const match = content.data.match(/window\.__APOLLO_STATE__=(?<state>{.+})/);

              const state = match?.groups?.state;
              if (typeof state === "undefined") {
                continue;
              }

              const parsed = JSON.parse(state);
              let exposeKey;
              for (const key of Object.keys(parsed)) {
                if (!key.startsWith("Expose:")) {
                  continue;
                }

                exposeKey = key;
                break;
              }

              if (typeof exposeKey === "undefined") {
                console.error(`missing expose key in state script on <${url}>`);
                process.exit(1);
              }

              const data = parsed[exposeKey];

              const Codec = z.object({
                description: z.object({
                  __typename: z.literal("Description"),
                  descriptionNote: z.union([z.string(), z.null()]),
                  title: z.string(),
                }),
                characteristics: z.array(
                  z.object({
                    __typename: z.literal("Characteristic"),
                    key: z.string(),
                    type: z.string(),
                    items: z.array(
                      z.object({
                        __typename: z.literal("CloudGroup"),
                        key: z.string(),
                        text: z.string(),
                      }),
                    ),
                  }),
                ),
                condition: z.object({
                  __typename: z.literal("Condition"),
                  type: z.union([z.string(), z.null()]),
                }),
                localization: z.object({
                  __typename: z.literal("Localization"),
                  address: z.object({
                    __typename: z.literal("Address"),
                    zip: z.string(),
                  }),
                }),
                priceInformation: z.object({
                  __typename: z.literal("PriceInformation"),
                  primaryPrice: z.number(),
                }),
                addressString: z.string(),
                pictures: z.array(
                  z.object({
                    __typename: z.literal("Picture"),
                    url: z.string(),
                  }),
                ),
                area: z.object({
                  __typename: z.literal("Area"),
                  primaryArea: z.union([z.number(), z.null()]),
                  numberOfRooms: z.union([z.number(), z.null()]),
                }),
              });

              extracted = Codec.safeDecode(data);

              break;
            }
          }

          if (typeof extracted === "undefined") {
            console.error(`missing state script on <${url}>`);
            process.exit(1);
          }

          if (!extracted.success) {
            console.error(`decoding error on <${url}>`);
            console.error(extracted.error);
            process.exit(1);
          }

          // never set for multi-listings → skip
          if (extracted?.data?.area.primaryArea === null) {
            continueReason = "is multi-listing";
            continue;
          }

          if (extracted?.data?.description.descriptionNote === null) {
            continueReason = "has no description";
            continue;
          }

          const path = join(outputDirectory, directoryName(url));
          const imagePath = pathImages(path);

          await mkdir(path, { recursive: true });
          await mkdir(imagePath, { recursive: true });

          for (const [idx, image] of extracted.data.pictures.entries()) {
            const result = await fetch(image.url, { method: "GET" });
            if (result.body === null) {
              console.warn(`could not download image <${image}> of <${url}>`);
              continue;
            }

            const mimeType = result.headers.get("content-type");
            if (mimeType === null) {
              console.warn(`no content type for <${url}>`);
              continue;
            }

            const extension = mime.extension(mimeType);

            await pipeline(
              Readable.fromWeb(result.body),
              createWriteStream(join(imagePath, `${idx}.${extension}`)),
            );
          }

          let condition: ManifestStructured["condition"];
          switch (extracted.data.condition.type) {
            case "NEED_OF_RENOVATION":
              condition = "damaged";
              break;
            case "WELL_KEPT":
              condition = "used";
              break;
            case "MODERNIZED":
            case "REFURBISHED":
              condition = "renovated";
              break;
            case "FIRST_TIME_USE":
              condition = "new";
              break;
          }

          const description = parse(extracted.data.description.descriptionNote, {
            treeAdapter: adapter,
          });

          const structured: ManifestStructured = {
            url: String(url),
            name: extracted.data.description.title,
            price: extracted.data.priceInformation.primaryPrice,
            rooms: extracted.data.area.numberOfRooms ?? undefined,
            area: extracted.data.area.primaryArea,
            address: extracted.data.addressString,
            district: extracted.data.localization.address.zip,
            condition,
          };

          const manifest: Manifest = {
            structured,
            description:
              description.firstChild === null
                ? extracted.data.description.descriptionNote
                : extractText(description.firstChild),
            traits:
              Object.fromEntries(
                extracted.data.characteristics.flatMap((outer) =>
                  outer.items.flatMap((inner) => [[inner.key, inner.text]]),
                ),
              ) ?? {},
          };

          await writeFile(pathManifest(path), JSON.stringify(manifest, null, 4));

          break;
        }
      }
    }

    continueReason = undefined;
  } finally {
    process.stdout.write(
      `\r[${typeof continueReason !== "undefined" ? `${RED}!` : `${GREEN}✓`}${RESET}] ${line}${typeof continueReason !== "undefined" ? ` (${continueReason})` : ""}\n`,
    );
  }
}
