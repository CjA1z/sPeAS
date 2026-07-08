import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import "./styles/globals.css";

void mountPublicIsland("react-public-home-root", async () => {
  const { PublicHomePage } = await import("./features/public/PublicHomePage");
  return <PublicHomePage />;
});

void mountPublicIsland("react-public-search-root", async () => {
  const { PublicSearchPage } = await import("./features/public/PublicSearchPage");
  return <PublicSearchPage />;
});

void mountPublicIsland("react-public-news-root", async () => {
  const { PublicNewsPage } = await import("./features/public/PublicNewsPage");
  return <PublicNewsPage />;
});

async function mountPublicIsland(rootId: string, load: () => Promise<ReactElement>) {
  const root = document.getElementById(rootId);
  if (!root) return;

  createRoot(root).render(await load());
}
