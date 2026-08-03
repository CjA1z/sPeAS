import { RouterContext } from "../deps.ts";
import { DocumentRequestModel, DocumentRequest } from "../models/documentRequestModel.ts";
import { DocumentModel } from "../models/documentModel.ts";
import { SystemLogsModel } from "../models/systemLogsModel.ts";
import { sendRequestConfirmationEmail, sendApprovedRequestEmail, sendRejectedRequestEmail } from "../services/emailService.ts";
import { client } from "../db/denopost_conn.ts";
import { recordRepositoryActivity } from "../services/operationalReportingService.ts";

function getAccessTokenExpiry(): Date {
    const configuredHours = Number(Deno.env.get("DOCUMENT_ACCESS_TOKEN_TTL_HOURS") || "168");
    const ttlHours = Number.isFinite(configuredHours) && configuredHours > 0
        ? Math.min(configuredHours, 24 * 30)
        : 168;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);
    return expiresAt;
}

function getContentType(fileName: string): string {
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
    if (fileExt === "pdf") return "application/pdf";
    if (["doc", "docx"].includes(fileExt)) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (["xls", "xlsx"].includes(fileExt)) {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
    if (["jpg", "jpeg"].includes(fileExt)) return "image/jpeg";
    if (fileExt === "png") return "image/png";
    return "application/octet-stream";
}

function sanitizeDownloadFileName(fileName: string): string {
    return fileName.replace(/[\r\n"]/g, "_") || "document";
}

function getPublicOrigin(ctx: RouterContext<any, any, any>): string {
    const configuredOrigin = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("APP_BASE_URL") || "";
    return configuredOrigin ? configuredOrigin.replace(/\/+$/, "") : ctx.request.url.origin;
}

export class DocumentRequestController {
    private documentRequestModel: DocumentRequestModel;

    constructor(documentRequestModel: DocumentRequestModel) {
        this.documentRequestModel = documentRequestModel;
    }

    // Create a new document request
    async createRequest(ctx: RouterContext<any, any, any>) {
        try {
            const body = ctx.request.body();
            const requestData = await body.value;

            // Validate required fields
            const requiredFields = ['document_id', 'full_name', 'email', 'affiliation', 'reason', 'reason_details'];
            for (const field of requiredFields) {
                if (!requestData[field]) {
                    ctx.response.status = 400;
                    ctx.response.body = { error: `Missing required field: ${field}` };
                    return;
                }
            }

            // Check if this is a request for an entire collection
            const isEntireCollection = !!requestData.is_entire_collection;
            
            let document;
            let documentId = parseInt(requestData.document_id);

            // First attempt to look in regular documents table
            document = await DocumentModel.getById(documentId);

            // If not found in documents table, check compiled_documents table
            if (!document) {
                                try {
                    const compiledResult = await client.queryObject(`
                        SELECT cd.*, 
                            COALESCE(
                                (SELECT title FROM documents WHERE id = cd.id),
                                (cd.category || ' Vol. ' || COALESCE(cd.volume::text, '1') || 
                                CASE WHEN cd.start_year IS NOT NULL 
                                    THEN ' (' || cd.start_year::text || 
                                        CASE WHEN cd.end_year IS NOT NULL 
                                            THEN '-' || cd.end_year::text 
                                            ELSE '' 
                                        END || ')'
                                    ELSE ''
                                END)
                            ) as title
                        FROM compiled_documents cd
                        WHERE cd.id = $1 AND cd.deleted_at IS NULL
                    `, [documentId]);
                    
                    if (compiledResult.rows.length > 0) {
                        // Create a document-like object from compiled document
                        const compiledDoc = compiledResult.rows[0] as Record<string, any>;
                        document = {
                            id: compiledDoc.id,
                            title: compiledDoc.title,
                            is_public: false,
                            document_type: compiledDoc.category || 'CONFLUENCE',
                            category: compiledDoc.category,
                            is_compiled: true,
                            file_path: ''  // Compiled documents don't typically have a file_path
                        };
                                                
                        // If this is an entire collection request, get child documents
                        if (isEntireCollection && Array.isArray(requestData.child_document_ids)) {
                                                        requestData.child_documents = requestData.child_document_ids;
                        } else if (isEntireCollection) {
                            // Try to fetch child documents if not provided in request
                            try {
                                const childDocsResult = await client.queryObject(`
                                    SELECT d.id
                                    FROM documents d
                                    JOIN compiled_document_items cdi ON d.id = cdi.document_id
                                    WHERE cdi.compiled_document_id = $1
                                    AND d.deleted_at IS NULL
                                `, [documentId]);
                                
                                if (childDocsResult.rows.length > 0) {
                                    requestData.child_documents = childDocsResult.rows.map((row) => {
                                        const typedRow = row as Record<string, any>;
                                        return typedRow.id;
                                    });
                                                                    }
                            } catch (childError) {
                            }
                        }
                    }
                } catch (error) {
                }
            }

            // If document still not found, return error
            if (!document) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Document not found' };
                return;
            }

            // Create the request
            const request = await this.documentRequestModel.create(requestData);
            
            // Send confirmation email - moved to background processing to prevent server crashes
            let emailSuccess = false;
            
            // Create response first - immediately return success to the client
            ctx.response.status = 201;
            ctx.response.body = { 
                ...request, 
                email_status: 'processing'
            };
            
            // Process email asynchronously after responding to the client
            setTimeout(async () => {
                try {
                                    
                // Extract document info
                const documentInfo = {
                    title: document.title || 'Requested Document',
                    author: document.author || undefined,
                    category: document.category || undefined,
                    researchAgenda: document.research_agenda || undefined,
                    abstract: document.abstract || undefined
                };
                
                // Extract request info
                const requestInfo = {
                    affiliation: requestData.affiliation,
                    reason: requestData.reason,
                    reasonDetails: requestData.reason_details
                };
                
                // Generate request ID - this format matches what we show in the UI
                const requestId = `REQ-${request.id || Date.now()}`;
                
                    // Send the confirmation email with error handling
                    try {
                        emailSuccess = await sendRequestConfirmationEmail(
                    requestData.email,
                    requestData.full_name,
                    documentInfo,
                    requestInfo,
                    requestId
                        );
                        
                                            } catch (innerEmailError) {
                        emailSuccess = false;
                    }
                    
                    // Update request with email status
                    try {
                        if (request.id === undefined) {
                            throw new Error("Document request is missing an ID");
                        }
                        await this.documentRequestModel.update(request.id, {
                            email_sent: emailSuccess,
                            email_error: emailSuccess ? undefined : "Failed to send confirmation email"
                });
                    } catch (updateError) {
                    }
                } catch (outerEmailError) {
            }
            }, 100);
            
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get all document requests (admin only)
    async getAllRequests(ctx: RouterContext<any, any, any>) {
        try {
            const requests = await this.documentRequestModel.getAll();
            ctx.response.body = requests;
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get requests by status (admin only)
    async getRequestsByStatus(ctx: RouterContext<any, any, any>) {
        try {
            const status = ctx.params?.status;
            if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Invalid status' };
                return;
            }

            const requests = await this.documentRequestModel.getByStatus(status as 'pending' | 'approved' | 'rejected');
            ctx.response.body = requests;
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Get requests for a specific document
    async getRequestsByDocumentId(ctx: RouterContext<any, any, any>) {
        try {
            const documentId = ctx.params?.documentId;
            if (!documentId) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Document ID is required' };
                return;
            }

            const requests = await this.documentRequestModel.getByDocumentId(documentId);
            ctx.response.body = requests;
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Update request status (admin only)
    async updateRequestStatus(ctx: RouterContext<any, any, any>) {
        try {
            const requestId = ctx.params.id;
            const body = ctx.request.body();
            const { status, reviewedBy, reviewNotes } = await body.value;

            if (!requestId || !status || !reviewedBy) {
                ctx.response.status = 400;
                ctx.response.body = { error: "Missing required fields" };
                return;
            }

            if (status !== 'approved' && status !== 'rejected') {
                ctx.response.status = 400;
                ctx.response.body = { error: "Status must be 'approved' or 'rejected'" };
                return;
            }

            const requestIdNum = parseInt(requestId);
            const request = await this.documentRequestModel.getById(requestIdNum);
            if (!request) {
                ctx.response.status = 404;
                ctx.response.body = { error: "Request not found" };
                return;
            }

            const result = await this.documentRequestModel.updateStatus(
                requestIdNum,
                status,
                reviewedBy,
                reviewNotes
            );

            if (!result) {
                ctx.response.status = 500;
                ctx.response.body = { error: "Failed to update request status" };
                return;
            }

            // Update the request object with the new status
            request.status = status;
            request.reviewed_by = reviewedBy;
            request.reviewed_at = new Date();
            request.review_notes = reviewNotes || null;

            // Send email notification
            if (status === 'approved') {
                try {
                    // Fetch the associated document to get the file path
                    // Ensure document_id is a number - convert if it's not, or use 0 as a safe default
                    let documentId = 0;
                    if (typeof request.document_id === 'number') {
                        documentId = request.document_id;
                    } else if (request.document_id) {
                        const parsedId = parseInt(String(request.document_id));
                        if (!isNaN(parsedId)) documentId = parsedId;
                    }
                    
                    const document = await DocumentModel.getById(documentId);
                    
                    if (!document) {
                        ctx.response.status = 200;
                        ctx.response.body = { 
                            success: true, 
                            warning: "Document not found. Email notification may not include the document." 
                        };
                        return;
                    }
                    
                    // Verify if the document file actually exists before issuing access.
                    let fileExists = false;
                    const filePath = document.file_path;

                    try {
                        const resolvedPath = await DocumentModel.getDocumentPath(documentId);
                        if (resolvedPath) {
                            const fileInfo = await Deno.stat(resolvedPath);
                            fileExists = fileInfo.isFile;
                        }
                    } catch (_fileError) {
                        fileExists = false;
                    }
                    
                    // Proceed with sending the email
                    const title = document.title || "Requested Document";
                    const requestIdString = request.id ? request.id.toString() : "unknown";
                    
                    // Convert keywords from array to string if needed
                    const keywordsStr = document.keywords ? 
                        (Array.isArray(document.keywords) ? document.keywords.join(', ') : document.keywords) : 
                        null;

                    const expiresAt = getAccessTokenExpiry();
                    await this.documentRequestModel.revokeAccessTokensForRequest(requestIdNum);
                    const accessGrant = await this.documentRequestModel.createAccessToken(
                        requestIdNum,
                        String(documentId),
                        request.email,
                        expiresAt,
                    );
                    const secureDownloadUrl =
                        `${getPublicOrigin(ctx)}/api/document-requests/${requestIdNum}/download?token=${encodeURIComponent(accessGrant.rawToken)}`;
                    
                    await sendApprovedRequestEmail(
                        request.email,
                        request.full_name,
                        title,
                        document.file_path || '',
                        requestIdString,
                        document.author,
                        document.category,
                        keywordsStr,
                        undefined,
                        {
                            secureDownloadUrl,
                            expiresAt,
                            attachDocument: false,
                        }
                    );

                    ctx.response.status = 200;
                    ctx.response.body = { 
                        success: true,
                        fileFound: fileExists,
                        accessExpiresAt: expiresAt.toISOString()
                    };
                } catch (error: any) {
                    ctx.response.status = 200; // Still return 200 as the status update was successful
                    ctx.response.body = { 
                        success: true, 
                        emailError: "Failed to send notification email: " + (error.message || "Unknown error") 
                    };
                }
            } else if (status === 'rejected') {
                try {
                    await this.documentRequestModel.revokeAccessTokensForRequest(requestIdNum);

                    // Fetch the associated document to get the title
                    // Ensure document_id is a number - convert if it's not, or use 0 as a safe default
                    let documentId = 0;
                    if (typeof request.document_id === 'number') {
                        documentId = request.document_id;
                    } else if (request.document_id) {
                        const parsedId = parseInt(String(request.document_id));
                        if (!isNaN(parsedId)) documentId = parsedId;
                    }
                    
                    const document = await DocumentModel.getById(documentId);
                    const title = document ? document.title : "Requested Document";
                    const requestIdString = request.id ? request.id.toString() : "unknown";
                    
                                        
                    // Send rejection email with the rejection reason from reviewNotes
                    await sendRejectedRequestEmail(
                        request.email,
                        request.full_name,
                        title,
                        reviewNotes || "Your request has been rejected by an administrator.",
                        requestIdString
                    );
                    
                    ctx.response.status = 200;
                    ctx.response.body = { 
                        success: true,
                        emailSent: true
                    };
                } catch (error: any) {
                    ctx.response.status = 200; // Still return 200 as the status update was successful
                    ctx.response.body = { 
                        success: true, 
                        emailError: "Failed to send rejection notification email: " + (error.message || "Unknown error") 
                    };
                }
            } else {
                ctx.response.status = 200;
                ctx.response.body = { success: true };
            }
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    // Delete a request (admin only)
    async deleteRequest(ctx: RouterContext<any, any, any>) {
        try {
            const requestId = ctx.params?.id;
            const requestIdNum = parseInt(String(requestId), 10);
            if (isNaN(requestIdNum)) {
                ctx.response.status = 400;
                ctx.response.body = { error: 'Invalid request ID' };
                return;
            }

            const success = await this.documentRequestModel.delete(requestIdNum);

            if (!success) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Request not found' };
                return;
            }

            ctx.response.body = { message: 'Request deleted successfully' };
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }

    async downloadApprovedDocument(ctx: RouterContext<any, any, any>) {
        try {
            const requestId = parseInt(String(ctx.params?.id || ""), 10);
            const token = ctx.request.url.searchParams.get("token");

            if (isNaN(requestId) || !token) {
                ctx.response.status = 400;
                ctx.response.body = { error: "A valid request ID and access token are required" };
                return;
            }

            const access = await this.documentRequestModel.getValidAccessToken(token);
            if (!access || access.request_id !== requestId) {
                ctx.response.status = 403;
                ctx.response.body = { error: "Access link is invalid, expired, or revoked" };
                return;
            }

            const documentId = parseInt(String(access.document_id), 10);
            if (isNaN(documentId)) {
                ctx.response.status = 400;
                ctx.response.body = { error: "Invalid document reference" };
                return;
            }

            const document = await DocumentModel.getDocumentById(documentId);
            if (!document) {
                ctx.response.status = 404;
                ctx.response.body = { error: "Document not found" };
                return;
            }

            const filePath = await DocumentModel.getDocumentPath(documentId);
            if (!filePath) {
                ctx.response.status = 404;
                ctx.response.body = { error: "Document file not found" };
                return;
            }

            try {
                const fileInfo = await Deno.stat(filePath);
                if (!fileInfo.isFile) {
                    throw new Error("Resolved path is not a file");
                }
            } catch (_fileError) {
                ctx.response.status = 404;
                ctx.response.body = { error: "Document file not found" };
                return;
            }

            await this.documentRequestModel.markAccessTokenUsed(access.id);

            const fileName = sanitizeDownloadFileName(
                filePath.split("/").pop()?.split("\\").pop() || `document-${documentId}`,
            );

            try {
                await SystemLogsModel.createLog({
                    log_type: "download",
                    user_id: null,
                    username: access.email,
                    action: "Approved outsider document download",
                    details: {
                        request_id: requestId,
                        document_id: documentId,
                        document_title: document.title || `Document ${documentId}`,
                        access_token_id: access.id,
                        expires_at: access.expires_at,
                        timestamp: new Date().toISOString(),
                        file_name: fileName,
                    },
                    ip_address: ctx.request.ip || "Unknown",
                    status: "success",
                    related_id: String(documentId),
                });
            } catch (_logError) {
                // Download access should not fail only because audit logging failed.
            }

            ctx.response.headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
            ctx.response.headers.set("Content-Type", getContentType(fileName));
            ctx.response.headers.set("Cache-Control", "no-store");
            ctx.response.body = await Deno.readFile(filePath);
            await recordRepositoryActivity({ recordType: "document", recordId: documentId, audience: "approved_request", action: "download" }).catch(() => undefined);
        } catch (error) {
            ctx.response.status = 500;
            console.error("Approved document delivery failed", { code: "APPROVED_DOCUMENT_DELIVERY_FAILED" });
            ctx.response.body = { error: "Failed to download approved document", code: "APPROVED_DOCUMENT_DELIVERY_FAILED" };
        }
    }

    // Check if user has access to a document
    async checkDocumentAccess(ctx: RouterContext<any, any, any>) {
        try {
            const documentId = ctx.params?.documentId;
            const email = ctx.request.url.searchParams.get('email');

            // First check if the document is public
            const document = await DocumentModel.getById(parseInt(documentId || '0'));
            if (!document) {
                // If not found in documents table, check compiled_documents table
                try {
                    const compiledResult = await client.queryObject(`
                        SELECT cd.* FROM compiled_documents cd
                        WHERE cd.id = $1 AND cd.deleted_at IS NULL
                    `, [parseInt(documentId || '0')]);
                    
                    if (compiledResult.rows.length === 0) {
                ctx.response.status = 404;
                ctx.response.body = { error: 'Document not found' };
                return;
                    }
                    
                    // Compiled documents aren't public by default
                    if (!email) {
                        ctx.response.body = { hasAccess: false };
                        return;
                    }
                    
                    // Check if user has an approved request for this compiled document
                    const hasAccess = await this.documentRequestModel.hasApprovedRequest(documentId || '', email);
                    ctx.response.body = { hasAccess };
                    return;
                } catch (error) {
                    ctx.response.status = 404;
                    ctx.response.body = { error: 'Document not found' };
                    return;
                }
            }

            // If document is public, allow access
            if (document.is_public) {
                ctx.response.body = { hasAccess: true };
                return;
            }

            // If no email provided, treat as guest user
            if (!email) {
                ctx.response.body = { hasAccess: false };
                return;
            }

            // Check if user has an approved request
            const hasAccess = await this.documentRequestModel.hasApprovedRequest(documentId || '', email);
            ctx.response.body = { hasAccess };
        } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = { error: 'Internal server error' };
        }
    }
}
