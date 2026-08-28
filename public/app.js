const API = '/api';
let META = null; // {cuisines, meals, segments, religions, categories}

async function jget(url){ const r = await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function jpost(url, body){ const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function jput(url, body){ const r = await fetch(url, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); if(!r.ok) throw new Error(await r.text()); return r.json(); }
async function jdel(url){ const r = await fetch(url, {method:'DELETE'}); if(!r.ok) throw new Error(await r.text()); return r.json(); }

function fillSelect(sel, arr, {value=v=>v, label=v=>v} = {}){
  sel.innerHTML = sel.querySelector('option')?.outerHTML && sel.children.length ? sel.innerHTML : '';
  arr.forEach(v=>{ const opt=document.createElement('option'); opt.value=value(v); opt.textContent=label(v); sel.appendChild(opt); });
}

/** Renders a multi-select chip group into `container`, returns a getter for selected values. */
function buildChipGroup(container, values, {multi=true} = {}){
  container.innerHTML = '';
  const selected = new Set();
  values.forEach(v=>{
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = v;
    chip.addEventListener('click', ()=>{
      if(selected.has(v)){
        selected.delete(v); chip.classList.remove('selected');
      } else {
        if(!multi){ selected.clear(); container.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); }
        selected.add(v); chip.classList.add('selected');
      }
    });
    container.appendChild(chip);
  });
  return () => Array.from(selected);
}

const CAT_LABEL_FALLBACK = {breakfast:'Breakfast Dishes',starter:'Starters & Chaat',main:'Mains',rice:'Rice',bread:'Bread',dessert:'Dessert',beverage:'Beverage',station:'Live Station'};

function renderOptionsHTML(options, warnings, titlePrefix){
  let html = '';
  if(warnings && warnings.length){
    html += `<div class="warning-box">${warnings.map(w=>'⚠ '+w).join('<br>')}</div>`;
  }
  html += `<div class="options-grid">`;
  options.forEach((opt, idx)=>{
    html += `<div class="option-card">
      <div class="option-head"><span class="label">${titlePrefix} — Option ${idx+1}</span><span class="price">$${opt.totalPerPerson} pp</span></div>
      <div class="option-body">`;
    opt.dishes.forEach(block=>{
      if(!block.dishes.length) return;
      html += `<div class="item-cat">${block.label || CAT_LABEL_FALLBACK[block.category] || block.category}</div>`;
      block.dishes.forEach(d=>{ html += `<div class="item-line ${d.veg?'v':'nv'}">${d.name}</div>`; });
    });
    html += `</div><div class="option-foot"><button class="btn small secondary no-print" data-regen="${idx}">Regenerate</button></div></div>`;
  });
  html += `</div>`;
  return html;
}

function legend(){
  return `<div class="tag-legend"><span><span class="dot" style="background:var(--veg)"></span>Vegetarian</span><span><span class="dot" style="background:var(--nonveg)"></span>Non-vegetarian</span></div>`;
}

/* =========================== INIT =========================== */
(async function init(){
  META = await jget(`${API}/meta`);

  // Tabs
  document.querySelectorAll('nav.tabs button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('nav.tabs button').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-'+btn.dataset.tab).classList.add('active');
    });
  });

  initBuilder();
  initSingle();
  initStations();
  initDatabase();
})();

