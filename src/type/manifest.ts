import { z } from "zod";

export const ManifestStructured = z.object({
  url: z.string(),
  name: z.string(),
  district: z.string(),
  address: z.optional(z.string()),
  coordinates: z.optional(
    z.object({
      approximate: z.optional(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
      ),
      precise: z.optional(
        z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
      ),
    }),
  ),
  area: z.optional(z.number()),
  rooms: z.optional(z.number()),
  floor: z.optional(z.string()),
  price: z.optional(z.number()),
  monthlyCost: z.optional(z.number()),
  condition: z.optional(z.enum(["new", "renovated", "used", "damaged"])),
  elevator: z.optional(z.boolean()),
  storageRoom: z.optional(z.boolean()),
  heating: z.optional(z.string()),
  airConditioning: z.optional(z.boolean()),
  highCeilings: z.optional(z.boolean()),
  facing: z.optional(z.enum(["street", "courtyard"])),
  flooring: z.optional(z.string()),
  balcony: z.optional(z.boolean()),
  rented: z.optional(z.boolean()),
});
export type ManifestStructured = z.infer<typeof ManifestStructured>;

export const Manifest = z.object({
  structured: ManifestStructured,
  description: z.string(),
  traits: z.record(z.string(), z.union([z.string(), z.boolean()])),
});
export type Manifest = z.infer<typeof Manifest>;
