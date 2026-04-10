import { z } from "zod";

export const InferredLocation = z.object({
  guessed: z.union([z.string(), z.null()]),
});
export type InferredLocation = z.infer<typeof InferredLocation>;
