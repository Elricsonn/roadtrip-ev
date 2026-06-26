// === Road Trip EV v2 — logique principale ===
// Aligné sur le classeur Excel v3 (Synthèse transposée, conso paramétrable par jour,
// coûts Péages/Recharges/Total). L7 et L16 dérivées des heures saisies.
// Étapes : skip (toggle) + insertion d'étapes custom (recharge imprévue, pause…).

const STORAGE_KEY = 'roadtrip-ev-v2';
const STATE = {
    data: null,
    currentTabId: null,
    reels: {},     // reels[tripId][key]{field}  — key = "0".."n" pour base, "c-…" pour custom
    costs: {},     // costs[dayIdx]{peages|recharges}
    skipped: {},   // skipped[tripId][key] = true
    customs: {},   // customs[tripId] = [{ id, after, lieu, action }]
};

// === Chargement initial ===
fetch('data.json?v=' + Date.now()).then(r => r.json()).then(data => {
    STATE.data = data;
    const persisted = loadStore();
    STATE.reels   = persisted.reels   || {};
    STATE.costs   = persisted.costs   || {};
    STATE.skipped = persisted.skipped || {};
    STATE.customs = persisted.customs || {};
    STATE.currentTabId = 'synthese';
    renderTabs();
    renderCurrent();
    bindFooter();
});

// === LocalStorage ===
function loadStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
}
function saveStore() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        reels: STATE.reels, costs: STATE.costs,
        skipped: STATE.skipped, customs: STATE.customs,
    }));
}
function getReel(tripId, key, field) {
    return STATE.reels?.[tripId]?.[key]?.[field] ?? '';
}
function setReel(tripId, key, field, value) {
    if (!STATE.reels[tripId]) STATE.reels[tripId] = {};
    if (!STATE.reels[tripId][key]) STATE.reels[tripId][key] = {};
    if (value === '' || value == null) delete STATE.reels[tripId][key][field];
    else STATE.reels[tripId][key][field] = value;
    saveStore();
}
function getCost(dayIdx, field) {
    return STATE.costs?.[dayIdx]?.[field] ?? '';
}
function setCost(dayIdx, field, value) {
    if (!STATE.costs[dayIdx]) STATE.costs[dayIdx] = {};
    if (value === '' || value == null) delete STATE.costs[dayIdx][field];
    else STATE.costs[dayIdx][field] = parseFloat(value);
    saveStore();
}
function isSkipped(tripId, key) {
    return !!STATE.skipped?.[tripId]?.[key];
}
function toggleSkip(tripId, key) {
    if (!STATE.skipped[tripId]) STATE.skipped[tripId] = {};
    if (STATE.skipped[tripId][key]) delete STATE.skipped[tripId][key];
    else STATE.skipped[tripId][key] = true;
    saveStore();
}

// === Onglets ===
function renderTabs() {
    const nav = document.getElementById('tripTabs');
    nav.innerHTML = '';
    nav.appendChild(makeTab('synthese', 'Σ', 'Synthèse'));
    STATE.data.trajets.forEach(t => {
        nav.appendChild(makeTab(t.id, t.id.toUpperCase(), t.titre));
    });
}
function makeTab(id, label, title) {
    const btn = document.createElement('button');
    btn.className = 'trip-tab' + (id === STATE.currentTabId ? ' active' : '');
    btn.textContent = label;
    btn.title = title;
    btn.addEventListener('click', () => {
        STATE.currentTabId = id;
        renderTabs();
        renderCurrent();
    });
    return btn;
}

function renderCurrent() {
    if (STATE.currentTabId === 'synthese') renderSynthese();
    else renderTrip();
}

