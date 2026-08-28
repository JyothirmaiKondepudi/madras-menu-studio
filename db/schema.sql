CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- breakfast, starter, main, rice, bread, dessert, beverage, station
  cuisines TEXT NOT NULL,          -- JSON array, e.g. ["North Indian","Punjabi"]
  veg INTEGER NOT NULL,            -- 1 = vegetarian, 0 = non-vegetarian
  meals TEXT NOT NULL,             -- JSON array: breakfast, lunch, dinner, snacks, cocktail, ceremony
  events TEXT NOT NULL,            -- JSON array: wedding, sangeet, welcome, mehndi, breakfast, latenight, sweet16, anniversary, birthday, lunch, cocktail, dinner, baraat, ceremony
  religions TEXT NOT NULL,         -- JSON array: hindu, muslim, christian
  repeatable INTEGER NOT NULL DEFAULT 0  -- 1 = allowed to repeat across the 3 generated options (chai, naan, rice staples...)
);

CREATE TABLE IF NOT EXISTS price_rules (
  category TEXT PRIMARY KEY,
  base_price INTEGER NOT NULL,
  nonveg_surcharge INTEGER NOT NULL DEFAULT 0
);
