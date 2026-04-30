ALTER TABLE "coach_groups"
  ADD COLUMN "training_weekdays"    INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "training_dates"       TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "training_time"        TEXT,
  ADD COLUMN "training_date_times"  JSONB,
  ADD COLUMN "training_window_days" INTEGER   NOT NULL DEFAULT 30;
