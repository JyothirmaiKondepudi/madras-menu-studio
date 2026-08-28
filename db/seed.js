const { db, initSchema } = require('./db');
const { items } = require('./seedData');

const PRICE_RULES = [
  { category: 'breakfast', base_price: 5, nonveg_surcharge: 2 },
  { category: 'starter',   base_price: 4, nonveg_surcharge: 2 },
  { category: 'main',      base_price: 7, nonveg_surcharge: 2 },
  { category: 'rice',      base_price: 4, nonveg_surcharge: 2 },
  { category: 'bread',     base_price: 3, nonveg_surcharge: 0 },
  { category: 'dessert',   base_price: 4, nonveg_surcharge: 0 },
  { category: 'beverage',  base_price: 2, nonveg_surcharge: 0 },
  { category: 'station',   base_price: 11, nonveg_surcharge: 3 },
];

function seed() {
  initSchema();

  const wipe = db.transaction(() => {
    db.prepare('DELETE FROM items').run();
    db.prepare('DELETE FROM price_rules').run();
  });
  wipe();

  const insertItem = db.prepare(`
    INSERT INTO items (name, category, cuisines, veg, meals, events, religions, repeatable)
    VALUES (@name, @category, @cuisines, @veg, @meals, @events, @religions, @repeatable)
  `);
  const insertMany = db.transaction((rows) => {
    for (const it of rows) {
      insertItem.run({
        name: it.name,
        category: it.category,
        cuisines: JSON.stringify(it.cuisines),
        veg: it.veg ? 1 : 0,
        meals: JSON.stringify(it.meals),
        events: JSON.stringify(it.events),
        religions: JSON.stringify(it.religions),
        repeatable: it.repeatable ? 1 : 0,
      });
    }
  });
  insertMany(items);

  const insertPrice = db.prepare(`
    INSERT INTO price_rules (category, base_price, nonveg_surcharge) VALUES (@category, @base_price, @nonveg_surcharge)
  `);
  const insertPrices = db.transaction((rows) => { for (const r of rows) insertPrice.run(r); });
  insertPrices(PRICE_RULES);

  console.log(`Seeded ${items.length} items and ${PRICE_RULES.length} price rules into database.sqlite`);
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