// === Vue Synthèse ===
function renderSynthese() {
    document.getElementById('tripView').hidden = true;
    document.getElementById('syntheseView').hidden = false;

    const s = STATE.data.synthese;
    const labels = s.day_labels;
    const lignes = s.lignes;

    document.getElementById('synthVoyage').textContent = STATE.data.voyage.nom;
    document.getElementById('synthSousTitre').textContent = STATE.data.voyage.sous_titre || '';

    const table = document.getElementById('synthTable');
    table.innerHTML = '';
    const headRow = document.createElement('tr');
    headRow.appendChild(th(''));
    labels.forEach(l => headRow.appendChild(th(l)));
    headRow.appendChild(th('Total', 'total-col'));
    table.appendChild(headRow);

    appendRow(table, 'Date', lignes.date, labels.length);
    appendRow(table, 'Trajet', lignes.trajet, labels.length, true);
    appendRow(table, 'Distance', lignes.distance_km, labels.length, false, v => v != null ? `${v} km` : '—');
    appendRow(table, 'Durée totale', lignes.duree_totale, labels.length);
    appendRow(table, 'dont conduite', lignes.conduite, labels.length);
    appendRow(table, 'dont pauses', lignes.pauses_recharges, labels.length);
    appendRow(table, 'Recharges', lignes.nb_recharges, labels.length);
    appendRow(table, 'Conso (kWh/km)', lignes.conso_kwh_par_km, labels.length, false, v => v != null ? Number(v).toFixed(3) : '—');

    const costsTable = document.getElementById('synthCosts');
    costsTable.innerHTML = '';
    const ch = document.createElement('tr');
    ch.appendChild(th(''));
    labels.forEach(l => ch.appendChild(th(l)));
    ch.appendChild(th('Total', 'total-col'));
    costsTable.appendChild(ch);

    costsTable.appendChild(costRow('Péages €', 'peages', labels.length));
    costsTable.appendChild(costRow('Recharges €', 'recharges', labels.length));
    costsTable.appendChild(totalCostRow('Total €', labels.length));

    updateCostTotals();
    updateKPIs();
}

function th(text, cls) {
    const el = document.createElement('th');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
}
function td(text, cls) {
    const el = document.createElement('td');
    el.textContent = text;
    if (cls) el.className = cls;
    return el;
}
function appendRow(table, label, ligne, dayCount, dim, fmt) {
    const tr = document.createElement('tr');
    const labelTd = td(label, 'row-label');
    if (dim) labelTd.classList.add('row-label-dim');
    tr.appendChild(labelTd);
    for (let i = 0; i < dayCount; i++) {
        const v = ligne?.jours?.[i];
        tr.appendChild(td(fmt ? fmt(v) : (v != null ? String(v) : '—')));
    }
    const tot = ligne?.total;
    tr.appendChild(td(fmt ? fmt(tot) : (tot != null ? String(tot) : '—'), 'total-col'));
    table.appendChild(tr);
}
function costRow(label, field, dayCount) {
    const tr = document.createElement('tr');
    tr.appendChild(td(label, 'row-label'));
    for (let i = 0; i < dayCount; i++) {
        const cell = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.inputMode = 'decimal';
        inp.step = '0.01';
        inp.placeholder = '—';
        inp.value = getCost(i, field);
        inp.addEventListener('change', () => {
            setCost(i, field, inp.value);
            updateCostTotals();
        });
        cell.appendChild(inp);
        tr.appendChild(cell);
    }
    tr.appendChild(td('—', `total-col cost-total cost-total-${field}`));
    return tr;
}
function totalCostRow(label, dayCount) {
    const tr = document.createElement('tr');
    tr.className = 'cost-total-row';
    tr.appendChild(td(label, 'row-label'));
    for (let i = 0; i < dayCount; i++) {
        tr.appendChild(td('—', `cost-day-total cost-day-${i}`));
    }
    tr.appendChild(td('—', 'total-col cost-grand-total'));
    return tr;
}
function updateCostTotals() {
    const dayCount = STATE.data.synthese.day_labels.length;
    let grandTotal = 0, peagesGrand = 0, rechargesGrand = 0;
    for (let i = 0; i < dayCount; i++) {
        const p = parseFloat(getCost(i, 'peages')) || 0;
        const r = parseFloat(getCost(i, 'recharges')) || 0;
        const sum = p + r;
        peagesGrand += p; rechargesGrand += r; grandTotal += sum;
        const cell = document.querySelector(`.cost-day-${i}`);
        if (cell) cell.textContent = sum > 0 ? fmtEur(sum) : '—';
    }
    const pT = document.querySelector('.cost-total-peages');
    if (pT) pT.textContent = peagesGrand > 0 ? fmtEur(peagesGrand) : '—';
    const rT = document.querySelector('.cost-total-recharges');
    if (rT) rT.textContent = rechargesGrand > 0 ? fmtEur(rechargesGrand) : '—';
    const gT = document.querySelector('.cost-grand-total');
    if (gT) gT.textContent = grandTotal > 0 ? fmtEur(grandTotal) : '—';
}
function fmtEur(v) { return v.toFixed(2).replace('.', ',') + ' €'; }

