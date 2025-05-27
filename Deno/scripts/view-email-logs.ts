/**
 * Command-line tool to view email activity logs
 * 
 * Run with: deno run --allow-read scripts/view-email-logs.ts [date]
 * Where [date] is an optional date in YYYY-MM-DD format (defaults to today)
 */

const LOGS_DIR = "./logs";

// Get date parameter or use today
const dateParam = Deno.args[0];
const date = dateParam || new Date().toISOString().split('T')[0];

// Validate date format
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  Deno.exit(1);
}

// Construct log file path
const logFile = `${LOGS_DIR}/email-activity-${date}.log`;


try {
  // Check if file exists
  try {
    await Deno.stat(logFile);
  } catch (error) {
    Deno.exit(1);
  }
  
  // Read log file
  const logContent = await Deno.readTextFile(logFile);
  
  // Parse and display logs
  const logEntries = logContent
    .split('\n')
    .filter(line => line.trim())
    .map(line => JSON.parse(line));
  
  // Filter for document sending activities
  const documentActivities = logEntries.filter(entry => 
    entry.action.startsWith('DOCUMENT_')
  );
  
  if (documentActivities.length === 0) {
        Deno.exit(0);
  }
  
    
  // Display document activities in a formatted way
  documentActivities.forEach((entry, index) => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    
            
    if (entry.recipient) {
          }
    
    if (entry.document) {
          }
    
    if (entry.document_path) {
          }
    
    if (entry.file_size !== undefined) {
          }
    
    if (entry.error) {
          }
    
      });
  
  // Display success/failure summary
  const successful = documentActivities.filter(e => e.action === 'DOCUMENT_SENT_SUCCESS').length;
  const failed = documentActivities.filter(e => 
    e.action === 'DOCUMENT_SENT_FAILURE' || e.action === 'DOCUMENT_SENT_ERROR'
  ).length;
  
          
} catch (error: unknown) {
  Deno.exit(1);
}

/**
 * Format file size in a human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
} 