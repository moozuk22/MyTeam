CREATE TABLE training_plan_price_revisions (
 revision serial NOT NULL UNIQUE,
 id uuid PRIMARY KEY, billing_mode text NOT NULL CHECK(billing_mode IN ('monthly','yearly','lifetime')), effective_month varchar(7) NOT NULL, UNIQUE(effective_month,billing_mode),
 monthly numeric(10,2) CHECK(monthly>0), yearly numeric(10,2) CHECK(yearly>0), lifetime numeric(10,2) CHECK(lifetime>0),
 actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE club_training_plan_subscriptions (
 club_id uuid PRIMARY KEY REFERENCES clubs(id) ON DELETE CASCADE,
 free_enabled boolean NOT NULL DEFAULT false, billing_mode text NOT NULL DEFAULT 'monthly' CHECK(billing_mode IN ('monthly','yearly','lifetime')), version integer NOT NULL DEFAULT 1
);
CREATE TABLE club_training_plan_prices (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_training_plan_subscriptions(club_id) ON DELETE CASCADE,
 billing_mode text NOT NULL CHECK(billing_mode IN ('monthly','yearly','lifetime')), effective_month varchar(7) NOT NULL, amount numeric(10,2) CHECK(amount>0), UNIQUE(club_id,billing_mode,effective_month)
);
CREATE TABLE club_training_plan_payments (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_training_plan_subscriptions(club_id) ON DELETE CASCADE,
 billing_mode text NOT NULL CHECK(billing_mode IN ('monthly','yearly','lifetime')), paid_on varchar(10) NOT NULL,
 note text, total numeric(14,2) NOT NULL CHECK(total>0), request jsonb NOT NULL,
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, voided_at timestamptz, voided_by text
);
CREATE INDEX club_training_plan_payments_club_id_created_at_idx ON club_training_plan_payments(club_id,created_at);
CREATE TABLE club_training_plan_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES club_training_plan_subscriptions(club_id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('paid','free')), starts_at timestamptz NOT NULL, ends_at timestamptz,
 revoked_at timestamptz, payment_id uuid REFERENCES club_training_plan_payments(id) ON DELETE CASCADE, amount numeric(10,2),
 CHECK(ends_at IS NULL OR ends_at>=starts_at), CHECK((kind='paid')=(payment_id IS NOT NULL))
);
CREATE INDEX club_training_plan_grants_club_id_starts_at_idx ON club_training_plan_grants(club_id,starts_at);
CREATE TABLE club_training_plan_changes (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES club_training_plan_subscriptions(club_id) ON DELETE CASCADE,
 actor_id text NOT NULL, action text NOT NULL, details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX club_training_plan_changes_club_id_created_at_idx ON club_training_plan_changes(club_id,created_at);

