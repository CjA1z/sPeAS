import { client } from "../db/denopost_conn.ts";

interface DocumentStatistics {
  active_documents: number;
  archived_documents: number;
  total_documents: number;
  catalog_entries: number;
  archived_catalog_entries: number;
  total_catalog_entries: number;
  stored_documents: number;
  author_records: number;
  document_types: Array<{document_type: string; count: number}>;
  time_range: string;
  metric_definitions: Record<string, string>;
}

const METRIC_DEFINITIONS = {
  catalog_entries: "Active top-level repository entries. A compilation counts once and its child studies are excluded.",
  stored_documents: "Active document records stored by PeAS. Child studies inside compilations are included.",
  archived_catalog_entries: "Archived top-level repository entries. A compilation counts once.",
  archived_documents: "Archived document records. Compilation parent records are not stored in the documents table.",
  author_records: "All author directory records, including authors that are not yet linked to a published work.",
} as const;

/**
 * Canonical operational metrics shared by Dashboard and Reports.
 * Catalog entries count top-level records; stored documents count rows in the
 * document store and therefore include studies contained by compilations.
 */
export async function getCanonicalRepositoryMetrics(timeRange = "all"): Promise<DocumentStatistics> {
  const startDate = getRangeStart(timeRange);
  const params = startDate ? [startDate.toISOString()] : [];
  const dateFilter = startDate ? "(created_at >= $1 OR updated_at >= $1)" : "TRUE";

  const [documentCounts, compilationCounts, authorCounts, documentTypes] = await Promise.all([
    client.queryObject(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::BIGINT AS active_documents,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::BIGINT AS archived_documents,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND compiled_parent_id IS NULL)::BIGINT AS active_single_entries,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND compiled_parent_id IS NULL)::BIGINT AS archived_single_entries
      FROM documents
      WHERE ${dateFilter}
    `, params),
    client.queryObject(`
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::BIGINT AS active_compilations,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::BIGINT AS archived_compilations
      FROM compiled_documents
      WHERE ${dateFilter}
    `, params),
    client.queryObject("SELECT COUNT(*)::BIGINT AS author_records FROM authors"),
    client.queryObject(`
      SELECT document_type, COUNT(*)::BIGINT AS count
      FROM (
        SELECT d.document_type::TEXT AS document_type
        FROM documents d
        WHERE d.deleted_at IS NULL
          AND d.compiled_parent_id IS NULL
          AND ${startDate ? "(d.created_at >= $1 OR d.updated_at >= $1)" : "TRUE"}
        UNION ALL
        SELECT COALESCE(cd.category, 'CONFLUENCE')::TEXT AS document_type
        FROM compiled_documents cd
        WHERE cd.deleted_at IS NULL
          AND ${startDate ? "(cd.created_at >= $1 OR cd.updated_at >= $1)" : "TRUE"}
      ) entries
      GROUP BY document_type
      ORDER BY document_type
    `, params),
  ]);

  const documentRow = (documentCounts.rows[0] ?? {}) as Record<string, unknown>;
  const compilationRow = (compilationCounts.rows[0] ?? {}) as Record<string, unknown>;
  const authorRow = (authorCounts.rows[0] ?? {}) as Record<string, unknown>;
  const activeDocuments = Number(documentRow.active_documents ?? 0);
  const archivedDocuments = Number(documentRow.archived_documents ?? 0);
  const catalogEntries = Number(documentRow.active_single_entries ?? 0) + Number(compilationRow.active_compilations ?? 0);
  const archivedCatalogEntries = Number(documentRow.archived_single_entries ?? 0) + Number(compilationRow.archived_compilations ?? 0);

  return {
    active_documents: activeDocuments,
    archived_documents: archivedDocuments,
    total_documents: activeDocuments + archivedDocuments,
    catalog_entries: catalogEntries,
    archived_catalog_entries: archivedCatalogEntries,
    total_catalog_entries: catalogEntries + archivedCatalogEntries,
    stored_documents: activeDocuments,
    author_records: Number(authorRow.author_records ?? 0),
    document_types: documentTypes.rows.map((row) => ({
      document_type: String((row as Record<string, unknown>).document_type ?? "unknown"),
      count: Number((row as Record<string, unknown>).count ?? 0),
    })),
    time_range: startDate ? timeRange : "all",
    metric_definitions: { ...METRIC_DEFINITIONS },
  };
}

function getRangeStart(timeRange: string): Date | null {
  if (timeRange === "all") return null;
  const start = new Date();
  if (timeRange === "daily") start.setDate(start.getDate() - 1);
  else if (timeRange === "weekly") start.setDate(start.getDate() - 7);
  else if (timeRange === "monthly") start.setMonth(start.getMonth() - 1);
  else if (timeRange === "yearly") start.setFullYear(start.getFullYear() - 1);
  else return null;
  return start;
}

/**
 * Get document statistics with time range filtering
 * @param ctx Context object
 */
export async function getDocumentStatistics(ctx: any) {
  try {
    const timeRange = ctx.request.url.searchParams.get("timeRange") || "all";
    ctx.response.body = await getCanonicalRepositoryMetrics(timeRange);
    ctx.response.status = 200;
  } catch (error: unknown) {
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error fetching document statistics"
    };
    ctx.response.status = 500;
  }
}

/**
 * Generate and export PDF report
 * @param ctx Context object
 */
export async function exportPdfReport(ctx: any) {
  try {
    // Get request body
    const body = await ctx.request.body().value;
    
        
    const { reportType, timeRange, data } = body;
    
    // In a real implementation, you would use a PDF generation library
    // For this demo, we'll create a simple PDF with text content
    
    // Mock PDF generation - in a real app you would use a library like PDFKit
    const pdfContent = generateMockPdfContent(reportType, timeRange, data);
    
    // Set response headers for PDF download
    ctx.response.headers.set("Content-Type", "application/pdf");
    ctx.response.headers.set("Content-Disposition", `attachment; filename="archive-report-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    // Convert string to Uint8Array for response
    const encoder = new TextEncoder();
    ctx.response.body = encoder.encode(pdfContent);
    ctx.response.status = 200;
    
  } catch (error: unknown) {
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error generating PDF report"
    };
    ctx.response.status = 500;
  }
}

