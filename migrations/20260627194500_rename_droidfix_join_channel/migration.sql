-- Join announcements belong in #general (or a joins channel), not #welcome.
ALTER TABLE "Setting" RENAME COLUMN "droidfixWelcomeChannelId" TO "droidfixJoinChannelId";
