-- AlterEnum
ALTER TYPE "AttendanceStatus" ADD VALUE 'UNSICHER';

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "alias" TEXT;
