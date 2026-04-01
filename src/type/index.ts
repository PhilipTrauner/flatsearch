import { z } from "zod";

export const stringToNumber = z.codec(z.string().regex(/^-?\d+(?:(?:\.|,)\d+)?$/), z.number(), {
  decode: (str) => Number.parseFloat(str.replace(",", ".")),
  encode: (num) => num.toString(),
});
