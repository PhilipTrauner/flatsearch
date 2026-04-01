import { join } from "node:path";

export const pathImages = (parentDirectory: string) => join(parentDirectory, "image");
export const pathManifest = (parentDirectory: string) => join(parentDirectory, "manifest.json");
