import { PeasSearchInput } from "../../components/forms/PeasSearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import type { DocumentFilterState } from "../../lib/api/types";
import { CategoryFilterBar } from "./CategoryFilterBar";
import type { CategoryCount } from "../../lib/api/types";
import type { DocumentCategory } from "../../lib/constants/categories";

interface DocumentToolbarProps {
  filter: DocumentFilterState;
  categories: CategoryCount[];
  onSearchChange: (value: string) => void;
  onSortChange: (value: "latest" | "earliest") => void;
  onCategoryChange: (category: DocumentCategory) => void;
}

export function DocumentToolbar({
  filter,
  categories,
  onSearchChange,
  onSortChange,
  onCategoryChange,
}: DocumentToolbarProps) {
  return (
    <section className="peas-documents-toolbar" aria-labelledby="documents-categories-title">
      <div className="peas-documents-toolbar__header">
        <h2 id="documents-categories-title">Categories</h2>
        <div className="peas-documents-toolbar__controls">
          <PeasSearchInput
            value={filter.search}
            placeholder="Search documents..."
            aria-label="Search documents"
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            onClear={() => onSearchChange("")}
          />
          <Select value={filter.sort} onValueChange={(value) => onSortChange(value as "latest" | "earliest")}>
            <SelectTrigger aria-label="Sort documents" className="peas-sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest to Earliest</SelectItem>
              <SelectItem value="earliest">Earliest to Latest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <CategoryFilterBar
        categories={categories}
        selectedCategory={filter.category}
        onSelectCategory={onCategoryChange}
      />
    </section>
  );
}
