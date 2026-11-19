-- AlterTable
ALTER TABLE "training_plans" ADD COLUMN     "background_image_id" UUID;

-- CreateTable
CREATE TABLE "training_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "club_id" UUID NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "bytes" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_document_images" (
    "document_id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "club_id" UUID NOT NULL,

    CONSTRAINT "training_document_images_pkey" PRIMARY KEY ("document_id","image_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_images_club_id_sha256_key" ON "training_images"("club_id", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "training_images_id_club_id_key" ON "training_images"("id", "club_id");

-- CreateIndex
CREATE INDEX "training_document_images_image_id_idx" ON "training_document_images"("image_id");

-- CreateIndex
CREATE INDEX "training_plans_background_image_id_idx" ON "training_plans"("background_image_id");

-- CreateIndex
CREATE UNIQUE INDEX "training_plan_documents_id_club_id_key" ON "training_plan_documents"("id", "club_id");

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_background_image_id_club_id_fkey" FOREIGN KEY ("background_image_id", "club_id") REFERENCES "training_images"("id", "club_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_images" ADD CONSTRAINT "training_images_club_id_fkey" FOREIGN KEY ("club_id") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_document_images" ADD CONSTRAINT "training_document_images_document_id_club_id_fkey" FOREIGN KEY ("document_id", "club_id") REFERENCES "training_plan_documents"("id", "club_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_document_images" ADD CONSTRAINT "training_document_images_image_id_club_id_fkey" FOREIGN KEY ("image_id", "club_id") REFERENCES "training_images"("id", "club_id") ON DELETE NO ACTION ON UPDATE NO ACTION;


-- Keep the existing JPEG size limit and prevent changes to shared image bytes.
ALTER TABLE training_images ADD CONSTRAINT training_images_jpeg_check
  CHECK (octet_length(bytes) BETWEEN 3 AND 196608 AND substring(bytes FROM 1 FOR 3) = decode('ffd8ff', 'hex'));

CREATE FUNCTION prevent_training_image_changes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Training images are immutable';
END;
$$;
CREATE TRIGGER training_images_immutable BEFORE UPDATE ON training_images
  FOR EACH ROW EXECUTE FUNCTION prevent_training_image_changes();
