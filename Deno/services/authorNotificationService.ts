import { client } from "../db/denopost_conn.ts";

export async function ensureAuthorNotificationTablesExist() {
  const migration = await Deno.readTextFile(new URL("../db/migrations/2026-08_author_profile_notifications.sql", import.meta.url));
  await client.queryArray(migration);
}

export async function ensureIncompleteAuthorNotifications() {
  await client.queryArray(`
    INSERT INTO admin_notifications (
      notification_type, entity_type, entity_id, severity, title, message, action_path
    )
    SELECT
      'author_profile_incomplete', 'author', a.id, 'urgent',
      'Complete author profile',
      a.full_name || ' is missing directory information.',
      '/admin/Components/author-list.html?author=' || a.id::text || '&action=complete'
    FROM authors a
    WHERE NOT (
      (NULLIF(BTRIM(a.department), '') IS NOT NULL OR NULLIF(BTRIM(a.affiliation), '') IS NOT NULL)
    )
    ON CONFLICT (notification_type, entity_type, entity_id) DO UPDATE
      SET title = EXCLUDED.title,
          message = EXCLUDED.message,
          action_path = EXCLUDED.action_path,
          updated_at = CURRENT_TIMESTAMP,
          resolved_at = NULL
      WHERE admin_notifications.resolved_at IS NULL;
  `);

  // Reconcile notifications created under the former identifier/contact rule.
  // Department or affiliation is now the only completion criterion.
  await client.queryArray(`
    UPDATE admin_notifications n
    SET resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    FROM authors a
    WHERE n.notification_type = 'author_profile_incomplete'
      AND n.entity_type = 'author'
      AND n.entity_id = a.id
      AND n.resolved_at IS NULL
      AND (NULLIF(BTRIM(a.department), '') IS NOT NULL OR NULLIF(BTRIM(a.affiliation), '') IS NOT NULL)
  `);
}

export async function createIncompleteAuthorNotification(authorId: string, fullName: string) {
  await client.queryArray(`
    INSERT INTO admin_notifications (
      notification_type, entity_type, entity_id, severity, title, message, action_path
    ) VALUES (
      'author_profile_incomplete', 'author', $1::uuid, 'urgent',
      'Complete author profile', $2,
      '/admin/Components/author-list.html?author=' || $1::uuid::text || '&action=complete'
    )
    ON CONFLICT (notification_type, entity_type, entity_id) DO UPDATE
      SET message = EXCLUDED.message, resolved_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE admin_notifications.resolved_at IS NULL
  `, [authorId, `${fullName} is missing directory information.`]);
}

export async function syncAuthorProfileNotification(authorId: string, fullName: string, profileComplete: boolean) {
  if (profileComplete) {
    await client.queryArray(`
      UPDATE admin_notifications
      SET resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE notification_type = 'author_profile_incomplete' AND entity_type = 'author' AND entity_id = $1::uuid
    `, [authorId]);
    return;
  }
  await createIncompleteAuthorNotification(authorId, fullName);
}

export async function listAdminNotifications() {
  const result = await client.queryObject<{
    id: number | bigint; notification_type: string; entity_type: string; entity_id: string;
    severity: string; title: string; message: string; action_path: string | null;
    is_read: boolean; resolved_at: Date | string | null; created_at: Date | string;
  }>(`
    SELECT id, notification_type, entity_type, entity_id, severity, title, message,
           action_path, is_read, resolved_at, created_at
    FROM admin_notifications
    WHERE resolved_at IS NULL
    ORDER BY CASE severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
             is_read ASC, created_at DESC, id DESC
    LIMIT 50
  `);
  return result.rows.map((row) => ({
    id: Number(row.id), type: row.notification_type, entityType: row.entity_type,
    entityId: row.entity_id, severity: row.severity, title: row.title, message: row.message,
    actionPath: row.action_path, isRead: row.is_read, resolved: false,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function getAdminNotificationSummary() {
  const result = await client.queryObject<{ total: number | bigint; unread: number | bigint; urgent: number | bigint }>(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE NOT is_read) AS unread,
           COUNT(*) FILTER (WHERE severity = 'urgent') AS urgent
    FROM admin_notifications
    WHERE resolved_at IS NULL
  `);
  const row = result.rows[0];
  return { total: Number(row?.total ?? 0), unread: Number(row?.unread ?? 0), urgent: Number(row?.urgent ?? 0) };
}

export async function markAdminNotificationRead(id: number) {
  const result = await client.queryObject<{ id: number | bigint }>(`
    UPDATE admin_notifications SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND resolved_at IS NULL RETURNING id
  `, [id]);
  return Boolean(result.rows[0]);
}
