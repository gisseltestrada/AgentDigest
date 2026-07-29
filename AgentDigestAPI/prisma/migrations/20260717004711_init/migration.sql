-- CreateTable
CREATE TABLE "Source" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);
