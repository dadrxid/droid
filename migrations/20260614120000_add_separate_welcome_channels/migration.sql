-- AlterTable
ALTER TABLE "Setting" RENAME COLUMN "welcomeChannelId" TO "droidlabWelcomeChannelId";
ALTER TABLE "Setting" ADD COLUMN "droidfixWelcomeChannelId" TEXT;