/**
 * Generate and export CSV report
 * @param ctx Context object
 */
export async function exportCsvReport(ctx: any) {
  try {
    // Get request body
    const body = await ctx.request.body().value;
    
        
    const { reportType, timeRange, data } = body;
    
    // Generate CSV content based on report type and data
    let csvContent = "Category,Count,TimeRange\r\n";
    
    if (data) {
      if (data.uploaded !== undefined) {
        csvContent += `Uploaded Documents,${data.uploaded},${timeRange}\r\n`;
      }
      if (data.active !== undefined) {
        csvContent += `Active Documents,${data.active},${timeRange}\r\n`;
      }
      if (data.archived !== undefined) {
        csvContent += `Archived Documents,${data.archived},${timeRange}\r\n`;
      }
    }
    
    // Set response headers for CSV download
    ctx.response.headers.set("Content-Type", "text/csv");
    ctx.response.headers.set("Content-Disposition", `attachment; filename="archive-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`);
    
    // Set the response body
    ctx.response.body = csvContent;
    ctx.response.status = 200;
    
  } catch (error: unknown) {
    ctx.response.body = {
      success: false,
      error: error instanceof Error ? error.message : "Error generating CSV report"
    };
    ctx.response.status = 500;
  }
}

/**
 * Helper function to generate mock PDF content
 * In a real implementation, you would use a PDF generation library
 */
function generateMockPdfContent(reportType: string, timeRange: string, data: any): string {
  // This is a simplified mock - real PDFs are binary files with specific format
  // In production, use a proper PDF generation library
  
  let content = "%PDF-1.4\n";
  content += "1 0 obj\n";
  content += "<< /Type /Catalog /Pages 2 0 R >>\n";
  content += "endobj\n";
  content += "2 0 obj\n";
  content += "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n";
  content += "endobj\n";
  content += "3 0 obj\n";
  content += "<< /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>\n";
  content += "endobj\n";
  content += "4 0 obj\n";
  content += "<< /Font << /F1 6 0 R >> >>\n";
  content += "endobj\n";
  content += "5 0 obj\n";
  content += "<< /Length 171 >>\n";
  content += "stream\n";
  content += "BT\n";
  content += "/F1 24 Tf\n";
  content += "100 700 Td\n";
  content += "(Archive System Report) Tj\n";
  content += "/F1 12 Tf\n";
  content += "0 -50 Td\n";
  content += `(Report Type: ${reportType}) Tj\n`;
  content += "0 -20 Td\n";
  content += `(Time Range: ${timeRange}) Tj\n`;
  content += "0 -20 Td\n";
  
  if (data) {
    if (data.uploaded !== undefined) {
      content += `(Uploaded Documents: ${data.uploaded}) Tj\n`;
      content += "0 -20 Td\n";
    }
    if (data.active !== undefined) {
      content += `(Active Documents: ${data.active}) Tj\n`;
      content += "0 -20 Td\n";
    }
    if (data.archived !== undefined) {
      content += `(Archived Documents: ${data.archived}) Tj\n`;
    }
  }
  
  content += "ET\n";
  content += "endstream\n";
  content += "endobj\n";
  content += "6 0 obj\n";
  content += "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n";
  content += "endobj\n";
  content += "xref\n";
  content += "0 7\n";
  content += "0000000000 65535 f\n";
  content += "0000000010 00000 n\n";
  content += "0000000059 00000 n\n";
  content += "0000000118 00000 n\n";
  content += "0000000217 00000 n\n";
  content += "0000000262 00000 n\n";
  content += "0000000485 00000 n\n";
  content += "trailer\n";
  content += "<< /Size 7 /Root 1 0 R >>\n";
  content += "startxref\n";
  content += "553\n";
  content += "%%EOF";
  
  return content;
}
