/** Minimal PostgreSQL tables for the image storage integration checks. */
export const imageTestSchema = `
CREATE TABLE clubs (id uuid PRIMARY KEY);
CREATE TABLE training_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title text NOT NULL, description text, requirements text, category_id uuid, layout jsonb NOT NULL,
  created_by_user_id uuid, created_by_coach_group_id uuid, creator_name text, updated_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE training_plan_documents (
  id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE, owner_id text NOT NULL, origin_key text,
  title text NOT NULL, content jsonb NOT NULL, revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
`;

export function imageMigrationStatements(sql: string) {
  const functions: string[] = [];
  const masked = sql.replace(/\$\$[\s\S]*?\$\$/g, (body) => {
    functions.push(body);
    return `__BODY_${functions.length - 1}__`;
  });
  return masked.split(";").filter((part) => part.trim()).map((part) =>
    part.replace(/__BODY_(\d+)__/g, (_, index: string) => functions[Number(index)]));
}