// === Vue trajet (jour J1..Jn) ===
function renderTrip() {
    document.getElementById('syntheseView').hidden = true;
    document.getElementById('tripView').hidden = false;

    const t = STATE.data.trajets.find(x => x.id === STATE.currentTabId);
    if (!t) return;
    document.getElementById('tripTitle').textContent = t.titre;
    document.getElementById('tripSubtitle').textContent = t.sous_titre || '';

    const container = document.getElementById('etapes');
    container.innerHTML = '';

    const list = buildRenderList(t);
    list.forEach((item, pos) => {
        const isFirst = pos === 0;
        const isLast = pos === list.length - 1;
        container.appendChild(renderEtape(t, item, list, pos, isFirst, isLast));
        // Bouton "+" entre chaque paire (pas après la dernière)
        if (!isLast) container.appendChild(renderInsertButton(t, item));
    });

    updateKPIs();
}

// Construit la liste rendue : étapes base + customs intercalées
function buildRenderList(trip) {
    const list = [];
    trip.etapes.forEach((e, idx) => {
        list.push({ kind: 'base', key: String(idx), etape: e, baseIdx: idx });
        (STATE.customs[trip.id] || [])
            .filter(c => c.after === idx)
            .forEach(c => list.push({ kind: 'custom', key: c.id, etape: c }));
    });
    return list;
}

// Étape précédente non-skippée dans la liste rendue
function prevActiveKey(tripId, list, pos) {
    for (let i = pos - 1; i >= 0; i--) {
        if (!isSkipped(tripId, list[i].key)) return list[i].key;
    }
    return null;
}

