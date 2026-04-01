import type { output, ZodType } from "zod";

export type InferenceProviderPrompt = { prompt: string; images?: Buffer[] };

export interface IInferenceProvider {
  infer<T extends ZodType>(prompt: InferenceProviderPrompt, schema: T): Promise<output<T>>;
}
