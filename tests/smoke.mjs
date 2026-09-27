import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');
// on retire Chart.js (jsdom n'a pas de canvas 2D) : les chemins de graphiques
// sont testés séparément avec un stub.
html = html.replace(/<script src="vendor\/chart\.umd\.js"><\/script>/, '');

const errors = [], warns = [];
const dom = new JSDOM(html, {
  url: 'http://localhost:5173/',
  runScripts: 'dangerously',
  resources: undefined,
  pretendToBeVisual: true,
  beforeParse(win) {
    win.fetch = () => Promise.reject(new Error('offline (test)'));
    win.addEventListener('error', e => errors.push('window.error: ' + (e.message||e.error)));
    const oc = win.console;
    win.console = { ...oc, error:(...a)=>errors.push('console.error: '+a.join(' ')),
                    warn:(...a)=>warns.push('console.warn: '+a.join(' ')),
                    log:()=>{}, info:()=>{}, debug:()=>{} };
    win.addEventListener('unhandledrejection', e => errors.push('unhandled: '+e.reason));
  }
});
const win = dom.window, doc = win.document;

// injecte les scripts manuellement (jsdom sans resources ne charge pas les src)
const files = ['js/data/snapshot.js','js/model.js','js/api.js','js/bankroll.js','js/charts.js','js/ui.js','js/app.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(root,f),'utf8');
  const s = doc.createElement('script'); s.textContent = code; doc.body.appendChild(s);
}
win.document.dispatchEvent(new win.Event('DOMContentLoaded'));

await new Promise(r => setTimeout(r, 250));

const q = sel => doc.querySelector(sel);
const out = [];
function check(label, cond, extra='') { out.push(`${cond?'✓':'✗'} ${label}${extra?' — '+extra:''}`); if(!cond) process.exitCode = 1; }

check('heroStats rempli', q('#heroStats').children.length === 6, q('#heroStats').children.length+' tuiles');
check('modeChip présent', /Snapshot/.test(q('#modeChip').textContent));
check('bulles live rendues', q('#liveBubbles').children.length > 0, doc.querySelectorAll('#liveBubbles .bubble').length+' bulles');
check('grille live rendue', doc.querySelectorAll('#liveGrid .match-card').length > 0, doc.querySelectorAll('#liveGrid .match-card').length+' cartes');
check('pronostics rendus', doc.querySelectorAll('#proGrid .pro-card').length > 0, doc.querySelectorAll('#proGrid .pro-card').length+' cartes');
check('puces compétitions', doc.querySelectorAll('#compChips .chip').length >= 5, doc.querySelectorAll('#compChips .chip').length+' puces');
check('calendrier rendu', doc.querySelectorAll('#calendarBody .match-card').length > 0, doc.querySelectorAll('#calendarBody .match-card').length+' cartes');
check('calendrier groupé par jour', doc.querySelectorAll('#calendarBody .section').length > 0, doc.querySelectorAll('#calendarBody .section').length+' jours');
check('cartes compétitions', doc.querySelectorAll('#compGrid .comp-card').length === 9, doc.querySelectorAll('#compGrid .comp-card').length+' cartes');
check('classement rendu', doc.querySelectorAll('#standingsBody table.standings tbody tr').length >= 15, doc.querySelectorAll('#standingsBody tbody tr').length+' lignes');
check('KPIs bankroll', doc.querySelectorAll('#bankKpis .kpi').length === 8, doc.querySelectorAll('#bankKpis .kpi').length+' KPI');
check('sélecteur de match bankroll', q('#betMatch').options.length > 5, q('#betMatch').options.length+' options');
check('analyse de pari affichée', q('#betAnalysis').innerHTML.length > 50);
check('historique rendu', doc.querySelectorAll('#histGrid .hist-card').length > 0, doc.querySelectorAll('#histGrid .hist-card').length+' cartes');
check('résumé historique', doc.querySelectorAll('#histSummary .kpi').length === 4);
check('validation modèle', doc.querySelectorAll('#validationBody tbody tr').length > 0, doc.querySelectorAll('#validationBody tbody tr').length+' lignes');
check('stats données', doc.querySelectorAll('#dataStats .kpi').length === 6);
check('section Coupe du monde', /Espagne/.test(q('#wcBody').textContent) && /Argentine/.test(q('#wcBody').textContent));
check('sources rendues', doc.querySelectorAll('#sourcesBody .card').length >= 4);
check('stat total', q('#statTotal').textContent === '44', q('#statTotal').textContent);

