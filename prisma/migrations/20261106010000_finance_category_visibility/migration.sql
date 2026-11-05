ALTER TABLE "club_finance_categories"
  ADD COLUMN "hidden_for_expense" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "hidden_for_revenue" BOOLEAN NOT NULL DEFAULT false;

-- Preserve categories hidden before visibility became independent by entry kind.
UPDATE "club_finance_categories"
SET "hidden_for_expense" = true, "hidden_for_revenue" = true
WHERE NOT "is_active";
