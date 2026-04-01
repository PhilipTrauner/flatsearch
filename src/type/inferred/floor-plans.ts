import z from "zod";

export const InferredFloorPlan = z.object({
  address: z.union([z.string(), z.null()]).meta({ description: "precise postal address" }),
  floor: z.union([z.string(), z.null()]).meta({ description: "which floor it is on" }),
  balcony: z.union([z.boolean(), z.null()]).meta({
    description: "is there a balcony",
  }),
  bathtub: z.union([z.boolean(), z.null()]).meta({
    description: "is there a bathtub",
  }),
  bathroomBesideEntry: z
    .union([z.boolean(), z.null()])
    .meta({ description: "is bathroom beside entry doorway" }),
  toiletBesideEntryway: z
    .union([z.boolean(), z.null()])
    .meta({ description: "is toilet close to entryway" }),
  toiletInsideFlat: z.union([z.boolean(), z.null()]).meta({
    description: "is a toilet inside the flat",
  }),
  storageRoom: z.union([z.boolean(), z.null()]).meta({ description: "has a storage room" }),
});
export type InferredFloorPlan = z.infer<typeof InferredFloorPlan>;

export const InferredFloorPlans = z.record(z.string(), InferredFloorPlan);
export type InferredFloorPlans = z.infer<typeof InferredFloorPlans>;
