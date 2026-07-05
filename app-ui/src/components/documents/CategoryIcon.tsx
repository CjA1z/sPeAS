import { BookOpen, GraduationCap, LayoutGrid, Newspaper, ScrollText } from "lucide-react";
import type { DocumentCategory } from "../../lib/constants/categories";

interface CategoryIconProps {
  category: DocumentCategory;
}

export function CategoryIcon({ category }: CategoryIconProps) {
  if (category === "THESIS") return <ScrollText aria-hidden="true" />;
  if (category === "DISSERTATION") return <GraduationCap aria-hidden="true" />;
  if (category === "CONFLUENCE") return <Newspaper aria-hidden="true" />;
  if (category === "SYNERGY") return <BookOpen aria-hidden="true" />;
  return <LayoutGrid aria-hidden="true" />;
}
