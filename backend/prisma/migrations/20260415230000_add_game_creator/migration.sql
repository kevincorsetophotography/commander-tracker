ALTER TABLE "Game" ADD COLUMN "createdByUserId" INTEGER;

CREATE INDEX "Game_createdByUserId_idx" ON "Game"("createdByUserId");
