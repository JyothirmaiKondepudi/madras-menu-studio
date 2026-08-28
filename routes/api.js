const express = require('express');
const router = express.Router();
const { db } = require('../db/db');
const { generateMenus, getAllItems, getPriceRules, priceOf, CATEGORY_LABEL } = require('../services/menuEngine');

const CUISINES = ['North Indian','South Indian','Fusion','Chinese','Mexican','Italian','American','Mediterranean','Punjabi','Sindhi','Marathi','Pakistani','Bangladeshi','Gujarati','Kerala','Telugu/Andhra','Tamil'];
const MEALS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks / Late Night' },
  { id: 'cocktail', label: 'Cocktail Hour' },
  { id: 'ceremony', label: 'Ceremony Refreshments' },
];
const SEGMENTS = [
  { id: 'welcome', label: 'Welcome Dinner', meal: 'dinner' },
  { id: 'breakfastAM', label: 'Breakfast', meal: 'breakfast' },
  { id: 'mehndi', label: 'Mehndi', meal: 'snacks' },
  { id: 'sangeet', label: 'Sangeet / Garba', meal: 'dinner' },
  { id: 'wedbreak', label: 'Wedding-Day Breakfast', meal: 'breakfast' },
  { id: 'baraat', label: 'Baraat Refreshments', meal: 'ceremony' },
  { id: 'wedlunch', label: 'Wedding Lunch', meal: 'lunch' },
  { id: 'cocktail', label: 'Wedding Cocktail Hour', meal: 'cocktail' },
  { id: 'dinnerrec', label: 'Dinner Reception', meal: 'dinner' },
];
const RELIGIONS = ['hindu', 'muslim', 'christian'];

router.get('/meta', (req, res) => {
  res.json({ cuisines: CUISINES, meals: MEALS, segments: SEGMENTS, religions: RELIGIONS, categories: CATEGORY_LABEL });
});

// ---- Items ----
router.get('/items', (req, res) => {
  const { category, cuisine, meal, veg, religion, q } = req.query;
  let items = getAllItems();
  if (category) items = items.filter(it => it.category === category);
  if (cuisine) {
    const list = String(cuisine).split(',').filter(Boolean);
    if (list.length) items = items.filter(it => it.cuisines.some(c => list.includes(c)));
  }
  if (meal) items = items.filter(it => it.meals.includes(meal));
  if (veg === 'veg') items = items.filter(it => it.veg);
  if (veg === 'nonveg') items = items.filter(it => !it.veg);
  if (religion && religion !== 'any') items = items.filter(it => it.religions.includes(religion));
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter(it => it.name.toLowerCase().includes(needle));
  }
  const priceRules = getPriceRules();
  const withPrice = items.map(it => ({ ...it, price: priceOf(it, priceRules) }));
  res.json(withPrice);
});

router.post('/items', (req, res) => {
  const { name, category, cuisines, veg, meals, events, religions, repeatable } = req.body;
  if (!name || !category || !Array.isArray(cuisines) || !Array.isArray(meals)) {
    return res.status(400).json({ error: 'name, category, cuisines[], meals[] are required' });
  }
  const stmt = db.prepare(`INSERT INTO items (name, category, cuisines, veg, meals, events, religions, repeatable)
    VALUES (@name, @category, @cuisines, @veg, @meals, @events, @religions, @repeatable)`);
  const info = stmt.run({
    name, category,
    cuisines: JSON.stringify(cuisines),
    veg: veg ? 1 : 0,
    meals: JSON.stringify(meals),
    events: JSON.stringify(events || []),
    religions: JSON.stringify(religions && religions.length ? religions : RELIGIONS),
    repeatable: repeatable ? 1 : 0,
  });
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/items/:id', (req, res) => {
  const { name, category, cuisines, veg, meals, events, religions, repeatable } = req.body;
  const stmt = db.prepare(`UPDATE items SET name=@name, category=@category, cuisines=@cuisines, veg=@veg,
    meals=@meals, events=@events, religions=@religions, repeatable=@repeatable WHERE id=@id`);
  stmt.run({
    id: req.params.id, name, category,
    cuisines: JSON.stringify(cuisines || []),
    veg: veg ? 1 : 0,
    meals: JSON.stringify(meals || []),
    events: JSON.stringify(events || []),
    religions: JSON.stringify(religions && religions.length ? religions : RELIGIONS),
    repeatable: repeatable ? 1 : 0,
  });
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- Price rules ----
router.get('/price-rules', (req, res) => {
  res.json(getPriceRules());
});
router.put('/price-rules/:category', (req, res) => {
  const { base_price, nonveg_surcharge } = req.body;
  db.prepare(`INSERT INTO price_rules (category, base_price, nonveg_surcharge) VALUES (?, ?, ?)
    ON CONFLICT(category) DO UPDATE SET base_price=excluded.base_price, nonveg_surcharge=excluded.nonveg_surcharge`)
    .run(req.params.category, base_price, nonveg_surcharge || 0);
  res.json({ ok: true });
});

// ---- Generation ----
router.post('/generate', (req, res) => {
  const { meal, cuisines, veg, religion, count } = req.body;
  if (!meal) return res.status(400).json({ error: 'meal is required' });
  const result = generateMenus(meal, {
    cuisines: Array.isArray(cuisines) ? cuisines : [],
    veg: veg || 'both',
    religion: religion || 'any',
    count: count || 3,
  });
  res.json(result);
});

module.exports = router;
