import { z } from "zod";

export const InferredAddress = z.object({
  address: z.union([z.string(), z.null()]),
});
export type InferredAddress = z.infer<typeof InferredAddress>;