function renderEtape(trip, item, list, pos, isFirst, isLast) {
    const isCustom = item.kind === 'custom';
    const skipped = isSkipped(trip.id, item.key);
    const card = document.createElement('section');
    card.className = 'etape' + (skipped ? ' skipped' : '') + (isCustom ? ' etape-custom' : '');

    const head = document.createElement('div');
    head.className = 'etape-head';

    const lieuWrap = document.createElement('div');
    lieuWrap.className = 'etape-lieu-wrap';
    const lieu = document.createElement('div');
    lieu.className = 'etape-lieu';
    lieu.textContent = item.etape.lieu || '(sans lieu)';
    lieuWrap.appendChild(lieu);
    if (item.etape.action) {
        const action = document.createElement('div');
        action.className = 'etape-action';
        action.textContent = item.etape.action;
        lieuWrap.appendChild(action);
    }
    if (isCustom) {
        const badge = document.createElement('div');
        badge.className = 'etape-badge';
        badge.textContent = 'Intercalée';
        lieuWrap.appendChild(badge);
    }
    head.appendChild(lieuWrap);

    // Actions (skip / delete custom)
    const actions = document.createElement('div');
    actions.className = 'etape-actions';
    if (isCustom) {
        const del = document.createElement('button');
        del.className = 'etape-action-btn';
        del.title = 'Supprimer cette étape intercalée';
        del.textContent = '🗑';
        del.addEventListener('click', () => removeCustom(trip.id, item.key));
        actions.appendChild(del);
    } else if (!isFirst && !isLast) {
        const skip = document.createElement('button');
        skip.className = 'etape-action-btn' + (skipped ? ' active' : '');
        skip.title = skipped ? 'Réactiver cette étape' : 'Sauter cette étape';
        skip.textContent = skipped ? '↺' : '🗑';
        skip.addEventListener('click', () => {
            toggleSkip(trip.id, item.key);
            renderTrip();
        });
        actions.appendChild(skip);
    }
    head.appendChild(actions);
    card.appendChild(head);

    if (skipped) {
        const note = document.createElement('div');
        note.className = 'etape-skipped-note';
        note.textContent = '⚠ Étape sautée — non comptabilisée dans les KPIs';
        card.appendChild(note);
        return card;
    }

    const grid = document.createElement('div');
    grid.className = 'etape-grid';

    // Heures théoriques recalculées en cascade depuis le dernier départ réel connu
    const rt = (!isCustom) ? recalcTimes(trip, list, pos) : { arrivee: null, depart: null };

    // Bloc Arrivée (skip pour 1ère étape)
    if (!isFirst) {
        if (!isCustom && item.etape.distance_prevue != null) {
            grid.appendChild(field('Distance prévue', `${item.etape.distance_prevue} km`, null));
        }
        grid.appendChild(field('Distance réelle', null, 'number', trip.id, item.key, 'distance_reelle', 'km'));
        if (!isCustom && item.etape.duree_prevue) {
            grid.appendChild(field('Durée prévue', item.etape.duree_prevue, null));
        }
        const dureeReelle = computeDureeTrajet(trip.id, list, pos);
        grid.appendChild(field('Durée réelle', dureeReelle || '—', null, null, null, null, null, 'derived'));
        if (!isCustom && item.etape.heure_arrivee_prevue) {
            if (rt.arrivee) {
                grid.appendChild(field('Heure arr. recalculée', rt.arrivee, null, null, null, null, null, 'derived'));
            } else {
                grid.appendChild(field('Heure arr. prévue', item.etape.heure_arrivee_prevue, null));
            }
        }
        grid.appendChild(field('Heure arr. réelle', null, 'time', trip.id, item.key, 'heure_arrivee_reelle'));
        if (!isCustom && item.etape.charge_arrivee_prevue != null) {
            grid.appendChild(field('Charge arr. prévue', fmtPct(item.etape.charge_arrivee_prevue), null));
        }
        grid.appendChild(field('Charge arr. réelle %', null, 'number', trip.id, item.key, 'charge_arrivee_reelle', '0-100'));
    }

    // Bloc Départ (skip pour dernière)
    if (!isLast) {
        if (!isFirst) {
            const sep = document.createElement('div');
            sep.className = 'field-wide separator';
            grid.appendChild(sep);
        }
        if (!isCustom && item.etape.heure_depart_prevue) {
            if (rt.depart) {
                grid.appendChild(field('Heure dép. recalculée', rt.depart, null, null, null, null, null, 'derived'));
            } else {
                grid.appendChild(field('Heure dép. prévue', item.etape.heure_depart_prevue, null));
            }
        }
        grid.appendChild(field('Heure dép. réelle', null, 'time', trip.id, item.key, 'heure_depart_reelle'));
        if (!isFirst) {
            if (!isCustom && item.etape.duree_action_prevue) {
                grid.appendChild(field('Durée action prévue', item.etape.duree_action_prevue, null));
            }
            const dureeAction = computeDureeAction(trip.id, item.key);
            grid.appendChild(field('Durée action réelle', dureeAction || '—', null, null, null, null, null, 'derived'));
        }
        if (!isCustom && item.etape.charge_depart_prevue != null) {
            grid.appendChild(field('Charge dép. prévue', fmtPct(item.etape.charge_depart_prevue), null));
        }
        grid.appendChild(field('Charge dép. réelle %', null, 'number', trip.id, item.key, 'charge_depart_reelle', '0-100'));
    }

    card.appendChild(grid);
    return card;
}

function renderInsertButton(trip, item) {
    const wrap = document.createElement('div');
    wrap.className = 'insert-row';
    const btn = document.createElement('button');
    btn.className = 'insert-btn';
    btn.textContent = '＋ Intercaler une étape';
    btn.addEventListener('click', () => insertCustom(trip, item));
    wrap.appendChild(btn);
    return wrap;
}

// === Customs : insert / remove ===
function insertCustom(trip, item) {
    // L'étape custom est ancrée APRÈS l'étape "base" en cours (ou après le base parent si on est sur une custom)
    const afterBaseIdx = (item.kind === 'base') ? item.baseIdx : findBaseIdxForCustom(trip.id, item.key);
    const lieu = prompt('Lieu de l\'étape à intercaler ?', '');
    if (lieu === null || !lieu.trim()) return;
    const action = prompt('Action ? (ex : ⚡ Recharge, 🍴 Repas, 🚿 Pause)', '⚡ Recharge');
    if (action === null) return;

    const newCustom = {
        id: 'c-' + Date.now().toString(36),
        after: afterBaseIdx,
        lieu: lieu.trim(),
        action: action.trim() || '',
    };
    if (!STATE.customs[trip.id]) STATE.customs[trip.id] = [];
    STATE.customs[trip.id].push(newCustom);
    saveStore();
    renderTrip();
}
function findBaseIdxForCustom(tripId, customId) {
    const c = (STATE.customs[tripId] || []).find(x => x.id === customId);
    return c ? c.after : 0;
}
function removeCustom(tripId, customId) {
    if (!confirm('Supprimer cette étape intercalée ?')) return;
    STATE.customs[tripId] = (STATE.customs[tripId] || []).filter(c => c.id !== customId);
    if (STATE.reels[tripId]) delete STATE.reels[tripId][customId];
    if (STATE.skipped[tripId]) delete STATE.skipped[tripId][customId];
    saveStore();
    renderTrip();
}

