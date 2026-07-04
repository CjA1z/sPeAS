import { ensureDir, extname, join } from "../deps.ts";
import { client } from "../db/denopost_conn.ts";
import { WORKSPACE_ROOT } from "../config/storage.ts";
import {
  defaultExperienceConfig,
  ExperienceConfig,
  parseExperienceConfig,
  parseUserExperiencePreferences,
  UserExperiencePreferences,
} from "../shared/experienceConfig.ts";

type ExperienceRow = {
  id: number;
  status: "draft" | "published" | "archived";
  version: number;
  config: unknown;
  created_by?: string | null;
  updated_by?: string | null;
  published_by?: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
  published_at?: Date | string | null;
};

type AssetRow = {
  id: number;
  file_path: string;
  kind: string;
  alt_text?: string | null;
  mime_type: string;
  size_bytes: number;
  created_by?: string | null;
  created_at?: Date | string;
};

const SITE_BRANDING_STORAGE = join(WORKSPACE_ROOT, "storage", "site-branding");
const MAX_ASSET_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

function withTimestamp(config: ExperienceConfig): ExperienceConfig {
  return {
    ...config,
    updatedAt: new Date().toISOString(),
  };
}

function parseConfigFromRow(row: ExperienceRow | undefined): ExperienceConfig | null {
  if (!row) return null;
  const rawConfig = typeof row.config === "string" ? JSON.parse(row.config) : row.config;
  return parseExperienceConfig(rawConfig);
}

async function nextExperienceVersion(): Promise<number> {
  const result = await client.queryObject<{ next_version: number }>(
    "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM site_experience_versions",
  );
  return Number(result.rows[0]?.next_version ?? 1);
}

export async function ensureExperienceTablesExist(): Promise<void> {
  await client.queryObject(`
    CREATE TABLE IF NOT EXISTS site_experience_versions (
      id SERIAL PRIMARY KEY,
      status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      version INTEGER NOT NULL,
      config JSONB NOT NULL,
      created_by VARCHAR(50),
      updated_by VARCHAR(50),
      published_by VARCHAR(50),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP WITHOUT TIME ZONE
    );

    CREATE INDEX IF NOT EXISTS idx_site_experience_versions_status
      ON site_experience_versions(status);

    CREATE INDEX IF NOT EXISTS idx_site_experience_versions_version
      ON site_experience_versions(version DESC);

    CREATE TABLE IF NOT EXISTS site_assets (
      id SERIAL PRIMARY KEY,
      file_path VARCHAR(500) NOT NULL,
      kind VARCHAR(80) NOT NULL,
      alt_text VARCHAR(255),
      mime_type VARCHAR(120) NOT NULL,
      size_bytes INTEGER NOT NULL,
      created_by VARCHAR(50),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_site_assets_kind
      ON site_assets(kind);

    CREATE TABLE IF NOT EXISTS user_experience_preferences (
      user_id VARCHAR(50) PRIMARY KEY,
      preferences JSONB NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensureDir(SITE_BRANDING_STORAGE);

  const publishedResult = await client.queryObject<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM site_experience_versions WHERE status = 'published'",
  );
  const hasPublished = Number(publishedResult.rows[0]?.count ?? 0) > 0;

  if (!hasPublished) {
    const seededConfig = withTimestamp(defaultExperienceConfig);
    await client.queryObject(
      `INSERT INTO site_experience_versions
        (status, version, config, created_by, updated_by, published_by, published_at)
       VALUES ('published', 1, $1::jsonb, 'system', 'system', 'system', CURRENT_TIMESTAMP)`,
      [JSON.stringify(seededConfig)],
    );
  }
}

export async function getPublicExperienceConfig(): Promise<ExperienceConfig> {
  const result = await client.queryObject<ExperienceRow>(
    `SELECT * FROM site_experience_versions
     WHERE status = 'published'
     ORDER BY published_at DESC NULLS LAST, version DESC
     LIMIT 1`,
  );

  return parseConfigFromRow(result.rows[0]) ?? withTimestamp(defaultExperienceConfig);
}

export async function getDraftExperienceConfig(): Promise<{
  config: ExperienceConfig;
  version: number;
  status: string;
}> {
  const result = await client.queryObject<ExperienceRow>(
    `SELECT * FROM site_experience_versions
     WHERE status = 'draft'
     ORDER BY updated_at DESC, version DESC
     LIMIT 1`,
  );

  const draft = result.rows[0];
  if (draft) {
    return {
      config: parseConfigFromRow(draft) ?? withTimestamp(defaultExperienceConfig),
      version: Number(draft.version),
      status: "draft",
    };
  }

  const published = await getPublicExperienceConfig();
  return {
    config: published,
    version: await nextExperienceVersion(),
    status: "published-copy",
  };
}

export async function saveDraftExperienceConfig(
  input: unknown,
  userId: string,
): Promise<{ config: ExperienceConfig; version: number }> {
  const config = withTimestamp(parseExperienceConfig(input));
  const version = await nextExperienceVersion();

  await client.queryObject(
    `INSERT INTO site_experience_versions
      (status, version, config, created_by, updated_by)
     VALUES ('draft', $1, $2::jsonb, $3, $3)`,
    [version, JSON.stringify(config), userId],
  );

  return { config, version };
}

export async function publishDraftExperienceConfig(
  userId: string,
): Promise<{ config: ExperienceConfig; version: number }> {
  const draftResult = await client.queryObject<ExperienceRow>(
    `SELECT * FROM site_experience_versions
     WHERE status = 'draft'
     ORDER BY updated_at DESC, version DESC
     LIMIT 1`,
  );

  const config = parseConfigFromRow(draftResult.rows[0]) ?? await getPublicExperienceConfig();
  const version = await nextExperienceVersion();
  const publishedConfig = withTimestamp(config);

  await client.queryObject(
    `UPDATE site_experience_versions
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'published'`,
  );

  await client.queryObject(
    `INSERT INTO site_experience_versions
      (status, version, config, created_by, updated_by, published_by, published_at)
     VALUES ('published', $1, $2::jsonb, $3, $3, $3, CURRENT_TIMESTAMP)`,
    [version, JSON.stringify(publishedConfig), userId],
  );

  return { config: publishedConfig, version };
}

export async function rollbackExperienceVersion(
  versionId: number,
  userId: string,
): Promise<{ config: ExperienceConfig; version: number; sourceVersion: number }> {
  const sourceResult = await client.queryObject<ExperienceRow>(
    `SELECT * FROM site_experience_versions
     WHERE id = $1
     LIMIT 1`,
    [versionId],
  );

  const source = sourceResult.rows[0];
  if (!source) {
    throw new Error("Experience version not found");
  }

  const restoredConfig = withTimestamp(parseConfigFromRow(source) ?? defaultExperienceConfig);
  const version = await nextExperienceVersion();

  await client.queryObject(
    `UPDATE site_experience_versions
     SET status = 'archived', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'published'`,
  );

  await client.queryObject(
    `INSERT INTO site_experience_versions
      (status, version, config, created_by, updated_by, published_by, published_at)
     VALUES ('published', $1, $2::jsonb, $3, $3, $3, CURRENT_TIMESTAMP)`,
    [version, JSON.stringify(restoredConfig), userId],
  );

  return {
    config: restoredConfig,
    version,
    sourceVersion: Number(source.version),
  };
}

export async function getExperienceVersions(limit = 20): Promise<Array<{
  id: number;
  status: string;
  version: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedBy?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  publishedAt?: Date | string | null;
}>> {
  const result = await client.queryObject<ExperienceRow>(
    `SELECT id, status, version, created_by, updated_by, published_by,
            created_at, updated_at, published_at, config
     FROM site_experience_versions
     ORDER BY version DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    status: row.status,
    version: Number(row.version),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  }));
}

