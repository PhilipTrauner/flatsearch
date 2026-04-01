import type { ZodObject } from "zod";

import { InferenceProviderMistral } from "./provider/mistral.ts";

import type { IInferenceProvider } from "./base.ts";

export const wantedProperties = (schema: ZodObject) => {
  const wanted: string[] = [];
  for (const option of schema.keyof().options) {
    const meta = schema.shape[option].meta()?.description ?? option;
    wanted.push(meta);
  }
  return wanted;
};

export const inferenceProvider = (): IInferenceProvider => {
  const { MISTRAL_API_KEY, MISTRAL_MODEL } = process.env;

  if (typeof MISTRAL_API_KEY === "undefined") {
    console.error("<MISTRAL_API_KEY> environment variable not set");
    process.exit(1);
  }

  if (typeof MISTRAL_MODEL === "undefined") {
    console.error("<MISTRAL_MODEL> environment variable not set");
    process.exit(1);
  }

  return new InferenceProviderMistral(MISTRAL_API_KEY, MISTRAL_MODEL);
};

type OmitOptional<T> = Omit<T, keyof { [K in keyof T as undefined extends T[K] ? K : never]: K }>;

export function assertRequiredArgs<
  Result extends { values: Record<string, string | boolean | undefined> },
  Require extends keyof Result["values"],
>(
  result: Result,
  required: readonly Require[],
): asserts result is Result & {
  values: {
    [K in keyof Result["values"]]-?: K extends Require
      ? Result["values"][K]
      : K extends keyof OmitOptional<Result["values"]>
        ? Result["values"][K]
        : Result["values"][K] | undefined;
  };
} {
  for (const [key, value] of Object.entries(result.values)) {
    if (required.includes(key as Require)) {
      if (typeof value === "undefined") {
        console.error(`required argument <${key}> not set`);
        process.exit(1);
      }
    }
  }
}
