-- AlterTable
ALTER TABLE "Pet" ADD COLUMN     "ageYears" DECIMAL(65,30),
ADD COLUMN     "dietaryRestrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "locationLabel" TEXT,
ADD COLUMN     "locationPostalCode" TEXT,
ADD COLUMN     "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "weightKg" DECIMAL(65,30);

-- CreateTable
CREATE TABLE "CareLog" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "fed" BOOLEAN,
    "mood" TEXT,
    "weightKg" DECIMAL(65,30),
    "symptoms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareLog_petId_loggedAt_idx" ON "CareLog"("petId", "loggedAt");

-- AddForeignKey
ALTER TABLE "CareLog" ADD CONSTRAINT "CareLog_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
