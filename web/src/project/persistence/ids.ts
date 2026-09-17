import { UNSAVED_PROJECT_ID } from "../new-project";

export function createDurableProjectId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `tv-${hex}`;
}

export function ensureDurableProjectId(id: string | undefined): string {
  if (id && id !== UNSAVED_PROJECT_ID) {
    return id;
  }
  return createDurableProjectId();
}
