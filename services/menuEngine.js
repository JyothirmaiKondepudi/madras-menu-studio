const { db } = require('../db/db');

const CATEGORY_LABEL = {
  breakfast: 'Breakfast Dishes', starter: 'Starters & Chaat', main: 'Mains',
  rice: 'Rice', bread: 'Bread', dessert: 'Dessert', beverage: 'Beverage', station: 'Live Station',
};

// slot templates: category -> unique dish count needed per menu option
const SLOT_TEMPLATES = {
  breakfast: [['breakfast', 3], ['beverage', 1]],
  lunch:     [['starter', 2], ['main', 3], ['rice', 1], ['bread', 1], ['dessert', 1], ['beverage', 1]],
  dinner:    [['starter', 2], ['main', 3], ['rice', 1], ['bread', 1], ['dessert', 1], ['beverage', 1]],
  snacks:    [['starter', 3], ['dessert', 1], ['beverage', 1]],
  cocktail:  [['starter', 5], ['beverage', 1]],
  ceremony:  [['starter', 3], ['beverage', 1]],
};

function rowToItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    cuisines: JSON.parse(row.cuisines),
    veg: !!row.veg,
    meals: JSON.parse(row.meals),
    events: JSON.parse(row.events),
    religions: JSON.parse(row.religions),
    repeatable: !!row.repeatable,
  };
}

function getAllItems() {
  return db.prepare('SELECT * FROM items').all().map(rowToItem);
}

function getPriceRules() {
  const rows = db.prepare('SELECT * FROM price_rules').all();
  const map = {};
  rows.forEach(r => { map[r.category] = { base: r.base_price, surcharge: r.nonveg_surcharge }; });
  return map;
}

function priceOf(item, priceRules) {
  const rule = priceRules[item.category] || { base: 5, surcharge: 0 };
  return rule.base + (item.veg ? 0 : rule.surcharge);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function matchesCuisines(item, cuisines) {
  if (!cuisines || cuisines.length === 0) return true; // no filter = any cuisine
  return item.cuisines.some(c => cuisines.includes(c));
}
function matchesVeg(item, vegMode) {
  if (vegMode === 'veg') return item.veg === true;
  return true; // 'nonveg' focus and 'both' still allow veg sides in the pool
}
function matchesReligion(item, religion) {
  if (!religion || religion === 'any') return true;
  return item.religions.includes(religion);
}

/**
 * Build `count` (default 3) non-repeating menu options for a meal, given filters.
 * cuisines: array of cuisine names (multi-select, OR match). Empty/undefined = any cuisine.
 * If a category's pool is too small to fill every option uniquely, the pool is broadened in
 * stages (drop cuisine filter -> allow repeats) and a warning is recorded rather than
 * silently returning a near-empty or duplicate-heavy menu.
 */
function generateMenus(meal, { cuisines = [], veg = 'both', religion = 'any', count = 3 } = {}) {
  const template = SLOT_TEMPLATES[meal] || SLOT_TEMPLATES.dinner;
  const allItems = getAllItems();
  const priceRules = getPriceRules();
  const warnings = [];

  const baseFilter = (it) =>
    it.category !== 'station' &&
    it.meals.includes(meal) &&
    matchesVeg(it, veg) &&
    matchesReligion(it, religion) &&
    (veg === 'veg' ? it.veg : true);

  const usedNonRepeatable = new Set();
  const options = [];

  for (let optIdx = 0; optIdx < count; optIdx++) {
    const menu = [];
    for (const [cat, need] of template) {
      let pool = allItems.filter(it => it.category === cat && baseFilter(it) && matchesCuisines(it, cuisines));
      let broadened = false;

      // Stage 1: broaden cuisine filter if the strict pool can't fill this slot uniquely
      const uniqueAvailable = pool.filter(it => it.repeatable || !usedNonRepeatable.has(it.id));
      if (uniqueAvailable.length < need) {
        const widerPool = allItems.filter(it => it.category === cat && baseFilter(it));
        if (widerPool.length > pool.length) {
          pool = widerPool;
          broadened = true;
        }
      }

      pool = shuffle(pool);
      const picked = [];
      for (const it of pool) {
        if (picked.length >= need) break;
        if (!it.repeatable && usedNonRepeatable.has(it.id)) continue;
        picked.push(it);
      }
      // Stage 2: still short — allow repeats as a last resort, flagged clearly
      if (picked.length < need) {
        for (const it of pool) {
          if (picked.length >= need) break;
          if (!picked.find(p => p.id === it.id)) picked.push(it);
        }
        if (picked.length < need) {
          warnings.push(`Only ${picked.length}/${need} ${CATEGORY_LABEL[cat] || cat} dish(es) available for the selected cuisine/faith/veg filters — add more items to that category to fill this slot.`);
        } else if (broadened) {
          warnings.push(`Not enough ${CATEGORY_LABEL[cat] || cat} dishes in the selected cuisine(s) — broadened to the full library for this slot.`);
        }
      } else if (broadened) {
        warnings.push(`Not enough ${CATEGORY_LABEL[cat] || cat} dishes in the selected cuisine(s) — broadened to the full library for this slot.`);
      }

      picked.forEach(it => { if (!it.repeatable) usedNonRepeatable.add(it.id); });
      menu.push({ category: cat, label: CATEGORY_LABEL[cat] || cat, dishes: picked.map(it => ({ ...it, price: priceOf(it, priceRules) })) });
    }
    options.push(menu);
  }

  const optionsWithTotals = options.map(menu => ({
    dishes: menu,
    totalPerPerson: menu.reduce((sum, block) => sum + block.dishes.reduce((s, d) => s + d.price, 0), 0),
  }));

  return { options: optionsWithTotals, warnings: [...new Set(warnings)] };
}

module.exports = { generateMenus, getAllItems, getPriceRules, priceOf, CATEGORY_LABEL, SLOT_TEMPLATES };
