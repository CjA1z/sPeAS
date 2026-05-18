// server.ts

// Load environment variables from .env file
import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";
// Load env variables with absolute path to ensure it's found
config({ 
  path: new URL("./.env", import.meta.url).pathname, 
  export: true 
});

// -----------------------------
// SECTION: Imports
// -----------------------------
import { Application, Router, FormDataReader } from "./deps.ts";
import { ensureDir } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";
import { join } from "https://deno.land/std@0.190.0/path/mod.ts";
import { connectToDb, diagnoseDatabaseIssues } from "./db/denopost_conn.ts"; // Using connectToDb from conn.ts
import { client } from "./db/denopost_conn.ts"; // Client for database queries
import { routes } from "./routes/index.ts"; // All route handlers in one file
import { authorRoutes } from "./routes/authorRoutes.ts"; // Import author routes directly
import { researchAgendaRoutes } from "./routes/researchAgendaRoutes.ts"; // Import research agenda routes directly
import { saveFile } from "./services/uploadService.ts"; // Import file upload service
import { extractPdfMetadata } from "./services/pdfService.ts"; // Import PDF service
import { fetchDocuments, fetchChildDocuments } from "./services/documentService.ts"; // Import document service
import documentAuthorRoutes from "./routes/documentAuthorRoutes.ts";
import fileRoutes from "./routes/fileRoutes.ts"; // Import file routes
import { uploadRoutes, uploadRoutesAllowedMethods } from "./routes/uploadRoutes.ts"; // Import upload routes
import reportsRoutes from "./routes/reportsRoutes.ts"; // Import reports routes
import { handler as categoryHandler, countByCategory } from "./api/category.ts"; // Import category handler
import { getDepartments } from "./api/departments.ts";
import { handleCreateDocument } from "./api/document.ts"; // Import document creation handler
import { getCategories } from "./controllers/categoryController.ts";
import { getChildDocuments } from "./controllers/documentController.ts";
import { getDocumentAuthors } from "./controllers/documentAuthorController.ts";
import { AuthorModel } from "./models/authorModel.ts";
import { DocumentModel } from "./models/documentModel.ts";
import { ResearchAgendaModel } from "./models/researchAgendaModel.ts";
import { unifiedArchiveRoutes, unifiedArchiveAllowedMethods } from "./routes/unifiedArchiveRoutes.ts";
import { authRoutes } from "./routes/authRoutes.ts"; // Import auth routes
import { createDocumentRequestRoutes } from "./routes/documentRequestRoutes.ts";
import { DocumentRequestModel } from "./models/documentRequestModel.ts";
import { DocumentRequestController } from "./controllers/documentRequestController.ts";
import { emailRoutes } from "./routes/emailRoutes.ts"; // Import email routes
import { authorVisitsRoutes, authorVisitsAllowedMethods } from "./routes/authorVisitsRoutes.ts"; // Import author visits routes
import { pageVisitsRoutes, pageVisitsAllowedMethods } from "./routes/pageVisitsRoutes.ts"; // Import page visits routes
import { systemLogsRoutes, systemLogsAllowedMethods } from "./routes/systemLogsRoutes.ts"; // Import system logs routes
import keywordsRoutes from "./routes/keywordsRoutes.ts"; // Import keywords routes
import { getCompiledDocument } from "./api/compiledDocument.ts";
import { handleGetUserProfileForNavbar } from "./api/user.ts"; // Import user profile handler
import { handleLogout } from "./routes/logout.ts"; // Import logout handler
import { handleLibraryRequest } from "./api/userLibrary.ts"; // Import user library handler
import { handleUserPasswordUpdate } from "./api/userPassword.ts"; // Import user password handler
import { handleUserProfilePictureUpload } from "./api/userProfilePicture.ts"; // Import user profile picture handler
// Import the document view controller
// TODO: Fix DocumentViewController implementation
// import { DocumentViewController } from "./controllers/documentViewController.ts";

// Import Deno standard library file API for reading migration files
// Removed - not needed after removing document views functionality

// -----------------------------
// SECTION: Configuration
// -----------------------------
const PORT = Deno.env.get("PORT") || 8000;

// -----------------------------
// SECTION: Server Setup
// -----------------------------
const app = new Application();
const router = new Router();
// Record when the server started
export const SERVER_START_TIME = Date.now();

// Setup visit counters tables if needed
async function ensureVisitCounterTablesExist() {
  try {
        
    // Document visits table
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS document_visits (
        doc_id VARCHAR(50),
        date DATE DEFAULT CURRENT_DATE,
        visitor_type VARCHAR(10) NOT NULL CHECK (visitor_type IN ('guest', 'user')),
        visit_count INT DEFAULT 1,
        PRIMARY KEY (doc_id, date, visitor_type)
      )
    `);
    
    // Author visits counter table
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS author_visits_counter (
        author_id VARCHAR(50),
        date DATE DEFAULT CURRENT_DATE,
        visitor_type VARCHAR(10) NOT NULL CHECK (visitor_type IN ('guest', 'user')),
        visit_count INT DEFAULT 1,
        PRIMARY KEY (author_id, date, visitor_type)
      )
    `);
    
    // Page visits counter table
    await client.queryObject(`
      CREATE TABLE IF NOT EXISTS page_visits_counter (
        page_path VARCHAR(255),
        date DATE DEFAULT CURRENT_DATE,
        visitor_type VARCHAR(10) NOT NULL CHECK (visitor_type IN ('guest', 'user')),
        visit_count INT DEFAULT 1,
        PRIMARY KEY (page_path, date, visitor_type)
      )
    `);
    
    // Create indexes for performance
    await client.queryObject(`
      CREATE INDEX IF NOT EXISTS idx_document_visits_date ON document_visits(date);
      CREATE INDEX IF NOT EXISTS idx_author_visits_counter_date ON author_visits_counter(date);
      CREATE INDEX IF NOT EXISTS idx_page_visits_counter_date ON page_visits_counter(date);
    `);
    
      } catch (error) {
  }
}

// Update the cachedServerStartTime in authRoutes if possible
try {
  // Use dynamic import to get the module
  import("./routes/authRoutes.ts").then(authRoutesModule => {
    // Check if the module exports a function to set server time
    if (authRoutesModule.setServerStartTime) {
      authRoutesModule.setServerStartTime(SERVER_START_TIME);
    } else {
    }
  }).catch(err => {
  });
} catch (error) {
}

// -----------------------------
// SECTION: Middleware (Optional)
// -----------------------------
// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = {
      message: "Internal server error",
      error: err.message
    };
  }
});

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  });

// Add static file serving middleware
app.use(async (ctx, next) => {
  try {
    await ctx.send({
      root: `${Deno.cwd()}/public`,
      index: "index.html",
    });
  } catch {
    await next();
  }
});

// Add static file serving middleware for admin directory
app.use(async (ctx, next) => {
  if (ctx.request.url.pathname.startsWith('/admin/')) {
    try {
      await ctx.send({
        root: `${Deno.cwd()}`,
        path: ctx.request.url.pathname,
      });
    } catch {
      await next();
    }
  } else {
    await next();
  }
});

