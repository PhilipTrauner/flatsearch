import { z } from "zod";

export const InferredTraits = z.object({
  area: z.union([z.number(), z.null()]).meta({ description: "area in square meters" }),
  rooms: z.union([z.number(), z.null()]).meta({ description: "amount of rooms" }),
  floor: z.union([z.string(), z.null()]).meta({ description: "which floor it is on" }),
  price: z.union([z.number(), z.null()]).meta({ description: "purchase price" }),
  monthlyCost: z.union([z.number(), z.null()]).meta({ description: "monthly cost including tax" }),
  condition: z
    .union([z.enum(["new", "renovated", "used", "damaged"]), z.null()])
    .meta({ description: 'condition ("renovierungsbedürftig" means damaged)' }),
  elevator: z.union([z.boolean(), z.null()]).meta({ description: "is there an elevator" }),
  storageRoom: z.union([z.boolean(), z.null()]).meta({ description: "has a storage room" }),
  heating: z
    .union([z.enum(["central", "teleheating", "heat-pump", "gas", "hybrid"]), z.null()])
    .meta({
      description:
        'specific type of heating or central heating, "Etagenheizung” means central heating',
    }),
  airConditioning: z.union([z.boolean(), z.null()]).meta({ description: "is air conditioned" }),
  highCeilings: z
    .union([z.boolean(), z.null()])
    .meta({ description: "high ceilings are explicitly mentioned" }),
  facing: z
    .union([z.enum(["street", "courtyard"]), z.null()])
    .meta({ description: "street or courtyard facing" }),
  flooring: z.union([z.string(), z.null()]).meta({ description: "type of flooring" }),
  balcony: z.union([z.boolean(), z.null()]).meta({ description: "has a balcony" }),
  rented: z.union([z.boolean(), z.null()]).meta({ description: "already rented out" }),
});
export type InferredTraits = z.infer<typeof InferredTraits>;
