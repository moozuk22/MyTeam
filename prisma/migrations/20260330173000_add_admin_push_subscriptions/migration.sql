CREATE TABLE "admin_push_subscriptions" (
    "id" TEXT NOT NULL,
    "club_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "device" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_push_subscriptions_club_id_endpoint_key"
    ON "admin_push_subscriptions"("club_id", "endpoint");

CREATE INDEX "admin_push_subscriptions_club_id_is_active_idx"
    ON "admin_push_subscriptions"("club_id", "is_active");

ALTER TABLE "admin_push_subscriptions"
    ADD CONSTRAINT "admin_push_subscriptions_club_id_fkey"
    FOREIGN KEY ("club_id")
    REFERENCES "clubs"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
