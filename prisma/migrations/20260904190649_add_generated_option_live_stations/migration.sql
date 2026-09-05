-- CreateTable: implicit many-to-many between GeneratedMenuOption and LiveStation,
-- mirroring the existing _LiveStationToOccasion join table's structure exactly.
CREATE TABLE "_GeneratedMenuOptionToLiveStation" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_GeneratedMenuOptionToLiveStation_AB_pkey" ON "_GeneratedMenuOptionToLiveStation"("A", "B");
CREATE INDEX "_GeneratedMenuOptionToLiveStation_B_index" ON "_GeneratedMenuOptionToLiveStation"("B");

ALTER TABLE "_GeneratedMenuOptionToLiveStation" ADD CONSTRAINT "_GeneratedMenuOptionToLiveStation_A_fkey"
    FOREIGN KEY ("A") REFERENCES "generated_menu_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_GeneratedMenuOptionToLiveStation" ADD CONSTRAINT "_GeneratedMenuOptionToLiveStation_B_fkey"
    FOREIGN KEY ("B") REFERENCES "live_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
