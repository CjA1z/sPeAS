/**
 * Simple SMTP connection test script
 * Run with: deno run --allow-env --allow-net --allow-read scripts/test-smtp.ts
 */

// Import SMTP client
import { SMTPClient } from "../deps.ts";

// Get SMTP configuration from environment variables
const EMAIL_CONFIG = {
  hostname: Deno.env.get("SMTP_HOST") || "smtp.gmail.com",
  port: parseInt(Deno.env.get("SMTP_PORT") || "465"),
  username: Deno.env.get("SMTP_USERNAME") || "",
  password: Deno.env.get("SMTP_PASSWORD") || "",
  useTLS: Deno.env.get("SMTP_TLS") !== "false",
};

// Function to test SMTP connection
async function testSMTPConnection() {
  try {
    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: EMAIL_CONFIG.hostname,
        port: EMAIL_CONFIG.port,
        tls: EMAIL_CONFIG.useTLS,
        auth: {
          username: EMAIL_CONFIG.username,
          password: EMAIL_CONFIG.password,
        },
      },
    });

    // Ask if user wants to send a test email
    const response = prompt("Enter Y to send or any other key to exit: ");

    if (response?.toLowerCase() === "y") {
      // Ask for recipient email
      const recipient = prompt("Enter recipient email address: ");

      if (!recipient) {
        Deno.exit(1);
      }

      // Send a test email
      await client.send({
        from: EMAIL_CONFIG.username,
        to: recipient,
        subject: "SMTP Test Email",
        content: "This is a test email to verify SMTP configuration.",
        html:
          "<h1>SMTP Test</h1><p>This is a test email to verify SMTP configuration.</p>",
      });
    }

    // Close client connection
    await client.close();
  } catch (_error: unknown) {
    Deno.exit(1);
  }
}

// Run the test
await testSMTPConnection();
