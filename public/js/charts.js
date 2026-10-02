/* ============================================================================
 * ZACO SPORT ODDS — Graphiques (Chart.js 4, copie locale dans /vendor)
 * ----------------------------------------------------------------------------
 * Toutes les fonctions créent ou mettent à jour un graphique existant :
 * les instances sont conservées dans un registre pour éviter les fuites.
 * ========================================================================== */
(function (global) {
  'use strict';

  var registry = {};

  var C = {
    green: '#1ed980', lime: '#b6ff3d', gold: '#ffcf3f', red: '#ff4d4d',
    violet: '#7c4dff', cyan: '#22d3ee', ink: '#eaf2ff', ink2: '#a8bdd8',
    grid: 'rgba(120,170,220,0.12)'
  };

  function defaults() {
    if (!global.Chart) return false;
    Chart.defaults.color = C.ink2;
    Chart.defaults.font.family = "'Manrope', system-ui, sans-serif";
    Chart.defaults.font.size = 11.5;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.boxWidth = 8;
    Chart.defaults.plugins.legend.labels.padding = 14;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(6,17,32,0.96)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(120,200,255,0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 11;
    Chart.defaults.plugins.tooltip.titleFont = { weight: '800' };
    Chart.defaults.plugins.tooltip.cornerRadius = 10;
    Chart.defaults.animation.duration = 900;
    Chart.defaults.animation.easing = 'easeOutQuart';
    return true;
  }

  /** Vérifie qu'un contexte canvas 2D est réellement exploitable. */
  function canCanvas() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext && c.getContext('2d'));
    } catch (e) { return false; }
  }

  function mount(canvas, config) {
    if (!canvas || !defaults() || !canCanvas()) return null;
    var id = canvas.id || (canvas.id = 'c' + Math.random().toString(36).slice(2, 7));
    try {
      if (registry[id]) { registry[id].destroy(); delete registry[id]; }
      registry[id] = new Chart(canvas.getContext('2d'), config);
      return registry[id];
    } catch (e) {
      // un environnement sans canvas 2D (export PDF, iframe restreinte…) ne doit
      // jamais faire échouer le rendu du reste de la page
      if (global.console) global.console.warn('[ZACO] graphique indisponible : ' + e.message);
      return null;
    }
  }

  function gradient(ctx, area, from, to) {
    if (!area) return from;
    var g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, from); g.addColorStop(1, to);
    return g;
  }

  var axisX = { grid: { color: C.grid, drawBorder: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 } };
  var axisY = { grid: { color: C.grid, drawBorder: false }, beginAtZero: true };

  /* --------------------------- 1. Courbe bankroll ----------------------- */
  function bankroll(canvas, curve, currency) {
    var labels = curve.map(function (p) { return p.i === 0 ? 'Départ' : '#' + p.i; });
    return mount(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Bankroll (' + currency + ')',
          data: curve.map(function (p) { return p.v; }),
          borderColor: C.green, borderWidth: 2.5,
          pointRadius: 3, pointHoverRadius: 6,
          pointBackgroundColor: C.lime, pointBorderColor: '#04160c', pointBorderWidth: 1.5,
          tension: 0.35, fill: true,
          backgroundColor: function (c) {
            return gradient(c.chart.ctx, c.chart.chartArea, 'rgba(30,217,128,0.32)', 'rgba(30,217,128,0.01)');
          }
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return '  ' + c.parsed.y.toFixed(2) + ' ' + currency; } } } },
        scales: {
          x: axisX,
          y: { grid: { color: C.grid, drawBorder: false }, ticks: { callback: function (v) { return v + ' ' + currency; } } }
        }
      }
    });
  }

  /* --------------------------- 2. Camembert résultats ------------------- */
  function resultsDoughnut(canvas, s) {
    return mount(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Gagnés', 'Perdus', 'Remboursés', 'En cours'],
        datasets: [{
          data: [s.won, s.lost, s.push, s.pending],
          backgroundColor: ['rgba(30,217,128,0.85)', 'rgba(255,77,77,0.85)', 'rgba(255,207,63,0.85)', 'rgba(34,211,238,0.7)'],
          borderColor: 'rgba(5,15,29,0.9)', borderWidth: 3, hoverOffset: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom' },
          tooltip: { callbacks: { label: function (c) {
            var tot = c.dataset.data.reduce(function (a, b) { return a + b; }, 0) || 1;
            return '  ' + c.label + ' : ' + c.parsed + ' (' + Math.round(c.parsed / tot * 100) + ' %)';
          } } } }
      }
    });
  }

  /* ------------------------ 3. Buts par équipe (barres) ----------------- */
  function goalsBar(canvas, labels, scored, conceded) {
    return mount(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Buts marqués', data: scored, backgroundColor: 'rgba(30,217,128,0.75)', borderRadius: 6, borderSkipped: false },
          { label: 'Buts encaissés', data: conceded, backgroundColor: 'rgba(255,77,77,0.6)', borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end' } },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { maxRotation: 45, minRotation: 0, autoSkip: false, font: { size: 10 } } },
          y: axisY
        }
      }
    });
  }

  /* ---------------------- 4. Comparaison des championnats --------------- */
  function leagueCompare(canvas, labels, avgFor, avgAgainst) {
    return mount(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Buts marqués / match', data: avgFor, backgroundColor: 'rgba(182,255,61,0.8)', borderRadius: 7, borderSkipped: false },
          { label: 'Buts encaissés / match', data: avgAgainst, backgroundColor: 'rgba(124,77,255,0.7)', borderRadius: 7, borderSkipped: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { position: 'bottom' } },
        scales: { x: axisY, y: { grid: { display: false, drawBorder: false } } }
      }
    });
  }

  /* --------------------------- 5. P&L par compétition ------------------- */
  function pnlByComp(canvas, entries, currency) {
    return mount(canvas, {
      type: 'bar',
      data: {
        labels: entries.map(function (e) { return e.label; }),
        datasets: [{
          label: 'Profit / perte (' + currency + ')',
          data: entries.map(function (e) { return e.pnl; }),
          backgroundColor: entries.map(function (e) {
            return e.pnl >= 0 ? 'rgba(30,217,128,0.8)' : 'rgba(255,77,77,0.8)';
          }),
          borderRadius: 7, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false, drawBorder: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: C.grid, drawBorder: false }, ticks: { callback: function (v) { return v + ' ' + currency; } } }
        }
      }
    });
  }

  /* --------------------------- 6. Radar des modèles --------------------- */
  function modelRadar(canvas, pred) {
    var m = pred.models;
    var datasets = [
      { label: 'Consensus ZACO', data: [pred.probs['1'], pred.probs.X, pred.probs['2']], borderColor: C.lime, backgroundColor: 'rgba(182,255,61,0.22)', borderWidth: 2, pointBackgroundColor: C.lime },
      { label: 'Poisson · Dixon-Coles', data: [m.poisson['1'], m.poisson.X, m.poisson['2']], borderColor: C.cyan, backgroundColor: 'rgba(34,211,238,0.12)', borderWidth: 1.6, pointRadius: 2 },
      { label: 'Elo', data: [m.elo['1'], m.elo.X, m.elo['2']], borderColor: C.violet, backgroundColor: 'rgba(124,77,255,0.12)', borderWidth: 1.6, pointRadius: 2 },
      { label: 'Forme', data: [m.form['1'], m.form.X, m.form['2']], borderColor: C.gold, backgroundColor: 'rgba(255,207,63,0.1)', borderWidth: 1.6, pointRadius: 2 }
    ];
    if (m.market) datasets.push({ label: 'Marché', data: [m.market['1'], m.market.X, m.market['2']], borderColor: C.red, backgroundColor: 'rgba(255,77,77,0.1)', borderWidth: 1.6, pointRadius: 2 });

    return mount(canvas, {
      type: 'radar',
      data: { labels: ['Victoire domicile', 'Match nul', 'Victoire extérieur'], datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 6, font: { size: 10 } } } },
        scales: {
          r: {
            beginAtZero: true, suggestedMax: Math.max(0.6, pred.probs['1'] + 0.1),
            grid: { color: C.grid }, angleLines: { color: C.grid },
            pointLabels: { color: C.ink2, font: { size: 10.5, weight: '700' } },
            ticks: { backdropColor: 'transparent', color: 'rgba(168,189,216,0.4)', font: { size: 9 },
              callback: function (v) { return Math.round(v * 100) + '%'; } }
          }
        }
      }
    });
  }

  /* ------------------------ 7. Distribution des scores ------------------ */
  function scoresBar(canvas, scores) {
    return mount(canvas, {
      type: 'bar',
      data: {
        labels: scores.map(function (s) { return s.score; }),
        datasets: [{
          label: 'Probabilité du score exact',
          data: scores.map(function (s) { return +(s.p * 100).toFixed(1); }),
          backgroundColor: 'rgba(34,211,238,0.7)', borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false },
          tooltip: { callbacks: { label: function (c) { return '  ' + c.parsed.y + ' %'; } } } },
        scales: { x: { grid: { display: false, drawBorder: false } },
          y: { grid: { color: C.grid, drawBorder: false }, ticks: { callback: function (v) { return v + ' %'; } } } }
      }
    });
  }

  function destroy(id) { if (registry[id]) { registry[id].destroy(); delete registry[id]; } }

  global.ZacoCharts = {
    bankroll: bankroll, resultsDoughnut: resultsDoughnut, goalsBar: goalsBar,
    leagueCompare: leagueCompare, pnlByComp: pnlByComp, modelRadar: modelRadar,
    scoresBar: scoresBar, destroy: destroy, colors: C,
    available: function () { return !!global.Chart && canCanvas(); }
  };
})(window);
