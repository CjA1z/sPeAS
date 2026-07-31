import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { AdminLayout } from "./components/layout/AdminLayout";
import "./styles/globals.css";

void mountAdminIsland("react-documents-admin-root", async () => {
  const { DocumentsAdminPage } = await import("./features/documents/DocumentsAdminPage");
  return (
    <AdminLayout>
      <DocumentsAdminPage />
    </AdminLayout>
  );
});

void mountAdminIsland("react-upload-admin-root", async () => {
  const { UploadDocumentPage } = await import("./features/upload/UploadDocumentPage");
  return (
    <AdminLayout>
      <UploadDocumentPage />
    </AdminLayout>
  );
});

void mountAdminIsland("react-archive-admin-root", async () => {
  const { ArchiveDocumentsPage } = await import("./features/archive/ArchiveDocumentsPage");
  return (
    <AdminLayout>
      <ArchiveDocumentsPage />
    </AdminLayout>
  );
});

void mountAdminIsland("react-permissions-admin-root", async () => {
  const { DocumentPermissionsPage } = await import("./features/permissions/DocumentPermissionsPage");
  return (
    <AdminLayout>
      <DocumentPermissionsPage />
    </AdminLayout>
  );
});

void mountAdminIsland("react-news-admin-root", async () => {
  const { AdminNewsPage } = await import("./features/news/AdminNewsPage");
  return (
    <AdminLayout>
      <AdminNewsPage />
    </AdminLayout>
  );
});

void mountAdminIsland("react-contact-inquiries-admin-root", async () => {
  const { AdminContactInquiriesPage } = await import("./features/contact/AdminContactInquiriesPage");
  return (
    <AdminLayout>
      <AdminContactInquiriesPage />
    </AdminLayout>
  );
});

async function mountAdminIsland(rootId: string, load: () => Promise<ReactElement>) {
  const root = document.getElementById(rootId);
  if (!root) return;

  createRoot(root).render(await load());
}
