ALTER TABLE "clubs"
ADD COLUMN "default_payment_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE "players"
ADD COLUMN "payment_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE "clubs"
ADD CONSTRAINT "clubs_default_payment_amount_nonnegative"
CHECK ("default_payment_amount" >= 0);

ALTER TABLE "players"
ADD CONSTRAINT "players_payment_amount_nonnegative"
CHECK ("payment_amount" >= 0);
