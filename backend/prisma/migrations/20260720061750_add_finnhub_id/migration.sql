/*
  Warnings:

  - A unique constraint covering the columns `[finnhub_id]` on the table `news_articles` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "news_articles" ADD COLUMN     "finnhub_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "news_articles_finnhub_id_key" ON "news_articles"("finnhub_id");