export async function saveSiteAsset(options: {
  file: {
    filename?: string;
    name?: string;
    type?: string;
    content?: Uint8Array;
    path?: string;
  };
  kind: string;
  altText?: string;
  userId: string;
}): Promise<AssetRow> {
  const originalName = options.file.filename || options.file.name || "asset";
  const mimeType = options.file.type || "application/octet-stream";

  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, GIF, and SVG image assets are allowed");
  }

  let bytes: Uint8Array;
  if (options.file.content) {
    bytes = options.file.content;
  } else if (options.file.path) {
    bytes = await Deno.readFile(options.file.path);
  } else {
    throw new Error("Upload payload did not include file content");
  }

  if (bytes.byteLength > MAX_ASSET_SIZE) {
    throw new Error("Image assets must be 8MB or smaller");
  }

  await ensureDir(SITE_BRANDING_STORAGE);
  const extension = extname(originalName).toLowerCase() ||
    (mimeType === "image/svg+xml" ? ".svg" : ".png");
  const safeKind = options.kind.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "asset";
  const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
  const relativePath = `storage/site-branding/${safeKind}/${fileName}`;
  const fullDir = join(SITE_BRANDING_STORAGE, safeKind);
  const fullPath = join(WORKSPACE_ROOT, relativePath);

  await ensureDir(fullDir);
  await Deno.writeFile(fullPath, bytes);

  const result = await client.queryObject<AssetRow>(
    `INSERT INTO site_assets
      (file_path, kind, alt_text, mime_type, size_bytes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      `/${relativePath}`,
      safeKind,
      options.altText || null,
      mimeType,
      bytes.byteLength,
      options.userId,
    ],
  );

  return result.rows[0];
}

export async function getUserExperiencePreferences(
  userId: string,
): Promise<UserExperiencePreferences> {
  const result = await client.queryObject<{ preferences: unknown }>(
    "SELECT preferences FROM user_experience_preferences WHERE user_id = $1",
    [userId],
  );
  return parseUserExperiencePreferences(result.rows[0]?.preferences);
}

export async function saveUserExperiencePreferences(
  userId: string,
  input: unknown,
): Promise<UserExperiencePreferences> {
  const preferences = parseUserExperiencePreferences(input);

  await client.queryObject(
    `INSERT INTO user_experience_preferences (user_id, preferences)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(preferences)],
  );

  return preferences;
}
