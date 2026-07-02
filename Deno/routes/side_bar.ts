import { Router } from "../deps.ts";
import { client } from "../db/denopost_conn.ts";

const router = new Router();

router.get("/sidebar", async (context) => {
  try {
    // Get user session (assuming session ID is in cookies)
    const cookies = context.request.headers.get("cookie") || "";
    const sessionToken = cookies.match(/session_token=([^;]+)/)?.[1];

    if (!sessionToken) {
      context.response.status = 401;
      context.response.body = "Unauthorized";
      return;
    }

    // Fetch user role from the active session
    const result = await client.queryObject(
      `
      SELECT COALESCE(r.role_name, 'User') AS role
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
      [sessionToken],
    );

    if (result.rowCount === 0) {
      context.response.status = 401;
      context.response.body = "Invalid session";
      return;
    }

    const row = result.rows[0] as { role?: string };
    const userRole = String(row.role || "user").toLowerCase();

    // Sidebar items based on role
    const sidebarItems = [
      {
        href: "/admin/dashboard.html",
        text: "Dashboard",
        icon: "layout-dashboard",
      },
      {
        href: "/admin/Components/documents_page.html",
        text: "Documents List",
        icon: "folders",
      },
      {
        href: "/admin/Components/admin_logs.html",
        text: "System Logs",
        icon: "logs",
        roles: ["admin"],
      },
      {
        href: "/admin/Components/add_author.html",
        text: "Add New Author",
        icon: "pencil-plus",
        roles: ["admin"],
      },
      {
        href: "/admin/Components/create_news.html",
        text: "Create News Article",
        icon: "news",
        roles: ["admin"],
      },
      {
        href: "/admin/Components/document_permissions.html",
        text: "Document Permissions",
        icon: "lock-access",
        roles: ["admin"],
      },
      { href: "/admin/profile.html", text: "Profile", icon: "settings" },
      { href: "/logout", text: "Logout", icon: "logout-2" },
    ];

    // Filter items based on role
    const filteredSidebar = sidebarItems.filter((item) => {
      if (!item.roles) return true;
      return item.roles.map((role) => role.toLowerCase()).includes(userRole);
    });

    context.response.body = filteredSidebar;
  } catch (_error) {
    context.response.status = 500;
    context.response.body = "Internal Server Error";
  }
});

export default router;
