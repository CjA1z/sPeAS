import { Router } from "../deps.ts";
import { getAdminDashboard, getAdminOperationalReport, getLegacyStatistics, exportOperationalReport, deprecatedExportEndpoint } from "../controllers/reportsController.ts";
import { isAuthenticated, requireCapability } from "../middleware/authMiddleware.ts";

const router = new Router();

// Canonical administrator reporting routes.
router
  .get("/api/admin/dashboard", isAuthenticated, requireCapability("reports:view"), getAdminDashboard)
  .get("/api/admin/reports/operational", isAuthenticated, requireCapability("reports:view"), getAdminOperationalReport)
  .get("/api/admin/reports/operational/export", isAuthenticated, requireCapability("reports:export"), exportOperationalReport)
  .post("/api/reports/export-pdf", isAuthenticated, requireCapability("reports:export"), deprecatedExportEndpoint)
  .post("/api/reports/export-csv", isAuthenticated, requireCapability("reports:export"), deprecatedExportEndpoint)
  .get("/api/documents/statistics", isAuthenticated, requireCapability("reports:view"), getLegacyStatistics)
  .get("/api/stats/summary", isAuthenticated, requireCapability("reports:view"), getLegacyStatistics);

export default router;
