import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { isAdmin, isAuthenticated } from "../middleware/authMiddleware.ts";
import {
  ensureIncompleteAuthorNotifications,
  getAdminNotificationSummary,
  listAdminNotifications,
  markAdminNotificationRead,
} from "../services/authorNotificationService.ts";

const router = new Router();

router.get("/api/admin/notifications", isAuthenticated, isAdmin, async (ctx) => {
  await ensureIncompleteAuthorNotifications();
  ctx.response.status = 200;
  ctx.response.body = { notifications: await listAdminNotifications(), summary: await getAdminNotificationSummary() };
});

router.patch("/api/admin/notifications/:id/read", isAuthenticated, isAdmin, async (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Notification ID is invalid." };
    return;
  }
  if (!await markAdminNotificationRead(id)) {
    ctx.response.status = 404;
    ctx.response.body = { error: "Notification not found." };
    return;
  }
  ctx.response.status = 200;
  ctx.response.body = { status: "read" };
});

export default router;
