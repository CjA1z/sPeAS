/**
 * Canonical document-storage configuration.
 *
 * All uploads live under one root: <workspace>/storage/<documentType>/
 * (e.g. storage/thesis/, storage/dissertation/). The root can be overridden
 * with the STORAGE_ROOT environment variable (useful for Docker volumes).
 *
 * Both the upload path (uploadService) and the lookup paths
 * (fileCheckService) derive from this module — do not hardcode storage
 * folders elsewhere.
 */

import { join } from "../deps.ts";

/** Repository root — the parent of the Deno/ directory. */
export const WORKSPACE_ROOT = Deno.cwd().replace(/[\\/]Deno$/, "");

/** Root directory for all stored documents. */
export const STORAGE_ROOT = Deno.env.get("STORAGE_ROOT") ??
  join(WORKSPACE_ROOT, "storage");

/** Directory for a given document type (lowercased), e.g. storage/thesis. */
export function storagePathFor(documentType: string): string {
  return join(STORAGE_ROOT, documentType.toLowerCase()).replace(/\\/g, "/");
}

/** Known document-type subdirectories (for lookups across existing data). */
export const DOCUMENT_TYPE_DIRS = [
  "thesis",
  "dissertation",
  "confluence",
  "synergy",
  "general",
] as const;
