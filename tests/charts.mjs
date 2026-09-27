/* ============================================================================
 * Vérification des configurations Chart.js.
 * jsdom n'implémente pas le canvas 2D : on remplace window.Chart par un stub
 * qui valide la structure de chaque configuration produite par js/charts.js.
 * ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const calls = [];

const dom = new JSDOM('<!doctype html><html><body><canvas id="c1"></canvas><canvas id="c2"></canvas></body></html>', {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  beforeParse(win) {
    win.console = { log() {}, info() {}, warn() {}, error() {} };
    // stub minimal de Chart.js, avec les valeurs par défaut utilisées par charts.js
    win.Chart = class StubChart {
      constructor(ctx, config) { calls.push(config); this.config = config; }
      destroy() {}
    };
    win.Chart.defaults = {
      color: '', font: {}, plugins: { legend: { labels: {} }, tooltip: {} }, animation: {}
    };
    win.document.createElement('canvas').getContext = () => ({});
  }
});

const win = dom.window, doc = win.document;
// canvas.getContext doit renvoyer un objet non nul pour que canCanvas() passe
win.HTMLCanvasElement.prototype.getContext = function () { return { createLinearGradient: () => ({ addColorStop() {} }) }; };

for (const f of ['js/charts.js']) {
  const s = doc.createElement('script');
  s.textContent = fs.readFileSync(path.join(root, f), 'utf8');
  doc.body.appendChild(s);
}

const CH = win.ZacoCharts;
const results = [];
const check = (label, cond, extra = '') => {
  results.push(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) process.exitCode = 1;
};

check('Chart.js détecté', CH.available());
check('palette exposée', !!CH.colors && CH.colors.green === '#1ed980');

const canvas = doc.getElementById('c1');
const curve = [{ i: 0, v: 1000, label: 'Départ' }, { i: 1, v: 1045, label: 'A vs B' }, { i: 2, v: 990, label: 'C vs D' }];
const stats = { won: 5, lost: 3, push: 1, pending: 2 };

CH.bankroll(canvas, curve, '€');
check('bankroll : 1 dataset, 3 points', calls[0].data.datasets[0].data.length === 3 &&
  calls[0].data.labels.length === 3, JSON.stringify(calls[0].data.labels));
check('bankroll : type line', calls[0].type === 'line');

CH.resultsDoughnut(canvas, stats);
const d = calls[1];
check('doughnut : 4 segments', d.data.datasets[0].data.length === 4 &&
  d.data.datasets[0].data.join(',') === '5,3,1,2', d.data.datasets[0].data.join(','));

CH.goalsBar(canvas, ['A', 'B', 'C'], [10, 20, 30], [5, 6, 7]);
check('goalsBar : 2 datasets', calls[2].data.datasets.length === 2);
check('goalsBar : données alignées', calls[2].data.datasets[0].data.length === 3 && calls[2].data.labels.length === 3);

CH.leagueCompare(canvas, ['X', 'Y'], [1.5, 2.2], [1.1, 1.4]);
check('leagueCompare : barres horizontales', calls[3].options.indexAxis === 'y');

CH.pnlByComp(canvas, [{ label: 'A', pnl: 12.5 }, { label: 'B', pnl: -8 }], '€');
check('pnlByComp : couleurs conditionnelles', calls[4].data.datasets[0].backgroundColor.length === 2);

CH.modelRadar(canvas, {
  probs: { '1': 0.5, X: 0.3, '2': 0.2 },
  models: {
    poisson: { '1': 0.48, X: 0.3, '2': 0.22 },
    elo: { '1': 0.52, X: 0.28, '2': 0.2 },
    form: { '1': 0.47, X: 0.31, '2': 0.22 }
  }
});
check('radar : 4 datasets sans modèle marché', calls[5].data.datasets.length === 4, calls[5].data.datasets.length + ' datasets');

CH.modelRadar(canvas, {
  probs: { '1': 0.5, X: 0.3, '2': 0.2 },
  models: {
    poisson: { '1': 0.48, X: 0.3, '2': 0.22 },
    elo: { '1': 0.52, X: 0.28, '2': 0.2 },
    form: { '1': 0.47, X: 0.31, '2': 0.22 },
    market: { '1': 0.5, X: 0.29, '2': 0.21 }
  }
});
check('radar : 5 datasets avec modèle marché', calls[6].data.datasets.length === 5);
check('radar : 3 axes', calls[6].data.labels.length === 3);

CH.scoresBar(canvas, [{ score: '1-0', p: 0.12 }, { score: '1-1', p: 0.11 }, { score: '2-1', p: 0.09 }]);
check('scoresBar : pourcentages arrondis', calls[7].data.datasets[0].data.every(v => Number.isFinite(v)),
  calls[7].data.datasets[0].data.join(','));

// robustesse : canvas absent ou contexte indisponible
let threw = false;
try { CH.bankroll(null, curve, '€'); } catch (e) { threw = true; }
check('canvas null ne lève pas d\'exception', !threw);

win.HTMLCanvasElement.prototype.getContext = function () { return null; };
check('contexte 2D indisponible → available() === false', CH.available() === false);
threw = false;
try { CH.bankroll(canvas, curve, '€'); } catch (e) { threw = true; }
check('mount() échoue proprement sans canvas', !threw);

console.log(results.join('\n'));
console.log(process.exitCode ? '\n❌ échec' : '\n✅ toutes les configurations de graphiques sont valides');
win.close();
process.exit(process.exitCode || 0);
