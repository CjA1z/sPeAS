import { Router } from "../deps.ts";
import { 
  getDocumentStatistics,
  getCanonicalRepositoryMetrics,
  exportPdfReport,
  exportCsvReport
} from "../controllers/reportsController.ts";

// Create a simplified stats controller function
async function getSimpleStats(ctx: any) {
  try {
    ctx.response.body = await getCanonicalRepositoryMetrics("all");
    ctx.response.status = 200;
        
  } catch (error) {
    ctx.response.body = { 
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
    ctx.response.status = 500;
  }
}

const router = new Router();

// Reports API routes
router
  .get("/api/documents/statistics", getDocumentStatistics)
  .get("/api/stats/summary", getSimpleStats)  // Add a new, simpler endpoint
  .post("/api/reports/export-pdf", exportPdfReport)
  .post("/api/reports/export-csv", exportCsvReport);

export default router;