// --- interactions ---
const chipPast = doc.querySelector('[data-filter-range="past"]');
chipPast.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
check('filtre "Terminés" actif', chipPast.classList.contains('is-active'));
const nPast = doc.querySelectorAll('#calendarBody .match-card').length;
check('filtre terminés → résultats', nPast > 0 && nPast < 44, nPast+' cartes');

const chipAll = doc.querySelector('[data-filter-range="all"]');
chipAll.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
check('filtre "Tout" → 44', doc.querySelectorAll('#calendarBody .match-card').length === 44, doc.querySelectorAll('#calendarBody .match-card').length+' cartes');

const search = q('#searchInput');
search.value = 'bayern'; search.dispatchEvent(new win.Event('input',{bubbles:true}));
check('recherche "bayern"', doc.querySelectorAll('#calendarBody .match-card').length > 0 && doc.querySelectorAll('#calendarBody .match-card').length < 44, doc.querySelectorAll('#calendarBody .match-card').length+' résultats');
search.value=''; search.dispatchEvent(new win.Event('input',{bubbles:true}));

// détail modal
const det = doc.querySelector('[data-detail]');
det.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
check('modale détails ouverte', q('#modal').classList.contains('is-open'));
check('modale contient la comparaison des modèles', /Comparaison des 4 modèles/.test(q('#modalBody').textContent));
q('#modalClose').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
check('modale fermée', !q('#modal').classList.contains('is-open'));

// pari via modale
const betBtn = doc.querySelector('#proGrid [data-bet]');
betBtn.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
check('modale pari ouverte', /Enregistrer un pari/.test(q('#modalBody').textContent));
const mf = q('#modalBetForm');
q('#mOdds').value='2.50'; q('#mStake').value='30';
mf.dispatchEvent(new win.Event('submit',{bubbles:true,cancelable:true}));
await new Promise(r=>setTimeout(r,50));
check('pari enregistré', win.ZacoBank.stats().pending === 1, JSON.stringify({pending:win.ZacoBank.stats().pending}));
check('pari visible en attente', /EN COURS/.test(q('#pendingBets').textContent));

// règlement
const st = doc.querySelector('[data-settle][data-status="won"]');
st.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,50));
const s = win.ZacoBank.stats();
check('règlement gain', s.won === 1 && s.pnl > 0, 'pnl='+s.pnl+' bankroll='+s.bankroll);

// historique d'exemple
doc.getElementById('btnDemoHistory').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,50));
check('historique d\u2019exemple chargé', win.ZacoBank.stats().won + win.ZacoBank.stats().lost >= 8, 'paris='+win.ZacoBank.load().bets.length);
check('filtre historique gagnés', (()=>{const c=doc.querySelector('[data-hist="won"]');c.dispatchEvent(new win.MouseEvent('click',{bubbles:true}));return doc.querySelectorAll('#histGrid .hist-card.won').length>0;})());

// démo live
doc.getElementById('btnDemo').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));
await new Promise(r=>setTimeout(r,120));
check('démo live active', win.document.querySelectorAll('#liveBubbles .bubble.is-live').length > 0, doc.querySelectorAll('#liveBubbles .bubble.is-live').length+' bulles live');
doc.getElementById('btnDemo').dispatchEvent(new win.MouseEvent('click',{bubbles:true}));

console.log(out.join('\n'));
console.log('\n--- erreurs JS (' + errors.length + ') ---');
errors.slice(0,15).forEach(e=>console.log('  '+e));
console.log(errors.length ? '\n❌ ERREURS' : '\n✅ aucun erreur JS');
// arrêt propre : jsdom conserve les setInterval de l'app
win.close();
process.exit(process.exitCode || 0);
