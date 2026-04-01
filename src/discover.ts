import { parseArgs } from "node:util";

import { selectOne } from "css-select";
import { parse } from "parse5";
import { adapter } from "parse5-htmlparser2-tree-adapter";
import { z } from "zod/mini";

const sites = ["willhaben", "immobilienscout24"] as const;
type Site = (typeof sites)[number];
const districts = ["1020", "1030", "1080", "1090", "1180"] as const;
type District = (typeof districts)[number];

const {
  values: { site: argSites, district: argDistricts, price: argPrice, area: argArea },
} = parseArgs({
  options: {
    site: {
      type: "string",
      multiple: true,
      default: sites as unknown as string[],
    },
    district: {
      type: "string",
      multiple: true,
      default: ["1020", "1030"],
    },
    price: {
      type: "string",
      default: "360000",
    },
    area: {
      type: "string",
      default: "60",
    },
  },
});

const isSite = (arg: string): arg is Site => (sites as readonly string[]).includes(arg);
const isDistrict = (arg: string): arg is District => (districts as readonly string[]).includes(arg);

let price: number;
{
  const parsed = Number.parseFloat(argPrice);
  if (Number.isNaN(parsed)) {
    console.error(`invalid price <${argPrice}>`);
    process.exit(1);
  }

  price = parsed;
}

let area: number;
{
  const parsed = Number.parseFloat(argArea);
  if (Number.isNaN(parsed)) {
    console.error(`invalid area <${argArea}>`);
    process.exit(1);
  }

  area = parsed;
}

const requestedSites: Set<Site> = new Set();
for (const site of argSites) {
  if (!isSite(site)) {
    console.error(`invalid site <${site}>`);
    process.exit(1);
  }
  requestedSites.add(site);
}

const requestedDistricts: Set<District> = new Set();
for (const district of argDistricts) {
  if (!isDistrict(district)) {
    console.error(`invalid district <${district}>`);
    process.exit(1);
  }
  requestedDistricts.add(district);
}

const siteWillhabenDistrict: Record<District, string> = {
  "1020": "117224",
  "1030": "117225",
  "1080": "117230",
  "1090": "117231",
  "1180": "117240",
};

const SiteImmobilienscout24Response = z.object({
  data: z.object({
    getDataByURL: z.object({
      results: z.object({
        pagination: z.object({
          nextURL: z.union([z.string(), z.null()]),
        }),
        hits: z.array(
          z.object({
            links: z.object({
              absoluteURL: z.string(),
            }),
          }),
        ),
      }),
    }),
  }),
});

const baseParameters: Record<Site, Record<string, string>> = {
  willhaben: {
    rows: "100",
    "ESTATE_SIZE/LIVING_AREA_FROM": String(area),
    PRICE_TO: String(price),
    isNavigation: "true",
  },
  immobilienscout24: {
    operationName: "getDataByURL",
    extensions: JSON.stringify({
      persistedQuery: {
        // this changes occasionally 😬
        sha256Hash: "74681add26c47c284094d1754f5a053d66f74e47edf8bd29cabac39be8bfad2a",
        version: 1,
      },
    }),
  },
};

const found: string[] = [];
for (const site of requestedSites) {
  for (const district of requestedDistricts) {
    switch (site) {
      case "willhaben": {
        let page = 1;
        while (true) {
          const parameters = {
            ...baseParameters[site],
            areaId: siteWillhabenDistrict[district],
            page: String(page),
          };

          const requesting = `https://www.willhaben.at/iad/immobilien/eigentumswohnung/eigentumswohnung-angebote?${new URLSearchParams(parameters).toString()}`;
          const result = await fetch(requesting, { method: "GET" });
          const html = await result.text();

          const document = parse(html, { treeAdapter: adapter });

          const toc = selectOne('script[type="application/ld+json"]', document);
          if (toc === null) {
            console.error(`missing table-of-content on <${requesting}>`);
            process.exit(1);
          }

          const content = toc.children[0];
          if (!adapter.isTextNode(content)) {
            console.error(
              `expected text node as first child of table-of-content on <${requesting}>`,
            );
            process.exit(1);
          }

          const lines = content.data.trim().split("\n");
          if (lines.length !== 1) {
            console.error(
              `only expected one line in first child text node of table-of-content on <${requesting}>`,
            );
            process.exit(1);
          }

          const parsed = JSON.parse(lines[0]);

          const Toc = z.object({
            "@type": z.literal("ItemList"),
            itemListElement: z.array(z.object({ "@type": z.literal("ListItem"), url: z.string() })),
          });

          const decoded = Toc.safeParse(parsed);
          if (!decoded.success) {
            console.error(`malformed table-of-content on <${requesting}>`);
            process.exit(1);
          }

          if (decoded.data.itemListElement.length === 0) {
            break;
          }

          for (const item of decoded.data.itemListElement) {
            // skip new building projects, as they are exclusively multi-listings
            if (item.url.startsWith("/iad/immobilien/d/neubauprojekt")) {
              continue;
            }

            found.push(`https://www.willhaben.at${item.url}`);
          }

          page += 1;
        }

        break;
      }
      case "immobilienscout24": {
        let url: string | null =
          `/regional/${district}/wohnung-kaufen?primaryAreaFrom=${area}&primaryPriceTo=${price}`;

        while (url !== null) {
          const parameters = {
            ...baseParameters[site],
            variables: JSON.stringify({
              params: {
                URL: url,
                // clamped
                size: 25,
              },
            }),
          };

          const requesting = `https://www.immobilienscout24.at/portal/graphql?${new URLSearchParams(parameters).toString()}`;

          const result = await fetch(requesting, {
            method: "GET",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:148.0) Gecko/20100101 Firefox/148.0",
            },
          });

          const parsed = await result.json();
          const decoded = SiteImmobilienscout24Response.parse(parsed);

          if (decoded.data.getDataByURL.results.pagination.nextURL !== null) {
            url = decoded.data.getDataByURL.results.pagination.nextURL;
          } else {
            url = null;
          }

          for (const hit of decoded.data.getDataByURL.results.hits) {
            found.push(hit.links.absoluteURL);
          }
        }
      }
    }
  }
}

for (const [idx, line] of found.entries()) {
  await new Promise((resolve) =>
    process.stdout.write(`${line}${idx !== found.length - 1 ? "\n" : ""}`, resolve),
  );
}
