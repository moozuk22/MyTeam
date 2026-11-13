BEGIN;

LOCK TABLE "training_plans", "training_plan_categories" IN SHARE ROW EXCLUSIVE MODE;

INSERT INTO "training_plan_categories" ("name", "name_key") VALUES
  ('Атака', 'атака'),
  ('Защита', 'защита'),
  ('Преход атака в защита', 'преход атака в защита'),
  ('Преход защита в атака', 'преход защита в атака'),
  ('Статични положения', 'статични положения')
ON CONFLICT ("name_key") WHERE "club_id" IS NULL DO NOTHING;

-- Retain retired defaults as club categories wherever a plan still uses them.
INSERT INTO "training_plan_categories" ("club_id", "name", "name_key")
SELECT DISTINCT p."club_id", c."name", c."name_key"
FROM "training_plans" p
JOIN "training_plan_categories" c ON c."id" = p."category_id"
WHERE c."club_id" IS NULL
  AND c."name_key" IN ('загрявка', 'техника', 'тактика', 'физическа подготовка', 'вратари', 'игрови упражнения')
ON CONFLICT ("club_id", "name_key") DO NOTHING;

UPDATE "training_plans" p
SET "category_id" = custom."id",
    "updated_at" = GREATEST(CURRENT_TIMESTAMP, p."updated_at" + INTERVAL '1 millisecond')
FROM "training_plan_categories" shared
JOIN "training_plan_categories" custom ON custom."name_key" = shared."name_key"
WHERE shared."club_id" IS NULL
  AND shared."name_key" IN ('загрявка', 'техника', 'тактика', 'физическа подготовка', 'вратари', 'игрови упражнения')
  AND p."category_id" = shared."id"
  AND custom."club_id" = p."club_id";

DELETE FROM "training_plan_categories"
WHERE "club_id" IS NULL
  AND "name_key" IN ('загрявка', 'техника', 'тактика', 'физическа подготовка', 'вратари', 'игрови упражнения');

COMMIT;
