import { z } from "zod";

const InferredImageType = z.literal(["housefront", "floor-plan", "interior", "other"]);

export const InferredImage = z.object({
  type: InferredImageType,
});
export type InferredImage = z.infer<typeof InferredImage>;

export const InferredImages = z.record(InferredImageType, z.array(z.string()));
export type InferredImages = z.infer<typeof InferredImages>;
