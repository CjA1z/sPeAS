/**
 * Session utils — kept for backward compatibility.
 *
 * The actual verification logic lives in services/sessionService.ts
 * (the single source of truth). `verifySessionToken` is an alias for
 * `verifySession`; roles are lowercase (e.g. "admin", "user").
 */

export {
  type SessionData,
  verifySession,
  verifySession as verifySessionToken,
} from "../services/sessionService.ts";
