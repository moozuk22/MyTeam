-- History of messages that admins and coaches sent. Only the sender reads it.
CREATE TYPE "sent_message_audience" AS ENUM ('players', 'coaches');

CREATE TABLE "sent_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sender_user_id" TEXT NOT NULL,
    "audience" "sent_message_audience" NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" TEXT,
    "club_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "coach_group_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    "recipient_count" INTEGER NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sent_message_recipients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "message_id" UUID NOT NULL,
    "player_id" UUID,
    "player_name" TEXT NOT NULL,

    CONSTRAINT "sent_message_recipients_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sent_messages_sender_user_id_sent_at_id_idx" ON "sent_messages"("sender_user_id", "sent_at" DESC, "id" DESC);
CREATE INDEX "sent_messages_club_ids_idx" ON "sent_messages" USING GIN ("club_ids");
CREATE INDEX "sent_messages_coach_group_ids_idx" ON "sent_messages" USING GIN ("coach_group_ids");
CREATE INDEX "sent_message_recipients_message_id_idx" ON "sent_message_recipients"("message_id");
CREATE INDEX "sent_message_recipients_player_id_message_id_idx" ON "sent_message_recipients"("player_id", "message_id");

ALTER TABLE "sent_message_recipients" ADD CONSTRAINT "sent_message_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "sent_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sent_message_recipients" ADD CONSTRAINT "sent_message_recipients_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;
