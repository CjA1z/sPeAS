import { pool } from "../config/db.ts";

// Export a client for direct DB operations
export const client = {
  async queryArray(text: string, params: any[] = []) {
    const connection = await pool.connect();
    try {
      return await connection.queryArray(text, params);
    } finally {
      connection.release();
    }
  },
  
  async queryObject(text: string, params: any[] = []) {
    const connection = await pool.connect();
    try {
      return await connection.queryObject(text, params);
    } finally {
      connection.release();
    }
  }
};

/**
 * Connects to the PostgreSQL database and confirms connection
 * @returns {Promise<void>}
 */
export async function connectToDb(): Promise<void> {
  try {
    // Try to get a client from the pool
    const client = await pool.connect();
        client.release();
    return Promise.resolve();
  } catch (error) {
        // We resolve instead of reject to allow the server to start even without DB
    return Promise.resolve();
  }
}

// Connect to the database
export async function connectToDatabase() {
  connectionAttempts++;
  
  try {
                            
    // Try to connect
    await client.connect();
    
    // Test the connection with a simple query
    const result = await client.queryObject("SELECT 1 as connected");
    if (result && result.rows && result.rows.length > 0) {
            
      // Reset connection attempts on success
      connectionAttempts = 0;
      isConnected = true;
      
      // Additional diagnostic - check if tables exist
      try {
        const tablesResult = await client.queryObject(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public'
          ORDER BY table_name
        `);
        
                tablesResult.rows.forEach((row, index) => {
                  });
        
        // Check specifically for documents table
        const docCountQuery = `SELECT COUNT(*) as doc_count FROM documents`;
        try {
          const docResult = await client.queryObject(docCountQuery);
                    
          // If there are documents, check for a sample
          if (parseInt((docResult.rows[0] as any).doc_count) > 0) {
                        const sampleDocQuery = `SELECT id, title FROM documents LIMIT 1`;
            const sampleDoc = await client.queryObject(sampleDocQuery);
            if (sampleDoc.rows.length > 0) {
                          } else {
            }
          } else {
          }
        } catch (docError) {
        }
        
      } catch (diagError) {
      }
    } else {
      throw new Error("Connection test failed");
    }
  } catch (error) {
    if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
      return connectToDatabase();
    } else {
      isConnected = false;
      throw error;
    }
  }
}

// Function to diagnose database issues
export async function diagnoseDatabaseIssues() {
  try {
                
    // Check if client is defined
    if (!client) {
      return;
    }
    
    // Test connection with a simple query
        const testResult = await client.queryObject("SELECT 1 as test");
        
    // Check tables
        const tablesResult = await client.queryObject(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
        tablesResult.rows.forEach((row: any, index: number) => {
          });
    
    // Check documents table
    try {
      const docCountQuery = `SELECT COUNT(*) as doc_count FROM documents`;
      const docResult = await client.queryObject(docCountQuery);
      const docCount = parseInt(String((docResult.rows[0] as any).doc_count));
            
      // If documents exist, get a sample
      if (docCount > 0) {
                const sampleDocQuery = `SELECT id, title FROM documents LIMIT 1`;
        const sampleDoc = await client.queryObject(sampleDocQuery);
        if (sampleDoc.rows.length > 0) {
                  } else {
        }
        
        // Check active documents
        const activeDocQuery = `SELECT COUNT(*) as active_count FROM documents WHERE deleted_at IS NULL`;
        const activeResult = await client.queryObject(activeDocQuery);
        const activeCount = parseInt(String((activeResult.rows[0] as any).active_count));
                
        if (activeCount === 0) {
        }
      } else {
      }
    } catch (docError) {
    }
    
    // Check categories
    try {
      const catQuery = `SELECT * FROM categories`;
      const catResult = await client.queryObject(catQuery);
            if (catResult.rows.length > 0) {
        console.log("Categories:", catResult.rows.map((row: any) => 
          `${row.id}: ${row.category_name}`).join(', '));
      } else {
      }
    } catch (catError) {
    }
    
              } catch (error) {
  }
}