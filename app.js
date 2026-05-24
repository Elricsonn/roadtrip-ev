// === Road Trip EV — logique principale ===
// Charge data.json (prévisions), gère la saisie des "réels" en LocalStorage,
// calcule les KPIs en live, exporte les données saisies en JSON pour ré-injection
// dans le classeur Excel au retour.

const STORAGE_KEY = 'roadtrip-ev-v1';
const STATE = { data: null, currentTripId: null, reels: {} };

// === Chargement initial ===
fetch('data.json').then(r => r.json()).then(data => {
    STATE.data = data;
    STATE.reels = loadReels();
    STATE.currentTripId = data.trajets[0].id;
    renderTabs();
    renderTrip();
    bindFooter();
});

// === LocalStorage ===
function loadReels() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (e) { return {}; }
}

function saveReels() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.reels));
}

function getReel(tripId, etapeIdx, field) {
    return STATE.reels?.[tripId]?.[etapeIdx]?.[field] ?? '';
}

function setReel(tripId, etapeIdx, field, value) {
    if (!STATE.reels[tripId]) STATE.reels[tripId] = {};
    if (!STATE.reels[tripId][etapeIdx]) STATE.reels[tripId][etapeIdx] = {};
    if (value === '' || value == null) {
        delete STATE.reels[tripId][etapeIdx][field];
    } else {
        STATE.reels[tripId][etapeIdx][field] = value;
    }
    saveReels();
}

// === UI rendering ===
function renderTabs() {
    const nav = document.getElementById('tripTabs');
    nav.innerHTML = '';
    STATE.data.trajets.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'trip-tab' + (t.id === STATE.currentTripId ? ' active' : '');
        // Label court : "J1", "J2", ..., "Réf."
        const short = t.id === 'ref' ? 'Réf.' : t.id.toUpperCase();
        btn.textContent = short;
        btn.title = t.titre;
        btn.addEventListener('click', () => {
            STATE.currentTripId = t.id;
            renderTabs();
            renderTrip();
        });
        nav.appendChild(btn);
    });
}

function renderTrip() {
    const t = STATE.data.trajets.find(x => x.id === STATE.currentTripId);
    if (!t) return;
    document.getElementById('tripTitle').textContent = t.titre;
    document.getElementById('tripSubtitle').textContent = t.sous_titre || '';

    const container = document.getElementById('etapes');
    container.innerHTML = '';
    t.etapes.forEach((e, idx) => {
        container.appendChild(renderEtape(t.id, e, idx, idx === 0, idx === t.etapes.length - 1));
    });

    updateKPIs();
}

function renderEtape(tripId, etape, idx, isFirst, isLast) {
    const card = document.createElement('section');
    card.className = 'etape';

    // Header : lieu + action (pictogramme)
    const head = document.createElement('div');
    head.className = 'etape-head';
    head.innerHTML = `<div class="etape-lieu">${escapeHtml(etape.lieu)}</div>` +
                     (etape.action ? `<div class="etape-action">${escapeHtml(etape.action)}</div>` : '');
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'etape-grid';

    // Distance prévue + réelle (skip pour Départ)
    if (!isFirst) {
        grid.appendChild(field('Distance prévue', etape.distance_prevue != null ? `${etape.distance_prevue} km` : '—', null));
        grid.appendChild(field('Distance réelle', null, 'number', tripId, idx, 'distance_reelle', 'km'));
        grid.appendChild(field('Durée prévue', etape.duree_prevue || '—', null));
        grid.appendChild(field('Durée réelle', null, 'text', tripId, idx, 'duree_reelle', 'ex 1h25'));
        grid.appendChild(field('Heure arr. prévue', etape.heure_arrivee_prevue || '—', null));
        grid.appendChild(field('Heure arr. réelle', null, 'time', tripId, idx, 'heure_arrivee_reelle'));
        grid.appendChild(field('Charge arr. prévue', fmtPct(etape.charge_arrivee_prevue), null));
        grid.appendChild(field('Charge arr. réelle %', null, 'number', tripId, idx, 'charge_arrivee_reelle', '0-100'));
    }

    // Si pas la dernière étape, on a aussi un départ après l'arrivée
    if (!isLast) {
        if (!isFirst) {
            const sep = document.createElement('div');
            sep.className = 'field-wide';
            sep.style.borderTop = '1px dashed var(--border)';
            sep.style.margin = '0.3rem 0';
            grid.appendChild(sep);
        }
        grid.appendChild(field('Heure dép. prévue', etape.heure_depart_prevue || '—', null));
        grid.appendChild(field('Heure dép. réelle', null, 'time', tripId, idx, 'heure_depart_reelle'));
        grid.appendChild(field('Charge dép. prévue', fmtPct(etape.charge_depart_prevue), null));
        grid.appendChild(field('Charge dép. réelle %', null, 'number', tripId, idx, 'charge_depart_reelle', '0-100'));
    }

    card.appendChild(grid);
    return card;
}