function field(label, prevuText, inputType, tripId, key, fieldKey, placeholder, variant) {
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `<div class="field-label">${escapeHtml(label)}</div>`;
    if (prevuText !== null) {
        const p = document.createElement('div');
        p.className = variant === 'derived' ? 'field-derived' : 'field-prevu';
        p.textContent = prevuText;
        div.appendChild(p);
    }
    if (inputType) {
        const wrap = document.createElement('div');
        wrap.className = 'field-input';
        const inp = document.createElement('input');
        inp.type = inputType;
        if (inputType === 'number') { inp.inputMode = 'decimal'; inp.step = 'any'; }
        if (placeholder) inp.placeholder = placeholder;
        inp.value = getReel(tripId, key, fieldKey);
        inp.addEventListener('change', () => {
            setReel(tripId, key, fieldKey, inp.value);
            renderTrip();
        });
        wrap.appendChild(inp);
        div.appendChild(wrap);
    }
    return div;
}

// === Dérivations L7 / L16 ===
function parseHHMM(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{1,2})[h:](\d{0,2})/);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mn = m[2] ? parseInt(m[2], 10) : 0;
    if (isNaN(h) || isNaN(mn)) return null;
    return h * 60 + mn;
}
function fmtDuree(mn) {
    if (mn == null || mn < 0) return null;
    const h = Math.floor(mn / 60);
    const m = mn % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
}
function computeDureeTrajet(tripId, list, pos) {
    const prevKey = prevActiveKey(tripId, list, pos);
    if (prevKey == null) return null;
    const arr = parseHHMM(getReel(tripId, list[pos].key, 'heure_arrivee_reelle'));
    const dep = parseHHMM(getReel(tripId, prevKey, 'heure_depart_reelle'));
    if (arr == null || dep == null) return null;
    return fmtDuree(arr - dep);
}
function computeDureeAction(tripId, key) {
    const dep = parseHHMM(getReel(tripId, key, 'heure_depart_reelle'));
    const arr = parseHHMM(getReel(tripId, key, 'heure_arrivee_reelle'));
    if (dep == null || arr == null) return null;
    return fmtDuree(dep - arr);
}

