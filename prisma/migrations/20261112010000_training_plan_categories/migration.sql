CREATE TABLE "training_plan_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "club_id" UUID,
  "name" TEXT NOT NULL,
  "name_key" TEXT NOT NULL,
  CONSTRAINT "training_plan_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_plan_categories_club_id_fkey"
    FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "training_plan_categories_club_id_name_key_key"
  ON "training_plan_categories" ("club_id", "name_key");
CREATE UNIQUE INDEX "training_plan_categories_default_name_key"
  ON "training_plan_categories" ("name_key") WHERE "club_id" IS NULL;

INSERT INTO "training_plan_categories" ("name", "name_key") VALUES
  ('Загрявка', 'загрявка'),
  ('Техника', 'техника'),
  ('Тактика', 'тактика'),
  ('Физическа подготовка', 'физическа подготовка'),
  ('Вратари', 'вратари'),
  ('Статични положения', 'статични положения'),
  ('Игрови упражнения', 'игрови упражнения');

ALTER TABLE "training_plans" ADD COLUMN "category_id" UUID;
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "training_plan_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "training_plans_club_id_category_id_updated_at_id_idx"
  ON "training_plans" ("club_id", "category_id", "updated_at", "id");
CREATE INDEX "training_plans_category_id_idx" ON "training_plans" ("category_id");
