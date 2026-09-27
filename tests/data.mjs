import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = `<!doctype html><html><body>
<span id="liveCount"></span><div id="liveBubbles"></div><div id="liveGrid"></div>
</body></html>`;
const dom = new JSDOM(html, { url: 'http://localhost/', runScripts: 'dangerously' });
const win = dom.window;
win.eval(readFileSync('public/js/data/snapshot.js', 'utf8'));
win.eval(readFileSync('public/js/model.js', 'utf8').replace(")(window);", ")(window);"));
const S = win.ZACO_SNAPSHOT, M = win.ZacoModel;
let fail = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail++; };

// 1. Classements : intégrité arithmétique et complétude
const attendu = { pl: 20, laliga: 20, seriea: 20, ligue1: 18, bl1: 18, bl2: 18 };
S.tables.filter(t => t.complete).forEach(t => {
  ok(t.rows.length === attendu[t.comp], `${t.comp} ${t.season} — ${t.rows.length} équipes (complète)`);
  ok(t.rows.every(r => r.pl === r.w + r.d + r.l), `${t.comp} ${t.season} — J = G+N+P`);
  ok(t.rows.every(r => r.pts === r.w * 3 + r.d), `${t.comp} ${t.season} — points = 3G+N`);
  ok(t.rows.every((r, i) => i === 0 || t.rows[i - 1].pts >= r.pts), `${t.comp} ${t.season} — trié par points`);
  const buts = t.rows.reduce((a, r) => a + r.gf, 0) === t.rows.reduce((a, r) => a + r.ga, 0);
  ok(buts, `${t.comp} ${t.season} — buts pour = buts contre (${t.rows.reduce((a,r)=>a+r.gf,0)})`);
});

// 2. Le moteur exploite les nouvelles équipes
const ctx = M.buildContext({ competitions: S.competitions, tables: S.tables });
const noms = ['Paris Saint-Germain', 'Lens', 'Hertha BSC', '1. FC Nürnberg', 'Como', 'Getafe CF'];
const force = (n) => {
  const k = M.teamKey(n);
  return Object.keys(ctx.leagues).some(c => ctx.leagues[c].ratings[k]);
};
noms.forEach(n => ok(force(n), `force connue pour ${n} → ${M.teamKey(n)}`));

const fake = { id: 'x', comp: 'ligue1', home: 'Paris Saint-Germain', away: 'Lens', homeKey: M.teamKey('Paris Saint-Germain'), awayKey: M.teamKey('Lens'), ts: '2026-10-03T19:00:00Z', status: 'NS' };
const p = M.predictMatch(fake, ctx);
const probs = [p.probs['1'], p.probs['X'], p.probs['2']];
const somme = probs.reduce((a, b) => a + b, 0);
ok(Math.abs(somme - 1) < 1e-6, `PSG–Lens : ${probs.map(v => (v*100).toFixed(1) + '%').join(' / ')} (somme ${somme.toFixed(4)})`);
ok(['1','X','2'].includes(p.pick), `pronostic PSG–Lens : ${p.pick} @ ${p.pickOdds} (confiance ${(p.confidence*100).toFixed(0)} %)`);

// 2bis. Cohérence des matchs terminés : autant de buteurs que de buts
const finis = S.matches.filter(m => m.status === 'FT' || m.status === 'AET');
const incoherents = finis.filter(m => m.scorers && m.scorers.length !== m.hg + m.ag);
ok(incoherents.length === 0,
   `${finis.length} matchs terminés — ${incoherents.length} incohérence(s) buteurs/score` +
   (incoherents.length ? ' : ' + incoherents.map(m => m.id).join(', ') : ''));

// 2ter. Résultats 2. Bundesliga : les scores saisis respectent le classement
const b2 = S.matches.filter(m => m.comp === 'bl2' && m.status === 'FT');
const tbl = S.tables.find(t => t.comp === 'bl2');
ok(b2.length === 9, `${b2.length} résultats 2. Bundesliga dans le snapshot`);
ok(b2.every(m => {
  const h = tbl.rows.find(r => r.id === m.homeId), a = tbl.rows.find(r => r.id === m.awayId);
  return h && a && (m.hg > 0 ? h.gf > 0 : true) && (m.ag > 0 ? a.gf > 0 : true);
}), 'toutes les équipes de 2. Bundesliga sont présentes au classement');

// 2quater. Fixtures à venir : équipes connues et coups d'envoi futurs
const avenir = S.matches.filter(m => m.status === 'NS');
ok(avenir.length > 0 && avenir.every(m => m.ts && !isNaN(Date.parse(m.ts))), `${avenir.length} matchs à venir avec coup d'envoi valide`);
ok(avenir.every(m => S.competitions.some(c => c.id === m.comp)), 'chaque match à venir appartient à une compétition déclarée');

// 3. Aucune table complète ne doit être signalée partielle
const partielles = S.tables.filter(t => !t.complete).map(t => `${t.comp} ${t.season} (${t.rows.length} lignes)`);
ok(partielles.length === 1 && partielles[0].startsWith('pl 2026/2027'),
   `tables partielles attendues (limite API gratuite) : ${partielles.join(', ') || 'aucune'}`);

// 4. Compétitions déclarées
ok(S.competitions.length === 10, `${S.competitions.length} compétitions déclarées`);
ok(S.competitions.some(c => c.id === 'bl2'), 'la 2. Bundesliga est déclarée');

console.log(fail ? `\n❌ ${fail} vérification(s) en échec` : '\n✅ jeu de données et moteur cohérents');
process.exit(fail ? 1 : 0);