// Recalcule les heures THÉORIQUES (arrivée + départ) de l'étape `pos` en cascade
// depuis le dernier départ RÉEL connu en amont. Tant qu'aucun départ réel n'existe
// en amont → renvoie null (on garde alors les heures prévues d'origine de data.json).
function recalcTimes(trip, list, pos) {
    let effDep = null, hasReal = false, seenFirst = false;
    for (let i = 0; i < list.length; i++) {
        if (isSkipped(trip.id, list[i].key)) continue;
        const item = list[i];
        if (!seenFirst) {
            seenFirst = true;
            const rd = parseHHMM(getReel(trip.id, item.key, 'heure_depart_reelle'));
            if (rd != null) { effDep = rd; hasReal = true; }
            else { effDep = parseHHMM(item.etape && item.etape.heure_depart_prevue); hasReal = false; }
            if (i === pos) return { arrivee: null, depart: null };
            continue;
        }
        const dureePrev = item.etape ? parseHHMM(item.etape.duree_prevue) : null;
        const arrMin = (hasReal && effDep != null && dureePrev != null) ? effDep + dureePrev : null;
        const action = item.etape ? parseHHMM(item.etape.duree_action_prevue) : null;
        const departMin = (arrMin != null) ? (action != null ? arrMin + action : arrMin) : null;
        if (i === pos) {
            return {
                arrivee: arrMin != null ? fmtDuree(arrMin) : null,
                depart: (hasReal && departMin != null) ? fmtDuree(departMin) : null,
            };
        }
        const rd = parseHHMM(getReel(trip.id, item.key, 'heure_depart_reelle'));
        if (rd != null) { effDep = rd; hasReal = true; }
        else if (arrMin != null) { effDep = departMin; }
        else { effDep = parseHHMM(item.etape && item.etape.heure_depart_prevue); }
    }
    return { arrivee: null, depart: null };
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

// === KPIs ===
function updateKPIs() {
    const cap = STATE.data.voiture.capacite_utile_kwh;
    let distance = 0, kwh = 0, consoTheoRef;

    if (STATE.currentTabId === 'synthese') {
        STATE.data.trajets.forEach(t => {
            const accum = accumulateTrip(t);
            distance += accum.distance;
            kwh += accum.kwh;
        });
        consoTheoRef = STATE.data.synthese.lignes.conso_kwh_par_km.total
            || STATE.data.trajets[0]?.conso_jour
            || 0.205;
    } else {
        const t = STATE.data.trajets.find(x => x.id === STATE.currentTabId);
        if (!t) return;
        const accum = accumulateTrip(t);
        distance = accum.distance;
        kwh = accum.kwh;
        consoTheoRef = t.conso_jour || 0.205;
    }

    if (distance > 0 && kwh > 0) {
        const conso = (kwh / distance) * 100;
        document.getElementById('kpiConso').textContent = conso.toFixed(1) + ' kWh/100';
        const auto = cap / (kwh / distance);
        document.getElementById('kpiAutonomie').textContent = Math.round(auto) + ' km';
        const consoTheo100 = consoTheoRef * 100;
        const ecart = conso - consoTheo100;
        const ecartEl = document.getElementById('kpiEcart');
        ecartEl.textContent = (ecart >= 0 ? '+' : '') + ecart.toFixed(1) + ' kWh/100';
        ecartEl.classList.remove('good', 'warn');
        ecartEl.classList.add(ecart > 0 ? 'warn' : 'good');
    } else {
        document.getElementById('kpiConso').textContent = '— kWh/100';
        document.getElementById('kpiAutonomie').textContent = '— km';
        document.getElementById('kpiEcart').textContent = '—';
        document.getElementById('kpiEcart').classList.remove('good', 'warn');
    }
}

function accumulateTrip(t) {
    const cap = STATE.data.voiture.capacite_utile_kwh;
    const list = buildRenderList(t);
    let distance = 0, kwh = 0;
    for (let pos = 0; pos < list.length; pos++) {
        const cur = list[pos];
        if (isSkipped(t.id, cur.key)) continue;
        const prevKey = prevActiveKey(t.id, list, pos);
        if (prevKey == null) continue;
        const d = parseFloat(getReel(t.id, cur.key, 'distance_reelle'));
        const chargeDepPrev = parseFloat(getReel(t.id, prevKey, 'charge_depart_reelle'));
        const chargeArr = parseFloat(getReel(t.id, cur.key, 'charge_arrivee_reelle'));
        if (!isNaN(d) && !isNaN(chargeDepPrev) && !isNaN(chargeArr)) {
            distance += d;
            kwh += (chargeDepPrev - chargeArr) / 100 * cap;
        }
    }
    return { distance, kwh };
}

// === Footer ===
function bindFooter() {
    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('resetTripBtn').addEventListener('click', () => {
        if (STATE.currentTabId === 'synthese') {
            if (!confirm('Réinitialiser tous les coûts saisis (Péages + Recharges) ?')) return;
            STATE.costs = {};
            saveStore();
            renderSynthese();
        } else {
            if (!confirm(`Réinitialiser le trajet « ${STATE.currentTabId.toUpperCase()} » (réels, étapes sautées, étapes intercalées) ?`)) return;
            delete STATE.reels[STATE.currentTabId];
            delete STATE.skipped[STATE.currentTabId];
            delete STATE.customs[STATE.currentTabId];
            saveStore();
            renderTrip();
        }
    });
    document.getElementById('resetAllBtn').addEventListener('click', () => {
        if (!confirm('Réinitialiser TOUTES les saisies (réels + coûts + skips + intercalées) ?')) return;
        STATE.reels = {}; STATE.costs = {};
        STATE.skipped = {}; STATE.customs = {};
        saveStore();
        renderCurrent();
    });
}

function exportJSON() {
    const out = {
        version: 2,
        exporte_le: new Date().toISOString(),
        voyage: STATE.data.voyage,
        reels: STATE.reels,
        costs: STATE.costs,
        skipped: STATE.skipped,
        customs: STATE.customs,
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
