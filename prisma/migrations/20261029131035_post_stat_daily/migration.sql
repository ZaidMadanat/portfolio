-- CreateTable
CREATE TABLE "PostStatDaily" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PostStatDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostStatDaily_day_idx" ON "PostStatDaily"("day");

-- CreateIndex
CREATE UNIQUE INDEX "PostStatDaily_postId_day_key" ON "PostStatDaily"("postId", "day");

-- AddForeignKey
ALTER TABLE "PostStatDaily" ADD CONSTRAINT "PostStatDaily_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
