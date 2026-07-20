/*
  Warnings:

  - Added the required column `category` to the `news_articles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary` to the `news_articles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "news_articles" ADD COLUMN     "category" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '';
