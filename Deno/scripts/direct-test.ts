import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// Use the email that worked in GMass test
const EMAIL = "christianjames2212003@gmail.com"; 
const PASSWORD = "gjox pkdu xasv yudj "; // Replace with your actual password


let client: SMTPClient | null = null;

try {
  // Initialize client
  client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: EMAIL,
        password: PASSWORD,
      },
    },
  });
  
      
  // Make sure from and to are properly formatted
  await client.send({
    from: EMAIL, // This should be a valid email address
    to: "officeresearch520@gmail.com",
    subject: "Direct SMTP Test",
    content: "This is a direct test email"
  });
  
  } catch (error: unknown) {
  // Additional debug info
} finally {
  // Only close the client if it was successfully initialized
  if (client) {
    try {
      await client.close();
          } catch (closeError: unknown) {
      console.error("Error closing connection:", 
        closeError instanceof Error ? closeError.message : String(closeError));
    }
  }
}