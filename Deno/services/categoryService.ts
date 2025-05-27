/**
 * Fetches all categories and their document counts
 * @returns Array of categories with counts
 */
export async function getAllCategories(): Promise<CategoryWithCount[]> {
  try {
        
    // Get the count of documents by document_type
    const query = `
      SELECT 
        document_type as name, 
        COUNT(*) as count
      FROM 
        documents 
      WHERE 
        is_deleted = false
      GROUP BY 
        document_type
      ORDER BY 
        document_type
    `;
    
        const result = await client.queryObject(query);
    
    if (!result.rows || result.rows.length === 0) {
            return [];
    }
    
        
    // Map the results to our interface
    const categories = result.rows.map((row: any) => ({
      name: row.name || '',
      count: parseInt(row.count, 10) || 0
    }));
    
        return categories;
  } catch (error) {
    return [];
  }
} 