/* =========================== EVENT BUILDER =========================== */
function initBuilder(){
  const getEventCuisines = buildChipGroup(document.getElementById('eventCuisineChips'), META.cuisines);

  const segmentListEl = document.getElementById('segmentList');
  const segmentGetters = {};
  META.segments.forEach(seg=>{
    const row = document.createElement('div');
    row.className = 'segment-row';
    row.innerHTML = `
      <div class="segment-head">
        <input type="checkbox" id="chk-${seg.id}">
        <strong>${seg.label}</strong>
        <span class="util" style="color:var(--muted); font-size:12px;">(${META.meals.find(m=>m.id===seg.meal)?.label || seg.meal})</span>
      </div>
      <div class="segment-options grid grid-3">
        <div style="grid-column: span 2;"><label class="field-label">Cuisine focus <span class="hint">(blank = use event default)</span></label><div class="chip-group" id="cui-${seg.id}"></div></div>
        <div><label class="field-label">Veg / Non-veg</label><select id="veg-${seg.id}">
          <option value="both">Both offered</option><option value="veg">Vegetarian only</option><option value="nonveg">Non-vegetarian focus</option>
        </select></div>
        <div><label class="field-label">Faith override</label><select id="rel-${seg.id}"><option value="inherit">Use event default</option><option value="hindu">Hindu</option><option value="muslim">Muslim</option><option value="christian">Christian</option><option value="any">No restriction</option></select></div>
      </div>`;
    segmentListEl.appendChild(row);
    segmentGetters[seg.id] = buildChipGroup(row.querySelector('#cui-'+seg.id), META.cuisines);
    row.querySelector('input[type=checkbox]').addEventListener('change', e=>{
      row.classList.toggle('checked', e.target.checked);
    });
  });

  document.getElementById('generateAllBtn').addEventListener('click', async ()=>{
    const eventName = document.getElementById('eventName').value.trim() || 'This Event';
    const defaultReligion = document.getElementById('eventReligion').value;
    const defaultCuisines = getEventCuisines();
    const resultsEl = document.getElementById('builderResults');
    resultsEl.innerHTML = '';

    const chosen = META.segments.filter(seg=>document.getElementById('chk-'+seg.id).checked);
    if(!chosen.length){
      resultsEl.innerHTML = `<div class="card"><p class="help" style="margin:0;">Tick at least one segment above, then generate.</p></div>`;
      return;
    }

    const header = document.createElement('div');
    header.className = 'card';
    header.innerHTML = `<h2 class="section-title" style="margin-bottom:2px;">${eventName}</h2><p class="help" style="margin-bottom:0;">${chosen.length} segment(s) · 3 menu options each · faith default: ${defaultReligion} · cuisine default: ${defaultCuisines.length?defaultCuisines.join(', '):"Chef's mix"}</p>`;
    resultsEl.appendChild(header);

    for(const seg of chosen){
      const segCuisines = segmentGetters[seg.id]();
      const cuisines = segCuisines.length ? segCuisines : defaultCuisines;
      const veg = document.getElementById('veg-'+seg.id).value;
      const relRaw = document.getElementById('rel-'+seg.id).value;
      const religion = relRaw==='inherit' ? defaultReligion : relRaw;

      const filters = {cuisines, veg, religion};
      const data = await jpost(`${API}/generate`, {meal:seg.meal, ...filters});
      const block = document.createElement('div');
      block.className = 'card result-block';
      block.innerHTML = `<div class="result-header"><h3>${seg.label}</h3><span class="meta util">${META.meals.find(m=>m.id===seg.meal)?.label} · ${cuisines.length?cuisines.join(', '):"Chef's mix"} · ${veg==='both'?'Veg + Non-veg':veg==='veg'?'Vegetarian only':'Non-veg focus'} · ${religion==='any'?'No faith restriction':religion}</span></div>
        ${legend()}
        ${renderOptionsHTML(data.options, data.warnings, seg.label)}`;
      resultsEl.appendChild(block);
      wireRegenerate(block, seg.meal, filters, seg.label);
    }
  });

  document.getElementById('printBtn').addEventListener('click', ()=> window.print());
}

function wireRegenerate(container, meal, filters, label){
  container.querySelectorAll('[data-regen]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const idx = Number(btn.dataset.regen);
      const data = await jpost(`${API}/generate`, {meal, ...filters});
      const fresh = data.options[idx % data.options.length];
      const card = btn.closest('.option-card');
      let body = '';
      fresh.dishes.forEach(block=>{
        if(!block.dishes.length) return;
        body += `<div class="item-cat">${block.label}</div>`;
        block.dishes.forEach(d=>{ body += `<div class="item-line ${d.veg?'v':'nv'}">${d.name}</div>`; });
      });
      card.querySelector('.option-body').innerHTML = body;
      card.querySelector('.price').textContent = `$${fresh.totalPerPerson} pp`;
    });
  });
}

/* =========================== SINGLE GENERATOR =========================== */
function initSingle(){
  fillSelect(document.getElementById('s-segment'), META.segments, {value:s=>s.id, label:s=>s.label});
  fillSelect(document.getElementById('s-meal'), META.meals, {value:m=>m.id, label:m=>m.label});
  document.getElementById('s-segment').addEventListener('change', e=>{
    const seg = META.segments.find(s=>s.id===e.target.value);
    document.getElementById('s-meal').value = seg.meal;
  });
  document.getElementById('s-segment').dispatchEvent(new Event('change'));

  const getCuisines = buildChipGroup(document.getElementById('s-cuisineChips'), META.cuisines);

  document.getElementById('singleGenBtn').addEventListener('click', async ()=>{
    const meal = document.getElementById('s-meal').value;
    const cuisines = getCuisines();
    const veg = document.getElementById('s-veg').value;
    const religion = document.getElementById('s-religion').value;
    const segLabel = META.segments.find(s=>s.id===document.getElementById('s-segment').value)?.label || 'Menu';
    const filters = {cuisines, veg, religion};
    const data = await jpost(`${API}/generate`, {meal, ...filters});
    const el = document.getElementById('singleResults');
    el.innerHTML = `<div class="card result-block">
      <div class="result-header"><h3>${segLabel}</h3><span class="meta util">${META.meals.find(m=>m.id===meal)?.label} · ${cuisines.length?cuisines.join(', '):"Chef's mix"} · ${veg}</span></div>
      ${legend()}
      ${renderOptionsHTML(data.options, data.warnings, segLabel)}
    </div>`;
    wireRegenerate(el, meal, filters, segLabel);
  });
}