// Add special middleware for profile pictures
app.use(async (ctx, next) => {
  // Check if the request is for a profile picture (handle both relative and absolute paths)
  if (ctx.request.url.pathname.match(/\/storage\/authors\/profile-pictures\//) || 
      ctx.request.url.pathname.match(/\/storage\/users\/profile-picture\//) ||
      ctx.request.url.pathname.match(/\/C:\/Users\/.*\/storage\/(authors\/profile-pictures|users\/profile-picture)\//)) {
    try {
      // Get the workspace root directory (parent of Deno directory)
      const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
      
      // Extract just the filename from the path
      const matches = ctx.request.url.pathname.match(/([^/\\]+)$/);
      const filename = matches ? matches[1] : null;
      
      if (!filename) {
        throw new Error("Could not extract filename from path");
      }
      
      // Determine which path to use based on the URL pattern
      let correctPath;
      if (ctx.request.url.pathname.includes('users/profile-picture')) {
        correctPath = `storage/users/profile-picture/${filename}`;
              } else {
        correctPath = `storage/authors/profile-pictures/${filename}`;
              }
      
      await ctx.send({
        root: workspaceRoot,
        path: correctPath,
      });
    } catch (err) {
      await next();
    }
  } else {
    await next();
  }
});

// Add static file serving middleware for storage directory
app.use(async (ctx, next) => {
  // Check if the request is for a file in the storage directory
  if (ctx.request.url.pathname.startsWith('/storage/')) {
    try {
      // Get the workspace root directory (parent of Deno directory)
      const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
      
      // Remove leading slash and create path relative to workspace root
      const path = ctx.request.url.pathname.substring(1);
      
      // Normalize the path to handle Windows-style paths
      const normalizedPath = path.replace(/^[A-Z]:\//, '');
            
      await ctx.send({
        root: workspaceRoot,  // Use the workspace root to find the file
        path: normalizedPath,
      });
    } catch (err) {
      await next();
    }
  } else {
    await next();
  }
});

// You can add other global middleware here (e.g., logging, body parsers, etc.)

// -----------------------------
// SECTION: Routes Setup
// -----------------------------

// Register all routes with the router
routes.forEach(route => {
  const method = route.method.toLowerCase();
  if (method === 'get') {
    router.get(route.path, route.handler);
  } else if (method === 'post') {
    router.post(route.path, route.handler);
  } else if (method === 'put') {
    router.put(route.path, route.handler);
  } else if (method === 'delete') {
    router.delete(route.path, route.handler);
  }
});

// Register email routes
emailRoutes.forEach(route => {
  const method = route.method.toLowerCase();
  if (method === 'post') {
    router.post(route.path, route.handler);
  }
});

// Add category routes
router.get("/api/category", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    method: ctx.request.method,
    headers: ctx.request.headers
  });
  
  const response = await categoryHandler(request);
  
  ctx.response.status = response.status;
  ctx.response.headers = response.headers;
  ctx.response.body = await response.json();
});

// Add count-by-category route
router.get("/api/documents/count-by-category", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    method: ctx.request.method,
    headers: ctx.request.headers
  });
  
  const response = await countByCategory(request);
  
  ctx.response.status = response.status;
  ctx.response.headers = response.headers;
  ctx.response.body = await response.json();
});

// Add document routes directly
router.get("/api/documents", async (ctx) => {
  try {
    // Extract query parameters
    const url = new URL(ctx.request.url);
    const rawPage = url.searchParams.get("page") || "1";
    const rawLimit = url.searchParams.get("size") || "10";
    const sort = url.searchParams.get("sort") || "latest";
    const category = url.searchParams.get("category") || null;
    const search = url.searchParams.get("search") || null;
    
        
    // Validate page and limit parameters
    const page = parseInt(rawPage);
    const limit = parseInt(rawLimit);
    
    if (isNaN(page) || page < 1) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid page parameter" };
      return;
    }
    
    if (isNaN(limit) || limit < 1 || limit > 50) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid limit parameter" };
      return;
    }
    
    const response = await fetchDocuments({
      page,
      limit,
      category,
      search,
      sort: sort === "latest" ? "publication_date" : "publication_date",
      order: sort === "latest" ? "DESC" : "ASC"
    });
    
        
    // Detailed logging
    if (response.documents && response.documents.length > 0) {
            response.documents.slice(0, 3).forEach(doc => {
              });
    }
    
    // Make sure all documents are filtered to exclude deleted items
    if (response.documents) {
            
      // Check for compiled documents that might be deleted
      const filteredDocuments = response.documents.filter(doc => {
        // Debug
                
        // If document has deleted_at timestamp, it should be filtered out
        if (doc.deleted_at) {
          return false;
        }
        
        // For compiled documents, check the delete status differently
        if (doc.is_compiled === true) {
                    // Only filter out if we know for sure it's deleted
          if (doc.deleted_at !== null && doc.deleted_at !== undefined) {
            return false;
          }
          // If deleted_at is null/undefined, keep the document
                    return true;
        }
        
                return true;
      });
      
      // Log any discrepancies
      if (filteredDocuments.length !== response.documents.length) {
      } else {
              }
      
      // Replace documents with filtered list
      response.documents = filteredDocuments;
    }
    
    // Return the data
    ctx.response.body = {
      documents: response.documents.map(doc => {
        // Ensure each document has author_names field populated
        let authors = [];
        if (doc.authors && Array.isArray(doc.authors)) {
          authors = doc.authors.map(a => a.full_name || `Author ${a.id}`);
        }
        
        return {
          ...doc,
          author_names: authors.length > 0 ? authors : []
        };
      }),
      totalPages: response.totalPages,
      totalDocuments: response.totalCount,
      page
    };
      } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to fetch documents",
      details: error instanceof Error ? error.message : "Unknown error"
    };
  }
});

// Add POST endpoint for document creation
router.post("/api/documents", async (ctx) => {
  try {
    // Get JSON body from request
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Convert context to Request for the handler
    const request = new Request(ctx.request.url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    // Use the document creation handler
    const response = await handleCreateDocument(request);
    
    // Set response attributes
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error.message };
  }
});

