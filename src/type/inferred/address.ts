import { z } from "zod";

export const InferredAdressPrecision = z.enum(["house", "street", "unknown"]);
export type InferredAdressPrecision = z.infer<typeof InferredAdressPrecision>;

export const InferredAddress = z.record(InferredAdressPrecision, z.array(z.string()));
export type InferredAddress = z.infer<typeof InferredAddress>;
