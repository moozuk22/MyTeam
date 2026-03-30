CREATE TABLE "admin_notifications" (
    "id" TEXT NOT NULL,
    "club_id" UUID NOT NULL,
    "player_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_notifications_club_id_sent_at_idx" ON "admin_notifications"("club_id", "sent_at");
CREATE INDEX "admin_notifications_club_id_read_at_idx" ON "admin_notifications"("club_id", "read_at");
CREATE INDEX "admin_notifications_club_id_player_id_idx" ON "admin_notifications"("club_id", "player_id");

ALTER TABLE "admin_notifications"
ADD CONSTRAINT "admin_notifications_club_id_fkey"
FOREIGN KEY ("club_id") REFERENCES "clubs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_notifications"
ADD CONSTRAINT "admin_notifications_player_id_fkey"
FOREIGN KEY ("player_id") REFERENCES "players"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