// Add endpoint for child documents
router.get("/api/documents/:id/children", async (ctx) => {
  try {
    const docId = ctx.params.id;
        
    // Convert context to Request for the controller
    const request = new Request(`${ctx.request.url.origin}/api/documents/${docId}/children`, {
      method: "GET",
      headers: ctx.request.headers
    });
    
    // Use the document controller to handle the request
    const response = await getChildDocuments(request);
    
    // Set response from controller
    ctx.response.status = response.status;
    ctx.response.headers = response.headers;
    ctx.response.body = await response.json();
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Failed to fetch child documents",
      message: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add the departments endpoint to your router
router.get("/api/departments", getDepartments);

// Add categories endpoint to router
router.get("/api/categories", getCategories);

// Add document-authors endpoint
router.get("/api/document-authors/:documentId", async (ctx) => {
  try {
    const documentId = ctx.params.documentId;
        
    // Get document authors from the controller
    const authors = await getDocumentAuthors(documentId);
    
    ctx.response.status = 200;
    ctx.response.body = {
      document_id: documentId,
      authors_count: authors.length,
      authors: authors
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to fetch document authors",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add endpoint to get all authors
router.get("/api/authors/all", async (ctx) => {
  try {
        
    // Import AuthorModel dynamically to avoid circular dependencies
    const { AuthorModel } = await import("./models/authorModel.ts");
    
    // Get all authors from the model
    const authors = await AuthorModel.getAll();
    
    // Get work counts for each author
    const authorWorksCountQuery = `
      SELECT author_id, COUNT(document_id) as works_count 
      FROM document_authors 
      GROUP BY author_id
    `;
    const authorWorksResult = await client.queryObject(authorWorksCountQuery);
    
    // Create a map of author ID to works count
    const authorWorksMap = new Map();
    authorWorksResult.rows.forEach((row: any) => {
      authorWorksMap.set(row.author_id, parseInt(row.works_count, 10));
    });
    
    // Format the data in a frontend-friendly way
    const formattedAuthors = authors.map(author => {
      // Get works count from map or default to 0
      const worksCount = authorWorksMap.get(author.id) || 0;
      
      return {
        id: author.id, // Keep the UUID as the internal ID for API calls
        spud_id: author.spud_id || '', // Include spud_id for display purposes
        full_name: author.full_name,
        department: author.department || '',
        affiliation: author.affiliation || '',
        email: author.email || '',
        bio: author.biography || '',
        profilePicUrl: author.profile_picture || '',
        // Populate with actual work count from database
        worksCount: worksCount
      };
    });
    
    ctx.response.status = 200;
    ctx.response.body = {
      count: authors.length,
      authors: formattedAuthors
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "Unknown error", 
      authors: [] 
    };
  }
});

// Add author search endpoint
router.get("/api/authors/search", async (ctx) => {
  try {
    // Get search query parameter
    const url = new URL(ctx.request.url);
    const query = url.searchParams.get("q") || '';
    
        
    if (!query) {
      ctx.response.status = 200;
      ctx.response.body = [];
      return;
    }
    
    // Import AuthorModel dynamically to avoid circular dependencies
    const { AuthorModel } = await import("./models/authorModel.ts");
    
    // Search authors with the query
    const searchSQL = `
      SELECT * FROM authors 
      WHERE full_name ILIKE $1 
      OR department ILIKE $1 
      OR affiliation ILIKE $1
      OR biography ILIKE $1
      OR email ILIKE $1
      LIMIT 10
    `;
    
    const searchParam = `%${query}%`;
    const searchResult = await client.queryObject(searchSQL, [searchParam]);
    
    // Format the search results
    const authors = searchResult.rows.map((author: any) => ({
      id: author.id,
      full_name: author.full_name,
      department: author.department || '',
      affiliation: author.affiliation || '',
      email: author.email || '',
      bio: author.biography || '',
      profile_picture: author.profile_picture || '',
    }));
    
    ctx.response.status = 200;
    ctx.response.body = authors;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
});

// Add endpoint to get works (documents) authored by a specific author
router.get("/api/authors/:authorId/works", async (ctx) => {
  const authorId = ctx.params.authorId;

  if (!authorId) {
      ctx.response.status = 400;
    ctx.response.body = { error: "Author ID is required" };
      return;
    }
    
    
  try {
    // Get document IDs authored by this author
    const docIds = await AuthorModel.getDocuments(authorId);

    // Get full document details for each ID
    const works = [];
    for (const docId of docIds) {
      const doc = await DocumentModel.getById(docId);
      if (doc) {
                
        // Get topics for this document
        const topicsQuery = `
          SELECT ra.id, ra.name
          FROM research_agenda ra
          JOIN document_research_agenda dra ON ra.id = dra.research_agenda_id
          WHERE dra.document_id = $1
        `;
        try {
          const topicsResult = await client.queryObject(topicsQuery, [docId]);
          // Add topics to document using type assertion
          (doc as any).topics = topicsResult.rows.map((topic: any) => ({
            id: topic.id,
            name: topic.name || '',
          }));
                  } catch (error) {
          (doc as any).topics = [];
        }

        // Get category directly from document_type field
        let categoryName = 'N/A';
        if (doc.document_type) {
          // Convert document_type enum to a readable category name
          switch(doc.document_type) {
            case 'THESIS':
              categoryName = 'Thesis';
              break;
            case 'DISSERTATION':
              categoryName = 'Dissertation';
              break;
            case 'CONFLUENCE':
              categoryName = 'Confluence';
              break;
            case 'SYNERGY':
              categoryName = 'Synergy';
              break;
            default:
              categoryName = doc.document_type;
          }
                  }

        // If no topics, but we might have research agendas elsewhere
        // Skip the category_research_agenda query since that table doesn't exist

        // Format work for frontend consumption
        works.push({
          id: doc.id,
          title: doc.title,
          // Format dates based on document type
          year: formatDocumentDate(doc),
          category: categoryName,
          // Join research agenda topics for display
          researchAgenda: (doc as any).topics && (doc as any).topics.length > 0 
            ? (doc as any).topics.map((t: any) => t.name).join(', ') 
            : 'N/A',
          // Add URL for document viewing if needed
          url: `/document/${doc.id}`,
          // Include original document data if needed
          document: doc
        });
      }
    }

    // Helper function to format document dates based on type
    function formatDocumentDate(doc: any): string {
            
      // For single documents (THESIS or DISSERTATION) with publication date
      if (doc.publication_date && (doc.document_type === 'THESIS' || doc.document_type === 'DISSERTATION')) {
        try {
          const date = new Date(doc.publication_date);
          // Format as Month Year (e.g., "May 2023")
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch (e) {
          return String(doc.publication_date);
        }
      }
      
      // For compiled documents (CONFLUENCE or SYNERGY) with start and end years
      if ((doc.document_type === 'CONFLUENCE' || doc.document_type === 'SYNERGY')) {
        if (doc.start_year && doc.end_year) {
          return `${doc.start_year} - ${doc.end_year}`;
        } else if (doc.start_year) {
          return String(doc.start_year);
        }
      }
      
      // Fallback: Use any available date info
      if (doc.publication_date) {
        try {
          const date = new Date(doc.publication_date);
          return date.getFullYear().toString();
        } catch (e) {
          return String(doc.publication_date);
        }
      } else if (doc.start_year) {
        return String(doc.start_year);
      }
      
      return 'N/A';
    }

    ctx.response.status = 200;
    ctx.response.body = {
      authorId,
      works_count: works.length,
      worksCount: works.length, // Include both formats for backward compatibility
      works,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: 'Failed to fetch author works',
      details: error instanceof Error ? error.message : String(error),
    };
  }
});

// Check and synchronize compiled document authors
router.get("/api/compiled-documents/:compiledDocId/sync-authors", async (ctx) => {
  const compiledDocId = ctx.params.compiledDocId;

  if (!compiledDocId) {
      ctx.response.status = 400;
    ctx.response.body = { error: "Compiled document ID is required" };
      return;
    }
    
    
  try {
    // Get child documents for this compiled document
    const childDocsResponse = await fetchChildDocuments(compiledDocId);
    const childDocs = childDocsResponse.documents;

    if (!childDocs || childDocs.length === 0) {
    ctx.response.status = 200;
      ctx.response.body = { 
        message: 'No child documents found for this compiled document',
        compiledDocId,
        childCount: 0
      };
      return;
    }

    // Track all authors across all child documents
    const authorMap = new Map();
    
    // Process each child document to collect all authors
    for (const doc of childDocs) {
            
      // Process each author of this document
      for (const author of doc.authors) {
        if (!authorMap.has(author.id)) {
          // Store the author ID and name if we haven't seen this author before
          authorMap.set(author.id, author.full_name);
        }
      }
    }

    // Convert the author map to an array
    const uniqueAuthors = Array.from(authorMap).map(([id, name]) => ({
      id,
      full_name: name
    }));

    
    ctx.response.status = 200;
    ctx.response.body = {
      compiledDocId,
      childCount: childDocs.length,
      authorCount: uniqueAuthors.length,
      authors: uniqueAuthors,
      status: 'success'
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: 'Failed to synchronize compiled document authors',
      details: error instanceof Error ? error.message : String(error),
    };
  }
});

// Add endpoint to update author information
router.put("/api/authors/:authorId", async (ctx) => {
  const authorId = ctx.params.authorId;
  
  if (!authorId) {
      ctx.response.status = 400;
    ctx.response.body = { error: "Author ID is required" };
      return;
    }
    
  try {
    // Parse the request body
    const body = ctx.request.body();
    if (body.type !== "json") {
      ctx.response.status = 400;
      ctx.response.body = { error: "Request body must be JSON" };
      return;
    }
    
    const authorData = await body.value;
    
    // Check if the author exists
    const existingAuthor = await AuthorModel.getById(authorId);
    if (!existingAuthor) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Author not found" };
      return;
    }
    
    // If trying to change ID, check if the new ID already exists
    if (authorData.newId && authorData.newId !== authorId) {
      const duplicateCheck = await AuthorModel.getById(authorData.newId);
      if (duplicateCheck) {
        ctx.response.status = 409; // Conflict
        ctx.response.body = { error: "The new ID is already in use" };
        return;
      }
    }
    
    // Prepare update data
    const updateData: any = {
      full_name: authorData.full_name || authorData.full_name,
      department: authorData.department || null,
      affiliation: authorData.affiliation || null,
      email: authorData.email || null,
      biography: authorData.bio || null,
      profile_picture: authorData.profilePicUrl || null
    };
    
    // Add spud_id to update data if provided
    if (authorData.spud_id !== undefined) {
      updateData.spud_id = authorData.spud_id || null;
    }
    
    // Update the author in the database
    await AuthorModel.update(authorId, updateData);
    
    // Handle ID change if requested
    if (authorData.newId && authorData.newId !== authorId) {
      await AuthorModel.updateId(authorId, authorData.newId);
    }
    
    // Return the updated author
    const updatedAuthor = await AuthorModel.getById(authorData.newId || authorId);
    
    ctx.response.status = 200;
    ctx.response.body = {
      message: "Author updated successfully",
      author: updatedAuthor
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: error instanceof Error ? error.message : "Unknown error" };
  }
});

// Add authors endpoint
router.post("/api/document-research-agenda/link", async (ctx) => {
  try {
    const body = await ctx.request.body({ type: "json" }).value;
    
    if (!body.document_id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Document ID is required" };
      return;
    }
    
    if (!body.agenda_items || !Array.isArray(body.agenda_items) || body.agenda_items.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "At least one agenda item is required" };
      return;
    }
    
        
    const result = await ResearchAgendaModel.linkItemsToDocumentByName(
      parseInt(body.document_id.toString()),
      body.agenda_items
    );
    
    if (result.success) {
    ctx.response.status = 200;
    ctx.response.body = { 
        message: `Linked ${result.linkedIds.length} research agenda items to document ${body.document_id}`,
        linked_items: result.linkedIds
      };
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to link research agenda items to document" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Failed to link research agenda items",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Register document author routes
app.use(documentAuthorRoutes.routes());
app.use(documentAuthorRoutes.allowedMethods());

// Register file routes
app.use(fileRoutes.routes());
app.use(fileRoutes.allowedMethods());

// Register upload routes
app.use(uploadRoutes.routes());
app.use(uploadRoutesAllowedMethods);

// Add router to app
app.use(router.routes());
app.use(router.allowedMethods());

// Add Author routes
app.use(authorRoutes);

// Add Research Agenda routes
app.use(researchAgendaRoutes);

// Register unified archive routes
app.use(unifiedArchiveRoutes);
app.use(unifiedArchiveAllowedMethods);

// Log that unified archive API is available

// -----------------------------
// SECTION: Document Metadata Update Route
// -----------------------------
// Add a route to update document metadata after processing
router.put("/api/documents/:id/metadata", async (ctx) => {
  try {
    const id = ctx.params.id;
    
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Document ID is required" };
      return;
    }
    
    // Get request body
    const body = await ctx.request.body({ type: "json" }).value;
    
    // Create a request to the document update endpoint
    const updateRequest = new Request(`${ctx.request.url.origin}/documents/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    
    // Forward to the document update handler
    const updateResponse = await fetch(updateRequest);
    
    // Return the response
    ctx.response.status = updateResponse.status;
    ctx.response.body = await updateResponse.json();
    
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Failed to update document metadata",
      details: error.message
    };
  }
});

// -----------------------------
// SECTION: Directory Management Route
// -----------------------------
// Add a route to ensure directories exist
router.post("/api/ensure-directory", async (ctx) => {
  try {
    // Get the path from request body
    const body = await ctx.request.body({ type: "json" }).value;
    const { path } = body;
    
    if (!path) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Path is required" };
      return;
    }
    
    // Prevent access to sensitive directories
    if (path.includes("..") || !path.startsWith("storage/")) {
      ctx.response.status = 403;
      ctx.response.body = { error: "Invalid directory path" };
      return;
    }
    
        
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
    
    // Make sure path is relative to workspace root, not inside Deno directory
    let fullPath = path;
    if (path.includes("Deno/storage/")) {
      fullPath = path.replace("Deno/storage/", "storage/");
          }
    
    // Create absolute path from workspace root
    const absolutePath = join(workspaceRoot, fullPath);
        
    // Create the directory
    await ensureDir(absolutePath);
    
    // Verify directory was created
    try {
      const stat = await Deno.stat(absolutePath);
      if (!stat.isDirectory) {
        throw new Error(`Path exists but is not a directory: ${absolutePath}`);
      }
          } catch (verifyError: unknown) {
      const errorMessage = verifyError instanceof Error ? verifyError.message : String(verifyError);
      throw new Error(`Failed to verify directory: ${errorMessage}`);
    }
    
    ctx.response.status = 200;
    ctx.response.body = { 
      message: "Directory created successfully",
      path: fullPath
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Failed to create directory",
      details: errorMessage
    };
  }
});

// -----------------------------
// SECTION: Directory Setup
// -----------------------------
// Create required directories for storage
async function setupDirectories() {
    
  try {
    // Get the workspace root directory (parent of Deno directory)
    const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
        
    // Create main storage directory at the workspace root level
    const storageBase = join(workspaceRoot, 'storage');
    await ensureDir(storageBase);
        
    // Create only the necessary document type directories
    const directories = [
      join(storageBase, 'thesis'),
      join(storageBase, 'dissertation'),
      join(storageBase, 'confluence'),
      join(storageBase, 'synergy'),
      join(storageBase, 'hello'),
      join(storageBase, 'authors', 'profile-pictures') // Updated path to match existing structure
    ];
    
    // Create all directories
    for (const dir of directories) {
      await ensureDir(dir);
          }
    
        
    // List the directories that were created to verify
    try {
            for await (const entry of Deno.readDir(storageBase)) {
        if (entry.isDirectory) {
                  }
      }
    } catch (listError) {
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create storage directories: ${errorMessage}`);
  }
}

// Function to run database migrations
// Removed - related to document views functionality
// async function runMigrations() {
//   //   
//   try {
//     // Document Views table
//     //     const documentViewsMigration = await readTextFile("./db/migrations/document_views_table.sql");
//     await client.queryArray(documentViewsMigration);
//     
//     // Call the migration function
//     await client.queryArray("SELECT migrate_document_views()");
//     
//     //   } catch (error) {
//     console.error("[DATABASE] Error running migrations:", error);
//   }
// }

// -----------------------------
// SECTION: Server Startup
// -----------------------------
async function startServer() {
    
  try {
    // Create necessary directories
    await setupDirectories();
    
    // Connect to the database
        await connectToDb();
        
    // Run database diagnostics
    await diagnoseDatabaseIssues();
    
    // Ensure the visit counter tables exist
    await ensureVisitCounterTablesExist();
    
    // Register routes with the application
    app.use(router.routes());
    app.use(router.allowedMethods());
    
    // Register author visits routes
        app.use(authorVisitsRoutes);
    app.use(authorVisitsAllowedMethods);
    
    // Register page visits routes
        app.use(pageVisitsRoutes);
    app.use(pageVisitsAllowedMethods);
    
    // Register system logs routes
        app.use(systemLogsRoutes);
    app.use((ctx, next) => {
      if (ctx.request.method === "OPTIONS" && 
          ctx.request.url.pathname.startsWith("/api/system-logs")) {
        ctx.response.status = 204;
        
        // Add CORS headers
        ctx.response.headers.set("Access-Control-Allow-Origin", "*");
        ctx.response.headers.set("Access-Control-Allow-Methods", systemLogsAllowedMethods.join(", "));
        ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
        
        return;
      }
      return next();
    });
    
    // Register keywords routes
        app.use(keywordsRoutes.routes());
    app.use(keywordsRoutes.allowedMethods());
    
    // Register reports routes
        app.use(reportsRoutes.routes());
    app.use(reportsRoutes.allowedMethods());
    
    // Custom 404 handler - must be added last in the middleware chain
    app.use(async (ctx) => {
      // This middleware will only be reached if no other middleware handled the request
            
      try {
        // Set status to 404
        ctx.response.status = 404;
        
        // Check if the request accepts HTML
        const acceptHeader = ctx.request.headers.get("accept") || "";
        
        if (acceptHeader.includes("text/html")) {
          // For HTML requests, serve the custom 404 page
          // Use normalized path to handle case-sensitivity across environments
          const customErrorPath = `${Deno.cwd()}/Public/pages/miscellaneous/404.html`;
          try {
            // Normalize the path to handle different file systems
                        const content = await Deno.readTextFile(customErrorPath);
            ctx.response.type = "text/html";
            ctx.response.body = content;
          } catch (e: unknown) {
            // Try alternative path with lowercase
            try {
              const lowerCasePath = `${Deno.cwd()}/public/pages/miscellaneous/404.html`;
                            const content = await Deno.readTextFile(lowerCasePath);
              ctx.response.type = "text/html";
              ctx.response.body = content;
            } catch (innerE: unknown) {
              // Fallback to simple text response if file can't be read
              ctx.response.type = "text/plain";
              ctx.response.body = "404 - Page Not Found";
            }
          }
        } else {
          // For API requests, return JSON
          ctx.response.type = "application/json";
          ctx.response.body = { 
            error: "Not Found", 
            message: "The requested resource could not be found",
            path: ctx.request.url.pathname 
          };
        }
      } catch (err: unknown) {
        ctx.response.status = 500;
        ctx.response.body = "Internal Server Error";
      }
    });
    
    // Start the server
        await app.listen({ port: Number(PORT) });
  } catch (error) {
    Deno.exit(1);
  }
}

router.get('/api/affiliations', async (ctx) => {
  try {
    // Get distinct affiliations from authors table
    const result = await client.queryObject(
      "SELECT DISTINCT affiliation FROM authors WHERE affiliation IS NOT NULL ORDER BY affiliation"
    );
    
    ctx.response.status = 200;
    ctx.response.type = "json";
    ctx.response.body = result.rows.map((row: any) => row.affiliation);
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.type = "json";
    ctx.response.body = { error: error instanceof Error ? error.message : "Unknown error" };
  }
});

// Add a server ping endpoint for client health checks
router.get("/ping", (ctx) => {
    ctx.response.status = 200;
    ctx.response.body = {
        status: "ok",
        serverStartTime: SERVER_START_TIME
    };
});

// Initialize document request system
const documentRequestModel = new DocumentRequestModel(client);
const documentRequestController = new DocumentRequestController(documentRequestModel);
const documentRequestRoutes = createDocumentRequestRoutes(documentRequestController);

// Add document request routes
app.use(documentRequestRoutes.routes());
app.use(documentRequestRoutes.allowedMethods());

// Add an endpoint to view email logs for document requests (admin only)
router.get("/api/email-logs", async (ctx) => {
  try {
    // Get user info from auth header
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized: Authentication required" };
      return;
    }
    
    // Extract token
    const token = authHeader.split(" ")[1];
    
    // Check if user is admin
    try {
      // We'll use the verification function from authRoutes
      const { verifySession } = await import("./routes/authRoutes.ts");
      const session = await verifySession(token);
      
      if (!session || session.role !== "admin") {
        ctx.response.status = 403;
        ctx.response.body = { error: "Forbidden: Admin access required" };
        return;
      }
    } catch (err) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid authentication token" };
      return;
    }
    
    // Get date from query parameter or use today
    const url = new URL(ctx.request.url);
    const dateParam = url.searchParams.get("date");
    const date = dateParam || new Date().toISOString().split('T')[0];
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid date format. Please use YYYY-MM-DD format" };
      return;
    }
    
    // Construct log file path
    const logFile = `./logs/email-activity-${date}.log`;
    
    try {
      // Check if file exists
      await Deno.stat(logFile);
    } catch (error) {
      ctx.response.status = 404;
      ctx.response.body = { 
        error: `No log file found for ${date}`,
        date: date
      };
      return;
    }
    
    // Read log file
    const logContent = await Deno.readTextFile(logFile);
    
    // Parse logs
    const logEntries = logContent
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
    
    // Filter for document sending activities
    const documentActivities = logEntries.filter(entry => 
      entry.action.startsWith('DOCUMENT_')
    );
    
    // Calculate statistics
    const successful = documentActivities.filter(e => e.action === 'DOCUMENT_SENT_SUCCESS').length;
    const failed = documentActivities.filter(e => 
      e.action === 'DOCUMENT_SENT_FAILURE' || e.action === 'DOCUMENT_SENT_ERROR'
    ).length;
    
    // Return logs and statistics
    ctx.response.status = 200;
    ctx.response.body = {
      date: date,
      total: documentActivities.length,
      successful: successful,
      failed: failed,
      logs: documentActivities
    };
    
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { 
      error: "Server error while retrieving email logs",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add a route for getting a compiled document by ID
router.get("/api/compiled-documents/:id", async (ctx) => {
  try {
    const id = parseInt(ctx.params.id);
    if (isNaN(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid ID" };
      return;
    }
    
    // Fetch the compiled document
    const compiledDoc = await getCompiledDocument(id);
    if (!compiledDoc) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Compiled document not found" };
      return;
    }
    
    // Get child documents
    let childDocs = [];
    try {
      const childDocsResponse = await fetchChildDocuments(id);
      childDocs = childDocsResponse.documents || [];
    } catch (childError) {
    }
    
    // Fetch authors for the document if they're not already included
    let authors = [];
    try {
      // Authors might already be included in the document
      if (compiledDoc.authors && Array.isArray(compiledDoc.authors)) {
        authors = compiledDoc.authors;
      } else {
        // Try to fetch authors separately
        const authorsData = await getDocumentAuthors(id);
        authors = authorsData || [];
      }
    } catch (authorError) {
    }
    
    // Combine all data
    const result = {
      ...compiledDoc,
      authors: authors,
      child_documents: childDocs
    };
    
        
    ctx.response.body = result;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch compiled document" };
  }
});

// Add a route for getting detailed compiled document information with visit statistics
router.get("/api/compiled-documents/:id/details", async (ctx) => {
  try {
    const id = parseInt(ctx.params.id);
    if (isNaN(id)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid ID" };
      return;
    }
    
    // Import the PageVisitsModel dynamically
    const { PageVisitsModel } = await import("./models/pageVisitsModel.ts");
    
    // Fetch the compiled document
    const compiledDoc = await getCompiledDocument(id);
    if (!compiledDoc) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Compiled document not found" };
      return;
    }
    
    // Get visit statistics for the compiled document
    let visitStats = { total: 0, guest: 0, user: 0 };
    try {
      visitStats = await PageVisitsModel.getDocumentVisitCounters(id.toString());
    } catch (visitError) {
    }
    
    // Get child documents
    let childDocs = [];
    try {
      const childDocsResponse = await fetchChildDocuments(id);
      childDocs = childDocsResponse.documents || [];
      
      // For each child document, fetch visit statistics
      for (let i = 0; i < childDocs.length; i++) {
        const childDoc = childDocs[i];
        const childId = childDoc.id;
        
        if (childId) {
          try {
            const childVisitStats = await PageVisitsModel.getDocumentVisitCounters(childId.toString());
            childDoc.visit_count = childVisitStats.total || 0;
            childDoc.guest_count = childVisitStats.guest || 0;
            childDoc.user_count = childVisitStats.user || 0;
          } catch (childVisitError) {
            childDoc.visit_count = 0;
            childDoc.guest_count = 0;
            childDoc.user_count = 0;
          }
        }
      }
      
      // Sort child documents by visit count (descending)
      childDocs.sort((a, b) => (b.visit_count || 0) - (a.visit_count || 0));
      
    } catch (childError) {
    }
    
    // Fetch authors for the document if they're not already included
    let authors = [];
    try {
      // Authors might already be included in the document
      if (compiledDoc.authors && Array.isArray(compiledDoc.authors)) {
        authors = compiledDoc.authors;
      } else {
        // Try to fetch authors separately
        const authorsData = await getDocumentAuthors(id);
        authors = authorsData || [];
      }
    } catch (authorError) {
    }
    
    // Combine all data
    const result = {
      ...compiledDoc,
      authors: authors,
      child_documents: childDocs,
      visit_count: visitStats.total || 0,
      guest_count: visitStats.guest || 0,
      user_count: visitStats.user || 0
    };
    
        
    ctx.response.body = result;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch compiled document details" };
  }
});

// Add a new endpoint specifically for compiled document children
router.get("/api/compiled-documents/:id/children", async (ctx) => {
  try {
    const id = ctx.params.id;
        
    if (!id) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Compiled document ID is required" };
      return;
    }
    
    // Get the category parameter if specified in the request
    const url = new URL(ctx.request.url);
    const categoryParam = url.searchParams.get('category');
        
    // Fetch child documents
    const childDocumentsResponse = await fetchChildDocuments(id);
    let childDocuments = childDocumentsResponse.documents || [];
    
    // If we have a category parameter and child documents, filter by category
    if (categoryParam && childDocuments.length > 0) {
            const originalCount = childDocuments.length;
      
      // Convert category param to uppercase for case-insensitive comparison
      const targetCategory = categoryParam.toUpperCase();
      
      childDocuments = childDocuments.filter(doc => {
        const docType = (doc.document_type || '').toUpperCase();
        // Keep documents matching the target category
        return docType === targetCategory;
      });
      
          }
    
    // Process and enhance child documents if needed
    const enhancedChildren = await Promise.all(childDocuments.map(async (doc) => {
      try {
        // If authors aren't included, try to fetch them
        if (!doc.authors || doc.authors.length === 0) {
          try {
            const authors = await getDocumentAuthors(String(doc.id));
            doc.authors = authors || [];
          } catch (err) {
          }
        }
        
        // Return enhanced document with file path format fixed if needed
        return {
          ...doc,
          file_path: doc.file_path && !doc.file_path.startsWith('/') ? `/${doc.file_path}` : doc.file_path,
          document_type: doc.document_type || categoryParam // Use category param as fallback if document_type is missing
        };
      } catch (docError) {
        return doc;
      }
    }));
    
        
    ctx.response.status = 200;
    ctx.response.body = { 
      parent_id: id,
      category: categoryParam,
      children: enhancedChildren,
      count: enhancedChildren.length
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to fetch child documents",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Also add an alias to support the /compiled-documents/:id/children endpoint that the frontend tries
router.get("/compiled-documents/:id/children", async (ctx) => {
  // Redirect to the API version of the endpoint
  const id = ctx.params.id;
    
  try {
    // Reuse the same handler as the API endpoint
    const apiRequest = new Request(`${ctx.request.url.origin}/api/compiled-documents/${id}/children`, {
      method: "GET",
      headers: ctx.request.headers
    });
    
    // Forward to the main handler
    const apiResponse = await fetch(apiRequest);
    
    // Return the response data
    ctx.response.status = apiResponse.status;
    ctx.response.headers = apiResponse.headers;
    ctx.response.body = await apiResponse.json();
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to fetch child documents", 
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Register user profile endpoint for the navbar
router.get("/api/user/profile", async (ctx) => {
  const request = new Request(ctx.request.url.toString(), {
    method: ctx.request.method,
    headers: ctx.request.headers
  });
  
  const response = await handleGetUserProfileForNavbar(request);
  
  ctx.response.status = response.status;
  ctx.response.headers = response.headers;
  ctx.response.body = await response.json();
  
  });

// Register user password update endpoint
router.put("/api/user/profile/password", async (ctx) => {
  try {
        
    // Convert Oak request to standard Request
    const headers = new Headers(ctx.request.headers);
    
    // Create body from the request
    let body = null;
    if (ctx.request.hasBody) {
      const reqBody = ctx.request.body({ type: "json" });
      body = await reqBody.value;
    }
    
    // Create a Request object
    const request = new Request(ctx.request.url.toString(), {
      method: "PUT",
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // Process through the API handler
    const response = await handleUserPasswordUpdate(request);
    
    // Set status and headers
    ctx.response.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      ctx.response.headers.set(key, value);
    }
    
    // Set body
    if (response.status !== 204) {
      const responseBody = await response.text();
      try {
        // Try to parse as JSON first
        const jsonBody = JSON.parse(responseBody);
        ctx.response.body = jsonBody;
      } catch {
        // If not JSON, use as is
        ctx.response.body = responseBody;
      }
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error processing password update",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Register profile picture upload endpoint
router.post("/api/user/profile/picture", async (ctx) => {
  try {
        
    // Directly call the handler with the context
    await handleUserProfilePictureUpload(ctx);
    
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error processing profile picture upload",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Register logout endpoint 
router.post("/logout", async (ctx) => {
    
  const request = new Request(ctx.request.url.toString(), {
    method: "POST",
    headers: ctx.request.headers
  });
  
  const response = await handleLogout(request);
  
  ctx.response.status = response.status;
  
  // Copy all headers from the response
  for (const [key, value] of response.headers.entries()) {
    ctx.response.headers.set(key, value);
  }
  
  if (response.status === 302) {
      } else {
  }
});

// Also handle GET requests to /logout (for direct link access)
router.get("/logout", async (ctx) => {
    
  const request = new Request(ctx.request.url.toString(), {
    method: "GET",
    headers: ctx.request.headers
  });
  
  const response = await handleLogout(request);
  
  ctx.response.status = response.status;
  
  // Copy all headers from the response
  for (const [key, value] of response.headers.entries()) {
    ctx.response.headers.set(key, value);
  }
  
  if (response.status === 302) {
      } else {
  }
});

// Add route for most visited documents
router.get("/api/documents/most-visited", async (ctx) => {
  try {
        
    // Extract query parameters
    const url = new URL(ctx.request.url);
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const days = parseInt(url.searchParams.get("days") || "30");
    
    // Use the PageVisitsModel to get most visited documents
    const { PageVisitsModel } = await import("./models/pageVisitsModel.ts");
    const documents = await PageVisitsModel.getMostVisitedDocuments(limit, days);
    
        
    // Format response to match expected format in frontend
    ctx.response.status = 200;
    ctx.response.body = { 
      documents: documents.map(doc => ({
        document_id: doc.document_id,
        id: doc.document_id, // Add id as an alias for document_id
        title: doc.title || 'Untitled Document',
        document_type: doc.document_type || 'single',
        visit_count: doc.visit_count,
        last_visit_date: doc.last_visit_date
      }))
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Add route for recording document view
router.post("/api/document-views", async (ctx) => {
  try {
        // TODO: Fix DocumentViewController implementation
    // const request = new Request(ctx.request.url.toString(), {
    //   method: ctx.request.method,
    //   headers: ctx.request.headers,
    //   body: ctx.request.hasBody ? await ctx.request.body({ type: "json" }).value : undefined
    // });
    
    // const response = await DocumentViewController.recordView(request);
    
    // ctx.response.status = response.status;
    // ctx.response.headers = response.headers;
    // ctx.response.body = await response.json();
    
    // Temporary mock response
    ctx.response.status = 200;
    ctx.response.body = { success: true };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Add route for getting document view statistics
router.get("/api/document-views/stats", async (ctx) => {
  try {
        // TODO: Fix DocumentViewController implementation
    // const request = new Request(ctx.request.url.toString(), {
    //   method: ctx.request.method,
    //   headers: ctx.request.headers
    // });
    
    // const response = await DocumentViewController.getStats(request);
    
    // ctx.response.status = response.status;
    // ctx.response.headers = response.headers;
    // ctx.response.body = await response.json();
    
    // Temporary mock response
    ctx.response.status = 200;
    ctx.response.body = { stats: {} };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Add endpoint to fetch the foreword specifically for a category type of compiled document
router.get("/api/compiled-documents/:id/foreword", async (ctx) => {
  const id = ctx.params.id;
  
  if (!id) {
    ctx.response.status = 400;
    ctx.response.body = { error: "Compiled document ID is required" };
    return;
  }
  
  try {
    // Parse the URL to check for the category query parameter
    const url = new URL(ctx.request.url);
    const categoryParam = url.searchParams.get('category');
    const format = url.searchParams.get('format') || 'auto'; // Get format parameter
    
        
    // First, get the category of the compiled document from the database
    const categoryQuery = `
      SELECT category 
      FROM compiled_documents 
      WHERE id = $1
    `;
    
    const categoryResult = await client.queryObject(categoryQuery, [id]);
    
    if (!categoryResult.rowCount || categoryResult.rowCount === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Compiled document with ID ${id} not found` };
      return;
    }
    
    // Get the category from the database result
    const dbCategory = (categoryResult.rows[0] as any).category;
    
    // Use the explicitly provided category parameter if available, otherwise use the database value
    const category = categoryParam || dbCategory;
        
    // Fetch the foreword file path from the compiled_documents table
    const forewordQuery = `
      SELECT foreword
      FROM compiled_documents
      WHERE id = $1
    `;
    
    const forewordResult = await client.queryObject(forewordQuery, [id]);
    
    if (!forewordResult.rowCount || forewordResult.rowCount === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `Foreword for compiled document with ID ${id} not found` };
      return;
    }
    
    // Get the foreword path
    const forewordPath = (forewordResult.rows[0] as any).foreword;
    
    if (!forewordPath) {
      ctx.response.status = 404;
      ctx.response.body = { error: `No foreword file path defined for compiled document with ID ${id}` };
      return;
    }
    
        
    // Try to load the foreword file
    try {
      // Get the workspace root directory (parent of Deno directory)
      const workspaceRoot = Deno.cwd().replace(/[\\/]Deno$/, '');
      
      // Remove any leading slash from the path if present
      const normalizedPath = forewordPath.startsWith('/') ? forewordPath.substring(1) : forewordPath;
      
      // Create absolute path from workspace root
      const absolutePath = join(workspaceRoot, normalizedPath);
            
      // Check if the file exists
      await Deno.stat(absolutePath);
      
      // Check if the file is a PDF based on extension
      const isPdf = normalizedPath.toLowerCase().endsWith('.pdf');
      
      // If it's a PDF and format isn't explicitly set to 'json', serve it directly with the proper content type
      if (isPdf && format !== 'json') {
                
        // Set PDF content type header
        ctx.response.headers.set('Content-Type', 'application/pdf');
        
        // Disable cache for development ease
        ctx.response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        ctx.response.headers.set('Pragma', 'no-cache');
        ctx.response.headers.set('Expires', '0');
        
        // Read and serve the file directly
        const file = await Deno.readFile(absolutePath);
        ctx.response.body = file;
        return;
      }
      
      // If not a PDF or format is explicitly 'json', return as text in JSON
      const forewordContent = await Deno.readTextFile(absolutePath);
      
      // Return the foreword content
      ctx.response.status = 200;
      ctx.response.body = {
        category: category,
        foreword: forewordContent,
        foreword_path: forewordPath
      };
    } catch (fileError) {
      ctx.response.status = 404;
      ctx.response.body = { 
        error: `Failed to read foreword file for compiled document ${id}`,
        details: fileError instanceof Error ? fileError.message : String(fileError)
      };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to fetch foreword for compiled document",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add route for user library
router.all("/api/user/library(/.*)?", async (ctx) => {
  try {
        
    // Convert Oak request to standard Request
    const headers = new Headers(ctx.request.headers);
    
    // Create body if needed
    let body = null;
    if (ctx.request.hasBody) {
      const reqBody = ctx.request.body({ type: "json" });
      body = await reqBody.value;
    }
    
    // Create a Request object
    const request = new Request(ctx.request.url.toString(), {
      method: ctx.request.method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // Process through the API handler
    const response = await handleLibraryRequest(request);
    
    // Set status and headers
    ctx.response.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      ctx.response.headers.set(key, value);
    }
    
    // Set body
    if (response.status !== 204) {
      const responseBody = await response.text();
      try {
        // Try to parse as JSON first
        const jsonBody = JSON.parse(responseBody);
        ctx.response.body = jsonBody;
      } catch {
        // If not JSON, use as is
        ctx.response.body = responseBody;
      }
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error processing user library request",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add endpoint to save compiled documents to user's library
router.post("/api/compiled-documents/save-to-library", async (ctx) => {
  try {
        
    // Verify user authentication
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }
    
    // Extract token
    const token = authHeader.split(" ")[1];
    
    // Import verification function
    try {
      // Import verification function dynamically
      const { verifySessionToken } = await import("./utils/sessionUtils.ts");
      const session = await verifySessionToken(token);
      
      if (!session) {
        ctx.response.status = 401;
        ctx.response.body = { error: "Invalid or expired token" };
        return;
      }
      
      // Get user ID from session
      const userId = session.id;
      
      // Get document ID from request body
      const body = await ctx.request.body({ type: "json" }).value;
      
      if (!body.documentId) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Document ID is required" };
        return;
      }
      
      const documentId = parseInt(String(body.documentId), 10);
      
      if (isNaN(documentId)) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Invalid document ID" };
        return;
      }
      
            
      // Import the UserLibraryModel dynamically
      const { UserLibraryModel } = await import("./models/userLibraryModel.ts");
      
      // Check if the document is already in the library
      const isInLibrary = await UserLibraryModel.isInLibrary(userId, documentId);
      
      if (isInLibrary) {
        ctx.response.status = 200;
        ctx.response.body = {
          success: true,
          message: "Document is already in your library",
          inLibrary: true,
          count: await UserLibraryModel.getLibraryCount(userId)
        };
        return;
      }
      
      // Add the document to the library
      const result = await UserLibraryModel.addToLibrary(userId, documentId);
      
      if (result) {
        // Get the updated library count
        const libraryCount = await UserLibraryModel.getLibraryCount(userId);
        
        ctx.response.status = 200;
        ctx.response.body = {
          success: true,
          message: "Compiled document added to library successfully",
          count: libraryCount
        };
      } else {
        throw new Error("Failed to add compiled document to library");
      }
    } catch (authError) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication failed" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to add compiled document to library",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Also add a matching endpoint for the alternative method
router.post("/api/library/save-compiled", async (ctx) => {
  try {
        
    // Verify user authentication
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
      return;
    }
    
    // Extract token
    const token = authHeader.split(" ")[1];
    
    // Import verification function dynamically
    const { verifySessionToken } = await import("./utils/sessionUtils.ts");
    const session = await verifySessionToken(token);
    
    if (!session) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid or expired token" };
      return;
    }
    
    // Get user ID from session
    const userId = session.id;
    
    // Get document ID from request body
    const body = await ctx.request.body({ type: "json" }).value;
    
    if (!body.compiledDocumentId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Compiled document ID is required" };
      return;
    }
    
    const documentId = parseInt(String(body.compiledDocumentId), 10);
    
    if (isNaN(documentId)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid document ID" };
      return;
    }
    
        
    // Import the UserLibraryModel dynamically
    const { UserLibraryModel } = await import("./models/userLibraryModel.ts");
    
    // Check if the document is already in the library
    const isInLibrary = await UserLibraryModel.isInLibrary(userId, documentId);
    
    if (isInLibrary) {
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Document is already in your library",
        inLibrary: true,
        count: await UserLibraryModel.getLibraryCount(userId)
      };
      return;
    }
    
    // Add the document to the library
    const result = await UserLibraryModel.addToLibrary(userId, documentId);
    
    if (result) {
      // Get the updated library count
      const libraryCount = await UserLibraryModel.getLibraryCount(userId);
      
      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Compiled document added to library successfully via alternative method",
        count: libraryCount
      };
    } else {
      throw new Error("Failed to add compiled document to library");
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Failed to add compiled document to library",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Import user document history handlers
import { 
  handleDocumentViewRecording, 
  handleDocumentDownloadRecording, 
  handleUserHistoryRequest 
} from "./api/userDocumentHistory.ts";

// Add route for analytics document view recording
router.post("/api/analytics/document-view", async (ctx) => {
  try {
        
    // Convert Oak request to standard Request
    const headers = new Headers(ctx.request.headers);
    
    // Create body if needed
    let body = null;
    if (ctx.request.hasBody) {
      const reqBody = ctx.request.body({ type: "json" });
      body = await reqBody.value;
    }
    
    // Create a Request object
    const request = new Request(ctx.request.url.toString(), {
      method: ctx.request.method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // Process through the API handler
    const response = await handleDocumentViewRecording(request);
    
    // Set status and headers
    ctx.response.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      ctx.response.headers.set(key, value);
    }
    
    // Set body
    if (response.status !== 204) {
      const responseBody = await response.text();
      try {
        // Try to parse as JSON first
        const jsonBody = JSON.parse(responseBody);
        ctx.response.body = jsonBody;
      } catch {
        // If not JSON, use as is
        ctx.response.body = responseBody;
      }
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error recording document view",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add route for analytics document download recording
router.post("/api/analytics/document-download", async (ctx) => {
  try {
        
    // Convert Oak request to standard Request
    const headers = new Headers(ctx.request.headers);
    
    // Create body if needed
    let body = null;
    if (ctx.request.hasBody) {
      const reqBody = ctx.request.body({ type: "json" });
      body = await reqBody.value;
    }
    
    // Create a Request object
    const request = new Request(ctx.request.url.toString(), {
      method: ctx.request.method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    // Process through the API handler
    const response = await handleDocumentDownloadRecording(request);
    
    // Set status and headers
    ctx.response.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      ctx.response.headers.set(key, value);
    }
    
    // Set body
    if (response.status !== 204) {
      const responseBody = await response.text();
      try {
        // Try to parse as JSON first
        const jsonBody = JSON.parse(responseBody);
        ctx.response.body = jsonBody;
      } catch {
        // If not JSON, use as is
        ctx.response.body = responseBody;
      }
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error recording document download",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add route for user history
router.get("/api/user/history", async (ctx) => {
  try {
        
    // Convert Oak request to standard Request
    const headers = new Headers(ctx.request.headers);
    
    // Create a Request object
    const request = new Request(ctx.request.url.toString(), {
      method: ctx.request.method,
      headers: headers
    });
    
    // Process through the API handler
    const response = await handleUserHistoryRequest(request);
    
    // Set status and headers
    ctx.response.status = response.status;
    for (const [key, value] of response.headers.entries()) {
      ctx.response.headers.set(key, value);
    }
    
    // Set body
    if (response.status !== 204) {
      const responseBody = await response.text();
      try {
        // Try to parse as JSON first
        const jsonBody = JSON.parse(responseBody);
        ctx.response.body = jsonBody;
      } catch {
        // If not JSON, use as is
        ctx.response.body = responseBody;
      }
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Internal server error fetching user document history",
      details: error instanceof Error ? error.message : String(error)
    };
  }
});

// Add route for getting multiple documents by IDs
router.post("/api/documents/by-ids", async (ctx) => {
  try {
    if (!ctx.request.hasBody) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Request body is required" };
      return;
    }
    
    // Parse the request body to get the document IDs
    const body = await ctx.request.body({ type: "json" }).value;
    
    if (!body.documentIds || !Array.isArray(body.documentIds) || body.documentIds.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Document IDs array is required" };
      return;
    }
    
        
    // Query the database for the documents
    const query = `
      SELECT id, title, document_type, abstract, publication_date, 
             file_path, is_public, created_at, updated_at
      FROM documents
      WHERE id = ANY($1::int[])
      AND deleted_at IS NULL
    `;
    
    const result = await client.queryObject(query, [body.documentIds]);
    
        
    // Map the results to the expected format
    const documents = result.rows.map((row: any) => ({
      id: row.id,
      title: row.title || 'Untitled Document',
      document_type: row.document_type || 'single',
      abstract: row.abstract,
      publication_date: row.publication_date,
      file_path: row.file_path,
      is_public: row.is_public,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    // Return the documents
    ctx.response.status = 200;
    ctx.response.body = { documents };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Serve PDF files with proper content type
router.get(/\.(pdf)$/i, async (ctx) => {
  try {
    const urlPath = ctx.request.url.pathname;
        
    // Map URL path to file system path
    let filePath = urlPath;
    
    // Resolve relative to workspace root
    if (filePath.startsWith('/storage/')) {
      filePath = filePath.substring(1); // Remove leading slash
    } else if (filePath.startsWith('/files/') || filePath.startsWith('/uploads/')) {
      filePath = filePath.substring(1); // Remove leading slash
    }
    
    // Get absolute path
    const absolutePath = join(Deno.cwd(), '..', filePath);
        
    try {
      // Check if file exists
      await Deno.stat(absolutePath);
      
      // Set PDF content type header
      ctx.response.headers.set('Content-Type', 'application/pdf');
      
      // Disable cache for development ease
      ctx.response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      ctx.response.headers.set('Pragma', 'no-cache');
      ctx.response.headers.set('Expires', '0');
      
      // Send the file
      const file = await Deno.readFile(absolutePath);
      ctx.response.body = file;
      
    } catch (err: unknown) {
      ctx.response.status = 404;
      ctx.response.body = { error: 'PDF file not found' };
    }
  } catch (error: unknown) {
    ctx.response.status = 500;
    ctx.response.body = { error: 'Internal server error' };
  }
});

// Start the server
await startServer();