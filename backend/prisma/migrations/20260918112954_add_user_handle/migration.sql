/*
Warnings:

- A unique constraint covering the columns `[handle]` on the table `User` will be added. If there are existing duplicate values, this will fail.
- Added the required column `handle` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN "handle" VARCHAR(30);

-- Backfill existing users
Update "User" SET "handle" = 'user_' || "id"::text;

-- Make handle required
ALTER TABLE "User" ALTER COLUMN "handle" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User" ("handle");