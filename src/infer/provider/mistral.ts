import { Mistral } from "@mistralai/mistralai";
import type { ZodType } from "zod";
import type { output } from "zod/v4/core";

import type { IInferenceProvider, InferenceProviderPrompt } from "../base.ts";

export class InferenceProviderMistral implements IInferenceProvider {
  private mistral: Mistral;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.mistral = new Mistral({ apiKey });
    this.model = model;
  }

  async infer<T extends ZodType>(prompt: InferenceProviderPrompt, schema: T): Promise<output<T>> {
    const messageContent = [
      { type: "text" as const, text: prompt.prompt },
      ...("images" in prompt
        ? prompt.images.map((image) => ({
            type: "image_url" as const,
            imageUrl: `data:image/jpeg;base64,${image.toString("base64")}`,
          }))
        : []),
    ];

    const response = await this.mistral.chat.complete({
      model: this.model,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "schema",
          schemaDefinition: schema.toJSONSchema(),
        },
      },

      temperature: 0,
      stream: false,
    });

    try {
      return schema.decode(JSON.parse(response.choices[0].message.content as string));
    } catch (e) {
      console.dir(response.choices[0], { depth: null });
      throw e;
    }
  }
}