/* =========================== LIVE STATIONS =========================== */
function initStations(){
  const getCuisines = buildChipGroup(document.getElementById('st-cuisineChips'), META.cuisines);
  document.getElementById('st-cuisineChips').addEventListener('click', renderStations);
  document.getElementById('st-veg').addEventListener('change', renderStations);

  async function renderStations(){
    const cuisines = getCuisines();
    const vegMode = document.getElementById('st-veg').value;
    const params = new URLSearchParams({category:'station'});
    if(cuisines.length) params.set('cuisine', cuisines.join(','));
    if(vegMode==='veg') params.set('veg','veg');
    const stations = await jget(`${API}/items?${params.toString()}`);
    const grid = document.getElementById('stationGrid');
    grid.innerHTML = '';
    stations.forEach(s=>{
      const card = document.createElement('div');
      card.className = 'station-card';
      card.innerHTML = `<h4>${s.name}</h4>
        <div>${s.cuisines.map(c=>`<span class="pill">${c}</span>`).join('')}<span class="pill">${s.veg?'Veg':'Veg + Non-veg'}</span><span class="pill">$${s.price} pp</span></div>
        <label><input type="checkbox" data-station-id="${s.id}" data-name="${s.name}" data-price="${s.price}" data-veg="${s.veg}"> Add to selection</label>`;
      grid.appendChild(card);
    });
    grid.querySelectorAll('input[type=checkbox]').forEach(cb=> cb.addEventListener('change', renderSelected));
  }
  function renderSelected(){
    const checked = Array.from(document.querySelectorAll('#stationGrid input[type=checkbox]:checked'));
    const el = document.getElementById('selectedStations');
    if(!checked.length){ el.textContent = 'No stations selected yet.'; return; }
    const total = checked.reduce((sum,cb)=>sum+Number(cb.dataset.price),0);
    el.innerHTML = checked.map(cb=>`<div class="item-line ${cb.dataset.veg==='true'?'v':'nv'}">${cb.dataset.name} — $${cb.dataset.price} pp</div>`).join('') +
      `<div style="margin-top:10px; font-weight:700; font-family:'Trebuchet MS',sans-serif;">Stations subtotal: $${total} pp</div>`;
  }
  renderStations();
}

/* =========================== ITEM DATABASE =========================== */
function initDatabase(){
  fillSelect(document.getElementById('db-cat'), Object.keys(META.categories), {label:c=>META.categories[c]});
  fillSelect(document.getElementById('db-cuisine'), META.cuisines);
  fillSelect(document.getElementById('db-meal'), META.meals, {value:m=>m.id, label:m=>m.label});
  ['db-cat','db-cuisine','db-meal','db-veg'].forEach(id=> document.getElementById(id).addEventListener('change', renderDB));

  fillSelect(document.getElementById('ai-category'), Object.keys(META.categories), {label:c=>META.categories[c]});
  const getAddCuisines = buildChipGroup(document.getElementById('ai-cuisineChips'), META.cuisines);
  const getAddMeals = buildChipGroup(document.getElementById('ai-mealChips'), META.meals.map(m=>m.id));

  document.getElementById('addItemForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const payload = {
      name: document.getElementById('ai-name').value.trim(),
      category: document.getElementById('ai-category').value,
      veg: document.getElementById('ai-veg').value === '1',
      cuisines: getAddCuisines(),
      meals: getAddMeals(),
      events: [],
      religions: [],
      repeatable: document.getElementById('ai-repeatable').value === '1',
    };
    if(!payload.name || !payload.cuisines.length || !payload.meals.length){
      alert('Please provide a name, at least one cuisine, and at least one meal.');
      return;
    }
    await jpost(`${API}/items`, payload);
    document.getElementById('ai-name').value = '';
    renderDB();
  });

  async function renderDB(){
    const cat = document.getElementById('db-cat').value;
    const cuisine = document.getElementById('db-cuisine').value;
    const meal = document.getElementById('db-meal').value;
    const veg = document.getElementById('db-veg').value;
    const params = new URLSearchParams();
    if(cat!=='any') params.set('category', cat);
    if(cuisine!=='any') params.set('cuisine', cuisine);
    if(meal!=='any') params.set('meal', meal);
    if(veg!=='any') params.set('veg', veg);
    const rows = await jget(`${API}/items?${params.toString()}`);
    const body = document.getElementById('dbBody');
    body.innerHTML = rows.map(it=>`<tr>
      <td>${it.name}</td>
      <td>${META.categories[it.category]||it.category}</td>
      <td>${it.cuisines.join(', ')}</td>
      <td>${it.meals.join(', ')}</td>
      <td>${it.veg?'Veg':'Non-veg'}</td>
      <td>$${it.price}</td>
      <td><button class="small-del" data-del="${it.id}">Delete</button></td>
    </tr>`).join('') || `<tr><td colspan="7" style="color:var(--muted); padding:14px 8px;">No dishes match this filter combination yet.</td></tr>`;
    body.querySelectorAll('[data-del]').forEach(btn=> btn.addEventListener('click', async ()=>{
      await jdel(`${API}/items/${btn.dataset.del}`);
      renderDB();
    }));
  }
  renderDB();
}
