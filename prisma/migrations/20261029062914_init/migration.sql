-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('NOTES', 'STATISTICS', 'COMPUTER_SCIENCE', 'PHILOSOPHY', 'FILM', 'FOOD', 'MUSIC', 'PROJECTS');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('FOOD', 'FILM', 'ALBUM', 'CONCERT');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('SAN_FRANCISCO', 'EAST_BAY', 'NORTH_BAY', 'PENINSULA', 'SOUTH_BAY');

-- CreateEnum
CREATE TYPE "FilmEntryType" AS ENUM ('WATCH', 'REVIEW');

-- CreateEnum
CREATE TYPE "FavoriteKind" AS ENUM ('FILM', 'ALBUM');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('LETTERBOXD', 'STATSFM', 'STRAVA', 'HOUSEKEEPING');

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "coverMediaId" TEXT,
    "blocks" JSONB NOT NULL,
    "html" TEXT NOT NULL DEFAULT '',
    "category" "Category" NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "templateId" TEXT,
    "reviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "postId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("postId","mediaId")
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTag" (
    "postId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postId","tagId")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "category" "Category",
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "kind" "ReviewKind" NOT NULL,
    "title" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "cuisine" TEXT,
    "price" INTEGER,
    "neighbourhood" TEXT,
    "city" TEXT,
    "region" "Region",
    "filmLogId" TEXT,
    "artist" TEXT,
    "year" INTEGER,
    "coverUrl" TEXT,
    "statsfmAlbumId" TEXT,
    "venue" TEXT,
    "highlight" TEXT,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mustOrder" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewMedia" (
    "reviewId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReviewMedia_pkey" PRIMARY KEY ("reviewId","mediaId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "kind" "FavoriteKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "filmLogId" TEXT,
    "reviewId" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "year" INTEGER,
    "coverUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeocodeCache" (
    "id" TEXT NOT NULL,
    "normalisedAddress" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "neighbourhood" TEXT,
    "city" TEXT,
    "raw" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeocodeCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilmLog" (
    "id" TEXT NOT NULL,
    "letterboxdGuid" TEXT NOT NULL,
    "entryType" "FilmEntryType" NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "tmdbId" INTEGER,
    "stars" DECIMAL(2,1),
    "rating" INTEGER,
    "watchedAt" DATE NOT NULL,
    "posterUrl" TEXT,
    "rewatch" BOOLEAN NOT NULL DEFAULT false,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "hasLetterboxdReview" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilmLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumListen" (
    "id" TEXT NOT NULL,
    "statsfmAlbumId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "year" INTEGER,
    "coverUrl" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "streams" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumListen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StravaActivity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sportType" TEXT NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "movingS" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "StravaActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderToken" (
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderToken_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "itemsChanged" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "blobUrl" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "confirmToken" TEXT NOT NULL,
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostStat" (
    "postId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostStat_pkey" PRIMARY KEY ("postId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Post_reviewId_key" ON "Post"("reviewId");

-- CreateIndex
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "PostMedia_mediaId_idx" ON "PostMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_fromSlug_key" ON "Redirect"("fromSlug");

-- CreateIndex
CREATE INDEX "Redirect_postId_idx" ON "Redirect"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "PostTag_tagId_idx" ON "PostTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_filmLogId_key" ON "Review"("filmLogId");

-- CreateIndex
CREATE INDEX "Review_kind_date_idx" ON "Review"("kind", "date");

-- CreateIndex
CREATE INDEX "Dish_reviewId_order_idx" ON "Dish"("reviewId", "order");

-- CreateIndex
CREATE INDEX "ReviewMedia_mediaId_idx" ON "ReviewMedia"("mediaId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_kind_position_key" ON "Favorite"("kind", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodeCache_normalisedAddress_key" ON "GeocodeCache"("normalisedAddress");

-- CreateIndex
CREATE UNIQUE INDEX "FilmLog_letterboxdGuid_key" ON "FilmLog"("letterboxdGuid");

-- CreateIndex
CREATE INDEX "FilmLog_watchedAt_idx" ON "FilmLog"("watchedAt");

-- CreateIndex
CREATE INDEX "StravaActivity_startAt_idx" ON "StravaActivity"("startAt");

-- CreateIndex
CREATE INDEX "SyncRun_source_startedAt_idx" ON "SyncRun"("source", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_confirmToken_key" ON "Subscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "EmailSend_status_idx" ON "EmailSend"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSend_postId_subscriberId_key" ON "EmailSend"("postId", "subscriberId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Redirect" ADD CONSTRAINT "Redirect_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_filmLogId_fkey" FOREIGN KEY ("filmLogId") REFERENCES "FilmLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewMedia" ADD CONSTRAINT "ReviewMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_filmLogId_fkey" FOREIGN KEY ("filmLogId") REFERENCES "FilmLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostStat" ADD CONSTRAINT "PostStat_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CHECK constraints (hand-added; Prisma's schema language can't express them).
-- Ratings are whole numbers 1–10 everywhere (spec §8).
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_check" CHECK ("rating" BETWEEN 1 AND 10);
ALTER TABLE "Review" ADD CONSTRAINT "Review_price_check" CHECK ("price" IS NULL OR "price" BETWEEN 1 AND 4);
ALTER TABLE "FilmLog" ADD CONSTRAINT "FilmLog_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 10);
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_position_check" CHECK ("position" BETWEEN 1 AND 4);
