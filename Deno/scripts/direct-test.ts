import { SMTPClient } from "../deps.ts";

const EMAIL = Deno.env.get("SMTP_USERNAME") || "";
const PASSWORD = Deno.env.get("SMTP_PASSWORD") || "";
const HOSTNAME = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
const PORT = parseInt(Deno.env.get("SMTP_PORT") || "465");
const RECIPIENT = Deno.env.get("SMTP_TEST_RECIPIENT") || EMAIL;

if (!EMAIL || !PASSWORD || !RECIPIENT) {
  throw new Error(
    "Set SMTP_USERNAME, SMTP_PASSWORD, and optionally SMTP_TEST_RECIPIENT before running this script.",
  );
}

let client: SMTPClient | null = null;

try {
  // Initialize client
  client = new SMTPClient({
    connection: {
      hostname: HOSTNAME,
      port: PORT,
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
    to: RECIPIENT,
    subject: "Direct SMTP Test",
    content: "This is a direct test email",
  });
} catch (_error: unknown) {
  // Additional debug info
} finally {
  // Only close the client if it was successfully initialized
  if (client) {
    try {
      await client.close();
    } catch (closeError: unknown) {
      console.error(
        "Error closing connection:",
        closeError instanceof Error ? closeError.message : String(closeError),
      );
    }
  }
}