function field(label, prevuText, inputType, tripId, etapeIdx, fieldKey, placeholder) {
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `<div class="field-label">${escapeHtml(label)}</div>`;
    if (prevuText !== null) {
        const p = document.createElement('div');
        p.className = 'field-prevu';
        p.textContent = prevuText;
        div.appendChild(p);
    }
    if (inputType) {
        const wrap = document.createElement('div');
        wrap.className = 'field-input';
        const inp = document.createElement('input');
        inp.type = inputType;
        if (inputType === 'number') {
            inp.inputMode = 'decimal';
            inp.step = 'any';
        }
        if (placeholder) inp.placeholder = placeholder;
        inp.value = getReel(tripId, etapeIdx, fieldKey);
        inp.addEventListener('change', () => {
            setReel(tripId, etapeIdx, fieldKey, inp.value);
            updateKPIs();
        });
        wrap.appendChild(inp);
        div.appendChild(wrap);
    }
    return div;
}

function fmtPct(v) {
    if (v == null || v === '—') return '—';
    if (typeof v === 'string' && v.includes('%')) return v;
    if (typeof v === 'number' && v <= 1.01) return Math.round(v * 100) + ' %';
    return v + ' %';
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// === KPIs (recalculés à chaque saisie) ===
function updateKPIs() {
    const t = STATE.data.trajets.find(x => x.id === STATE.currentTripId);
    const reels = STATE.reels[STATE.currentTripId] || {};
    const cap = STATE.data.voiture.capacite_utile_kwh;
    const conso_theo = STATE.data.voiture.conso_theorique_kwh_par_km;

    let distance_totale = 0;
    let kwh_total = 0;
    for (let i = 0; i < t.etapes.length; i++) {
        const r_arr = reels[i] || {};
        const r_dep_prev = reels[i - 1] || {};
        const dist = parseFloat(r_arr.distance_reelle);
        // Énergie consommée = (charge_dep_précédente - charge_arr_actuelle) × capacité
        const charge_dep_prev = parseFloat(r_dep_prev.charge_depart_reelle);
        const charge_arr = parseFloat(r_arr.charge_arrivee_reelle);
        if (!isNaN(dist) && !isNaN(charge_dep_prev) && !isNaN(charge_arr)) {
            distance_totale += dist;
            kwh_total += (charge_dep_prev - charge_arr) / 100 * cap;
        }
    }

    if (distance_totale > 0 && kwh_total > 0) {
        const conso = (kwh_total / distance_totale) * 100;  // kWh/100 km
        document.getElementById('kpiConso').textContent = conso.toFixed(1) + ' kWh/100';
        // Autonomie projetée si la charge actuelle est 100% (info à pleine charge)
        const auto = cap / (kwh_total / distance_totale);
        document.getElementById('kpiAutonomie').textContent = Math.round(auto) + ' km';
        // Écart vs théorique : conso_theo × 100 = 22 kWh/100
        const conso_theo_100 = conso_theo * 100;
        const ecart = conso - conso_theo_100;
        const ecartEl = document.getElementById('kpiEcart');
        const sign = ecart >= 0 ? '+' : '';
        ecartEl.textContent = sign + ecart.toFixed(1) + ' kWh/100';
        ecartEl.classList.remove('good', 'warn');
        ecartEl.classList.add(ecart > 0 ? 'warn' : 'good');
    } else {
        document.getElementById('kpiConso').textContent = '— kWh/100';
        document.getElementById('kpiAutonomie').textContent = '— km';
        document.getElementById('kpiEcart').textContent = '—';
        document.getElementById('kpiEcart').classList.remove('good', 'warn');
    }
}

// === Footer actions ===
function bindFooter() {
    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('resetTripBtn').addEventListener('click', () => {
        if (!confirm(`Réinitialiser les saisies du trajet « ${STATE.currentTripId.toUpperCase()} » ?`)) return;
        delete STATE.reels[STATE.currentTripId];
        saveReels();
        renderTrip();
    });
    document.getElementById('resetAllBtn').addEventListener('click', () => {
        if (!confirm('Réinitialiser TOUTES les saisies de tous les trajets ?')) return;
        STATE.reels = {};
        saveReels();
        renderTrip();
    });
}

function exportJSON() {
    const out = {
        version: 1,
        exporte_le: new Date().toISOString(),
        voyage: STATE.data.voyage,
        reels: STATE.reels,
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roadtrip-ev-reels-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('Export JSON téléchargé');
}

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}
