ALTER TABLE "club_finance_categories"
  ADD COLUMN "expense_sort_order" INTEGER NOT NULL DEFAULT 2147483647,
  ADD COLUMN "revenue_sort_order" INTEGER NOT NULL DEFAULT 2147483647;

-- Both lists initially retain the existing shared order.
UPDATE "club_finance_categories"
SET "expense_sort_order" = "sort_order", "revenue_sort_order" = "sort_order";
