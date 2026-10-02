/* ============================================================================
 * ZACO SPORT ODDS — Application principale
 * ----------------------------------------------------------------------------
 * Orchestration : chargement des données (snapshot + API temps réel),
 * calcul des pronostics, rendu de toutes les sections, filtres, navigation,
 * suivi de bankroll, historique et graphiques.
 * ========================================================================== */
(function (global) {
  'use strict';

  var U, API, M, B, CH;

  var STATE = {
    snapshot: null,
    comps: [],
    matches: [],
    tables: [],
    ctx: null,
    preds: {},
    picks: [],
    validation: [],
    filters: { comp: 'all', status: 'all', range: 'upcoming', q: '' },
    histFilter: 'all',
    standingsComp: 'bl1',
    standingsSeason: null,
    live: { demo: false, demoTimer: null, demoMatch: null },
    api: { mode: 'snapshot', sources: [], lastSync: null, errors: [] },
    refreshing: false
  };

  /* ============================ INITIALISATION ========================== */
  var booted = false;

  function init() {
    if (booted) return;           // protection contre une double initialisation
    booted = true;

    U = global.ZacoUI; API = global.ZacoAPI; M = global.ZacoModel;
    B = global.ZacoBank; CH = global.ZacoCharts;

    STATE.snapshot = global.ZACO_SNAPSHOT;
    if (!STATE.snapshot) {
      document.body.innerHTML = '<div class="wrap"><div class="empty"><div class="big">⚠️</div>' +
        '<p>Snapshot de données introuvable.</p></div></div>';
      return;
    }

    B.load();
    bindGlobalEvents();
    applyData(STATE.snapshot.matches, STATE.snapshot.tables, false);
    renderAll();
    updateSourceStrip();

    // Synchro temps réel en arrière-plan (silencieuse au premier passage)
    setTimeout(function () { refresh(false); }, 900);
    setInterval(function () { refresh(true); }, (API.settings().autoRefresh || 45) * 1000);
    setInterval(tickLive, 20000);
  }

  /* ====================== NORMALISATION DES DONNÉES ===================== */
  function normSnapshotMatch(m) {
    var badges = STATE.snapshot.badgeIndex || {};
    var comp = compById(m.comp);
    return {
      id: m.id, comp: m.comp, round: m.round, ts: m.ts, status: m.status,
      venue: m.venue, hg: m.hg, ag: m.ag, scorers: m.scorers || null, note: m.note || null,
      home: m.home, away: m.away, homeKey: m.homeId, awayKey: m.awayId,
      hb: badges[m.homeId] || null, ab: badges[m.awayId] || null,
      compLabel: comp ? comp.name : m.comp,
      compBadge: comp ? comp.badge : null,
      source: 'Snapshot',
      minutes: (m.status === 'FT' || m.status === 'AET') ? 90 : 0
    };
  }

  function compById(id) {
    return STATE.comps.filter(function (c) { return c.id === id; })[0] || null;
  }

  /** Rang d'affichage d'une compétition (ordre de déclaration du snapshot). */
  function compOrder(id) {
    var i = STATE.comps.map(function (c) { return c.id; }).indexOf(id);
    return i < 0 ? 99 : i;
  }

  function applyData(liveMatches, liveTables) {
    STATE.comps = (STATE.snapshot.competitions || []).slice();

    var base = STATE.snapshot.matches.map(normSnapshotMatch);

    // compétitions inconnues rencontrées dans les données temps réel
    (liveMatches || []).forEach(function (m) {
      if (!compById(m.comp)) {
        STATE.comps.push({
          id: m.comp, name: m.leagueName || m.comp, full: m.leagueName || m.comp,
          country: '—', flag: '⚽', type: 'Autre', season: '', live: false,
          badge: m.leagueBadge || null, accent: '#6c86a6', source: m.source
        });
      }
    });

    // fusion : les données temps réel priment sur le snapshot (même id)
    var byId = {};
    base.forEach(function (m) { byId[m.id] = m; });
    (liveMatches || []).forEach(function (m) {
      var c = compById(m.comp);
      m.compLabel = c ? c.name : (m.leagueName || m.comp);
      m.compBadge = (c && c.badge) || m.leagueBadge || null;
      byId[m.id] = m;
    });

    STATE.matches = Object.keys(byId).map(function (k) { return byId[k]; });

    // Le match de démonstration live est réinjecté : une synchronisation en
    // arrière-plan ne doit pas le faire disparaître de la section Direct.
    if (STATE.live.demoMatch) STATE.matches.unshift(STATE.live.demoMatch);

    // tables : une entrée par (compétition, saison), la plus fraîche gagne
    var key = {};
    (STATE.snapshot.tables || []).forEach(function (t) { key[t.comp + '|' + t.season] = Object.assign({}, t); });
    (liveTables || []).forEach(function (t) {
      // une table incomplète (top 5 de l'API gratuite) n'écrase pas une table complète
      var prev = key[t.comp + '|' + t.season];
      if (prev && prev.complete && !t.complete) return;
      key[t.comp + '|' + t.season] = t;
    });
    STATE.tables = Object.keys(key).map(function (k) { return key[k]; });

    // Classements remis dans l'ordre officiel (points, différence de buts,
    // buts marqués) : indispensable puisque les lignes viennent de sources
    // différentes (snapshot, OpenLigaDB, TheSportsDB).
    STATE.tables.forEach(function (t) {
      t.rows.sort(function (a, b) {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
      t.rows.forEach(function (r, i) { r.rank = i + 1; });
    });

    recompute();
  }

  function recompute() {
    STATE.ctx = M.buildContext({ competitions: STATE.comps, tables: STATE.tables });

    STATE.preds = {};
    STATE.matches.forEach(function (m) {
      try { STATE.preds[m.id] = M.predictMatch(m, STATE.ctx); }
      catch (e) { STATE.preds[m.id] = null; if (global.console) console.warn('[ZACO] prédiction impossible pour ' + m.id + ' : ' + e.message); }
    });

    var upcoming = STATE.matches.filter(function (m) { return m.status === 'NS'; })
      .sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
    STATE.picks = M.rankPicks(upcoming, STATE.ctx, 8);

    var finished = STATE.matches.filter(function (m) { return m.status === 'FT' || m.status === 'AET'; });
    STATE.validation = M.backtest(STATE.ctx, finished, STATE.snapshot);
  }

  /* ============================ TEMPS RÉEL ============================== */
  function refresh(silent) {
    if (STATE.refreshing) return;
    STATE.refreshing = true;
    setRefreshIcon(true);

    API.sync().then(function (payload) {
      STATE.api = payload.status;
      applyData(payload.matches, payload.tables);
      renderAll();
      updateSourceStrip();
      setRefreshIcon(false);
      STATE.refreshing = false;
      if (!silent) {
        var okSrc = payload.status.sources.filter(function (s) { return s.ok; }).length;
        toast('Synchronisation réussie',
          payload.matches.length + ' matchs récupérés · ' + okSrc + ' source(s) active(s)', 'ok');
      }
    }).catch(function (err) {
      setRefreshIcon(false);
      STATE.refreshing = false;
      updateSourceStrip();
      if (!silent) {
        toast('Synchronisation impossible',
          (err.message || '') + ' — les données du snapshot réel restent affichées.', 'err');
      }
    });
  }

  function setRefreshIcon(on) {
    var b = U.el('btnRefresh');
    if (b) b.className = 'btn-icon' + (on ? ' spin' : '');
  }

  /** Recalcule le statut « en direct » d'après l'heure de coup d'envoi. */
  function tickLive() {
    var changed = false, now = Date.now();
    STATE.matches.forEach(function (m) {
      if (m.status === 'FT' || m.status === 'AET' || m.status === 'PPD' || m.status === 'CANC' || m.isDemo) return;
      var t = Date.parse(m.ts);
      if (!t) return;
      if (now >= t && now < t + 150 * 60000 && m.status !== 'LIVE') { m.status = 'LIVE'; changed = true; }
      if (m.status === 'LIVE') { m.minutes = Math.min(95, Math.round((now - t) / 60000)); changed = true; }
    });
    if (changed) renderLive();
  }

  /* ------------------------- Démonstration « live » --------------------- */
  /**
   * Permet de visualiser les bulles temps réel en dehors des créneaux de match.
   * Le score simulé est explicitement signalé comme démonstration : il ne
   * provient d'aucune source réelle.
   */
  function toggleDemo() {
    if (STATE.live.demo) { stopDemo(); return; }
    var cand = STATE.matches.filter(function (m) { return m.status === 'NS'; })
      .sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); })[0];
    if (!cand) { toast('Démo indisponible', 'Aucun match à venir dans le jeu de données.', 'err'); return; }

    var copy = Object.assign({}, cand);
    copy.id = 'demo-' + cand.id;
    copy.status = 'LIVE';
    copy.minutes = 1;
    copy.hg = 0; copy.ag = 0;
    copy.scorers = [];
    copy.isDemo = true;
    copy.note = '⚠️ Simulation de démonstration — score généré localement, non réel.';
    STATE.live.demo = true;
    STATE.live.demoMatch = copy;
    STATE.matches.unshift(copy);

    STATE.live.demoTimer = setInterval(function () {
      var d = STATE.live.demoMatch;
      if (!d) return;
      d.minutes = Math.min(94, d.minutes + 1);
      if (Math.random() < 0.09 && d.minutes < 90) {
        var homeScores = Math.random() < 0.56;
        if (homeScores) d.hg++; else d.ag++;
        toast('⚽ BUT (démo) !', d.home + ' ' + d.hg + ' – ' + d.ag + ' ' + d.away, 'info');
      }
      if (d.minutes >= 94) d.status = 'FT';
      renderLive();
      if (d.status === 'FT') { stopDemo(); toast('Fin de la démonstration', 'Le match simulé est terminé.', 'info'); }
    }, 3500);

    syncDemoButton();
    toast('Démo live activée', 'Un match simulé apparaît dans la section Direct (données non réelles).', 'info');
    renderLive();
  }

  function stopDemo() {
    if (STATE.live.demoTimer) clearInterval(STATE.live.demoTimer);
    STATE.live.demoTimer = null;
    STATE.live.demo = false;
    STATE.live.demoMatch = null;
    STATE.matches = STATE.matches.filter(function (m) { return !m.isDemo; });
    syncDemoButton();
    renderLive();
  }

  function syncDemoButton() {
    U.qsa('#btnDemo').forEach(function (b) {
      if (STATE.live.demo) { b.textContent = '⏹ Arrêter la démo live'; b.className = 'btn btn--danger btn--sm'; }
      else { b.textContent = '▶ Démo live'; b.className = 'btn btn--ghost btn--sm'; }
    });
  }

  /* ============================== RENDU ================================= */
  function renderAll() {
    renderCompChips();
    renderHero();
    renderLive();
    renderPronostics();
    renderCalendar();
    renderCompetitions();
    renderStandings();
    renderBankroll();
    renderHistory();
    renderWorldCup();
    renderStats();
    renderSources();
  }

  function renderHero() {
    var s = B.stats();
    var acc = accuracy();
    U.el('heroStats').innerHTML =
      tile('Matchs référencés', STATE.matches.length, STATE.comps.length + ' compétitions', 'green') +
      tile('En direct', liveList().length, liveList().length ? 'mises à jour automatiques' : 'aucun match en cours', '') +
      tile('Pronostics du jour', STATE.picks.length, 'consensus de 4 modèles', 'gold') +
      tile('Réussite du modèle', acc.total ? Math.round(acc.displayRate * 100) + ' %' : '—',
        acc.total
          ? acc.displayWon + '/' + acc.display + ' validés' + (acc.usingFull ? ' (données complètes)' : ' sur ' + acc.total + ' matchs')
          : 'en attente de résultats', 'cyan') +
      tile('Cote juste moyenne', STATE.picks.length ? avgFair().toFixed(2) : '—',
        'sur ' + STATE.picks.length + ' analyses', 'violet') +
      tile('Bankroll', U.money(s.bankroll),
        (s.pnl >= 0 ? '+' : '') + U.money(s.pnl) + ' · ROI ' + (s.roi * 100).toFixed(1) + ' %',
        s.pnl >= 0 ? 'green' : 'neg');

    U.el('statTotal').textContent = STATE.matches.length;
    U.el('statComps').textContent = STATE.comps.length;
    U.el('statLive').textContent = liveList().length;
    U.el('statAcc').textContent = acc.total ? Math.round(acc.displayRate * 100) + ' %' : '—';
  }

  function tile(k, v, d, cls) {
    return '<div class="stat-tile"><div class="stat-tile__k">' + U.esc(k) + '</div>' +
      '<div class="stat-tile__v ' + (cls || '') + '">' + v + '</div>' +
      '<div class="stat-tile__d">' + U.esc(d) + '</div></div>';
  }

  function liveList() {
    return STATE.matches.filter(function (m) { return m.status === 'LIVE'; });
  }

  /**
   * Taux de réussite du modèle sur les matchs réellement terminés.
   * L'indicateur « données complètes » isole les matchs dont les deux équipes
   * ont un historique : c'est le plus représentatif. L'échantillon global
   * contient aussi des matchs où seule une équipe (ou aucune) est connue.
   */
  function accuracy() {
    var v = STATE.validation;
    if (!v.length) {
      return { total: 0, won: 0, rate: 0, fullTotal: 0, fullWon: 0, fullRate: 0,
               display: 0, displayWon: 0, displayRate: 0, usingFull: false };
    }
    var won = v.filter(function (x) { return x.won; }).length;
    var full = v.filter(function (x) { return !x.pred.partialData; });
    var fullWon = full.filter(function (x) { return x.won; }).length;
    var usingFull = full.length >= 3;
    return {
      total: v.length, won: won, rate: won / v.length,
      fullTotal: full.length, fullWon: fullWon, fullRate: full.length ? fullWon / full.length : 0,
      display: usingFull ? full.length : v.length,
      displayWon: usingFull ? fullWon : won,
      displayRate: usingFull ? (fullWon / full.length) : (won / v.length),
      usingFull: usingFull
    };
  }

  function avgFair() {
    if (!STATE.picks.length) return 0;
    return STATE.picks.reduce(function (a, p) { return a + p.pickOdds; }, 0) / STATE.picks.length;
  }

  /* ------------------------------ DIRECT -------------------------------- */
  function renderLive() {
    var live = liveList();
    var soon = STATE.matches.filter(function (m) { return m.status === 'NS'; })
      .sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
    var list = live.concat(soon).slice(0, 12);

    U.el('liveBubbles').innerHTML = list.length
      ? list.map(function (m) { return U.liveBubble(m, STATE.preds[m.id]); }).join('')
      : '<div class="empty" style="grid-column:1/-1"><div class="big">⏱️</div>' +
        '<p>Aucun match en cours. Les prochains coups d\'envoi sont affichés ci-dessous.</p></div>';

    var gridList = live.length ? live : soon.slice(0, 6);
    U.el('liveGrid').innerHTML = gridList.length
      ? gridList.map(function (m) { return U.matchCard(m, STATE.preds[m.id]); }).join('')
      : '<div class="empty"><div class="big">📭</div><p>Pas de match en direct pour le moment.</p></div>';

    U.el('liveCount').textContent = live.length;
  }

  /* ---------------------------- PRONOSTICS ------------------------------ */
  function renderPronostics() {
    var picks = STATE.picks;
    U.el('proGrid').innerHTML = picks.length
      ? picks.map(function (p, i) {
          var m = STATE.matches.filter(function (x) { return x.id === p.matchId; })[0];
          return U.proCard(p, i + 1, m);
        }).join('')
      : '<div class="empty"><div class="big">🔮</div>' +
        '<p>Aucun pronostic disponible : les données de force des équipes sont insuffisantes.</p></div>';
  }

  /* ------------------------ Puces de compétitions ----------------------- */
  function renderCompChips() {
    var host = U.el('compChips');
    if (!host) return;
    var html = '<span class="chip' + (STATE.filters.comp === 'all' ? ' is-active' : '') +
      '" data-filter-comp="all">Toutes les compétitions</span>';
    STATE.comps.forEach(function (c) {
      var n = STATE.matches.filter(function (m) { return m.comp === c.id; }).length;
      if (!n) return;
      html += '<span class="chip' + (STATE.filters.comp === c.id ? ' is-active' : '') +
        '" data-filter-comp="' + U.esc(c.id) + '">' + (c.flag || '⚽') + ' ' + U.esc(c.name) +
        ' <b style="opacity:.55">' + n + '</b></span>';
    });
    host.innerHTML = html;
    U.qsa('[data-filter-comp]', host).forEach(function (chip) {
      chip.addEventListener('click', function () {
        STATE.filters.comp = chip.getAttribute('data-filter-comp');
        U.qsa('[data-filter-comp]', host).forEach(function (x) { x.classList.remove('is-active'); });
        chip.classList.add('is-active');
        renderCalendar();
      });
    });
  }

  /* ---------------------------- CALENDRIER ------------------------------ */
  function filteredMatches() {
    var f = STATE.filters;
    var today0 = new Date(); today0.setHours(0, 0, 0, 0);
    var from = today0.getTime();

    return STATE.matches.filter(function (m) {
      if (f.comp !== 'all' && m.comp !== f.comp) return false;
      if (f.status !== 'all' && m.status !== f.status) return false;

      var t = Date.parse(m.ts);
      if (f.range === 'today') {
        if (U.dayKey(m.ts) !== U.dayKey(new Date().toISOString())) return false;
      } else if (f.range === 'upcoming') {
        if (m.status === 'FT' || m.status === 'AET') return false;
        if (t && t < from - 86400000) return false;
      } else if (f.range === 'week') {
        if (!t || t < from || t > from + 7 * 86400000) return false;
      } else if (f.range === 'month') {
        if (!t || t < from || t > from + 31 * 86400000) return false;
      } else if (f.range === 'past') {
        if (m.status !== 'FT' && m.status !== 'AET') return false;
      }

      if (f.q) {
        var hay = (m.home + ' ' + m.away + ' ' + m.compLabel + ' ' + (m.venue || '') + ' ' + (m.round || '')).toLowerCase();
        if (hay.indexOf(f.q.toLowerCase()) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return (Date.parse(a.ts) || 0) - (Date.parse(b.ts) || 0); });
  }

  function renderCalendar() {
    var list = filteredMatches();
    var groups = {};
    list.forEach(function (m) { (groups[U.dayKey(m.ts)] = groups[U.dayKey(m.ts)] || []).push(m); });
    var keys = Object.keys(groups).sort();

    U.el('calendarCount').textContent = list.length + ' match' + (list.length > 1 ? 's' : '');
    U.el('calendarBody').innerHTML = keys.length
      ? keys.map(function (k) {
          var arr = groups[k];
          return '<div class="section" style="margin-bottom:26px">' +
            '<div class="section__head" style="margin-bottom:12px">' +
              '<div class="section__title" style="font-size:17px">📅 ' + U.esc(U.dayLabel(arr[0].ts)) + '</div>' +
              '<div class="section__sub" style="margin-left:12px">' + arr.length + ' match' + (arr.length > 1 ? 's' : '') + '</div>' +
            '</div>' +
            '<div class="match-grid">' +
              arr.map(function (m) { return U.matchCard(m, STATE.preds[m.id]); }).join('') +
            '</div></div>';
        }).join('')
      : '<div class="empty"><div class="big">🔍</div><p>Aucun match ne correspond à ces filtres.</p></div>';
  }

  /* --------------------------- COMPÉTITIONS ----------------------------- */
  function compStats(compId) {
    var ms = STATE.matches.filter(function (m) { return m.comp === compId; });
    var t = STATE.tables.filter(function (x) { return x.comp === compId; })
      .sort(function (a, b) {
        return (b.live ? 1 : 0) - (a.live ? 1 : 0) || String(b.season).localeCompare(String(a.season));
      })[0];
    return {
      total: ms.length,
      upcoming: ms.filter(function (m) { return m.status === 'NS'; }).length,
      live: ms.filter(function (m) { return m.status === 'LIVE'; }).length,
      goals: ms.reduce(function (a, m) { return a + (m.hg || 0) + (m.ag || 0); }, 0),
      tables: !!t, completeTable: t ? t.complete : false, table: t
    };
  }

  function renderCompetitions() {
    U.el('compGrid').innerHTML = STATE.comps.map(function (c) {
      return U.compCard(c, compStats(c.id));
    }).join('');

    // Le sélecteur liste TOUS les classements disponibles (toutes compétitions
    // et toutes saisons) : l'utilisateur peut consulter les tableaux complets
    // aussi bien que les classements en cours.
    var seasons = STATE.tables.slice().sort(function (a, b) {
      if (a.comp !== b.comp) {
        var ca = compOrder(a.comp), cb = compOrder(b.comp);
        return ca !== cb ? ca - cb : String(a.comp).localeCompare(String(b.comp));
      }
      // saison en cours d'abord, puis la plus récente
      return (b.live ? 1 : 0) - (a.live ? 1 : 0) || String(b.season).localeCompare(String(a.season));
    });
    if (seasons.length && !seasons.some(function (t) {
      return t.comp === STATE.standingsComp && t.season === STATE.standingsSeason;
    })) {
      STATE.standingsComp = seasons[0].comp;
      STATE.standingsSeason = seasons[0].season;
    }
    U.el('standingsSelect').innerHTML = seasons.map(function (t) {
      var c = compById(t.comp);
      var nom = (c ? c.name : t.comp) + ' · ' + t.season;
      var tag = t.complete ? (t.historical ? ' · classement final' : ' · complet') : ' · partiel';
      return '<option value="' + U.esc(t.comp + '|' + t.season) + '"' +
        (t.comp === STATE.standingsComp && t.season === STATE.standingsSeason ? ' selected' : '') + '>' +
        U.esc(nom + (t.live ? ' (en cours' + tag + ')' : tag)) + '</option>';
    }).join('');
  }

  function renderStandings() {
    var t = STATE.tables.filter(function (x) {
      return x.comp === STATE.standingsComp && (!STATE.standingsSeason || x.season === STATE.standingsSeason);
    })[0] || STATE.tables.filter(function (x) { return x.comp === STATE.standingsComp; })[0];

    if (!t) {
      U.el('standingsBody').innerHTML = '<div class="empty"><div class="big">📋</div>' +
        '<p>Classement non disponible pour cette compétition.</p></div>';
      return;
    }
    STATE.standingsSeason = t.season;
    var showForm = t.rows.some(function (r) { return r.form; });

    U.el('standingsTitle').textContent = t.label || (t.comp + ' · ' + t.season);
    U.el('standingsBody').innerHTML =
      '<div class="source-strip" style="margin:0 0 14px">' +
        '<b>Classement</b> ' + U.esc(String(t.comp).toUpperCase()) + ' · saison ' + U.esc(t.season) +
        '<span class="src-chip' + (t.live ? '' : ' synced') + '">' + (t.live ? '🔄 temps réel' : '📦 snapshot') + '</span>' +
        '<span class="src-chip synced">' + (t.complete ? 'classement complet' : 'top ' + t.rows.length + ' (limite de l\'API gratuite)') + '</span>' +
        (t.updated ? '<span style="margin-left:auto">Mis à jour le ' + U.esc(String(t.updated).slice(0, 10)) + '</span>' : '') +
      '</div>' + U.standingsTable(t.rows, { showForm: showForm });
  }

  /* ------------------------------ BANKROLL ------------------------------ */
  function renderBankroll() {
    var s = B.stats();
    U.el('bankKpis').innerHTML =
      kpi('Bankroll actuelle', U.money(s.bankroll), 'capital de départ ' + U.money(s.initial), '') +
      kpi('Profit / perte', (s.pnl >= 0 ? '+' : '') + U.money(s.pnl), 'sur ' + U.money(s.staked) + ' misés', s.pnl >= 0 ? 'pos' : 'neg') +
      kpi('ROI / Yield', (s.roi * 100).toFixed(1) + ' %', 'retour sur mise engagée', s.roi >= 0 ? 'pos' : 'neg') +
      kpi('Taux de réussite', (s.winRate * 100).toFixed(1) + ' %', s.won + ' gagnés · ' + s.lost + ' perdus', '') +
      kpi('Cote moyenne', s.avgOdds ? s.avgOdds.toFixed(2) : '—', s.push + ' remboursé(s)', '') +
      kpi('Paris en cours', s.pending + ' · ' + U.money(s.pendingStake), 'disponible ' + U.money(s.available), '') +
      kpi('Série en cours', s.streak ? s.streak + ' ' + (s.streakType === 'won' ? 'gagnés' : 'perdus') : '—',
        'drawdown max ' + (s.maxDrawdown * 100).toFixed(1) + ' %',
        s.streakType === 'won' ? 'pos' : s.streakType === 'lost' ? 'neg' : '') +
      kpi('Mise conseillée', U.money(s.unit), s.unitPct + ' % de la bankroll', '');

    if (CH.available()) {
      CH.bankroll(U.el('chartBankroll'), s.curve, s.currency);
      CH.resultsDoughnut(U.el('chartResults'), s);

      var entries = Object.keys(s.byComp).map(function (k) {
        var c = compById(k);
        return { label: c ? c.name : k, pnl: s.byComp[k].pnl };
      }).filter(function (e) { return Math.abs(e.pnl) > 0.001; });

      if (entries.length) CH.pnlByComp(U.el('chartPnlComp'), entries, s.currency);
      else CH.destroy('chartPnlComp');
    }

    var initial = U.el('initialAmount');
    if (initial && document.activeElement !== initial) initial.value = s.initial;
    var unitRange = U.el('unitRange');
    if (unitRange && document.activeElement !== unitRange) {
      unitRange.value = s.unitPct;
      U.el('unitValue').textContent = s.unitPct + ' %';
    }

    renderPendingBets();
    fillBetForm();
  }

  function kpi(k, v, d, cls) {
    return '<div class="kpi"><div class="kpi__k">' + U.esc(k) + '</div>' +
      '<div class="kpi__v ' + (cls || '') + '">' + v + '</div>' +
      '<div class="kpi__d">' + U.esc(d) + '</div></div>';
  }

  function renderPendingBets() {
    var pending = B.load().bets.filter(function (b) { return b.status === 'pending'; });
    var host = U.el('pendingBets');
    if (!host) return;
    host.innerHTML = pending.length ? pending.map(function (b) {
      return '<div class="hist-card pending" style="margin-bottom:10px">' +
        '<div class="hist-card__head"><div><div class="hist-card__match">' + U.esc(b.match) + '</div>' +
        '<div class="hist-card__meta">' + U.esc(b.comp) + ' · ' + U.esc(b.date) + '</div></div>' +
        '<span class="hist-tag pending">EN COURS</span></div>' +
        '<div class="hist-card__rows">' +
          '<div class="hist-row"><span>Pronostic</span><b>' + U.esc(U.pickText(b.pick)) + '</b></div>' +
          '<div class="hist-row"><span>Cote · mise</span><b>' + Number(b.odds).toFixed(2) + ' · ' + U.money(b.stake) + '</b></div>' +
          '<div class="hist-row"><span>Gain potentiel</span><b class="pos">+' + U.money(b.stake * b.odds - b.stake) + '</b></div>' +
        '</div>' +
        '<div class="mc__actions">' +
          '<button class="btn btn--primary btn--sm" data-settle="' + U.esc(b.id) + '" data-status="won">Gagné</button>' +
          '<button class="btn btn--danger btn--sm" data-settle="' + U.esc(b.id) + '" data-status="lost">Perdu</button>' +
          '<button class="btn btn--ghost btn--sm" data-settle="' + U.esc(b.id) + '" data-status="push">Remboursé</button>' +
        '</div></div>';
    }).join('') : '<div class="hint">Aucun pari en cours. Ajoutez un pronostic depuis la section <b>Pronostics</b> ' +
      'ou via le formulaire ci-contre.</div>';
  }

  function fillBetForm() {
    var sel = U.el('betMatch');
    if (!sel) return;
    var cur = sel.value;
    var list = STATE.matches.filter(function (m) { return m.status === 'NS'; })
      .sort(function (a, b) { return new Date(a.ts) - new Date(b.ts); });
    sel.innerHTML = '<option value="">— Choisir un match à venir —</option>' +
      list.map(function (m) {
        return '<option value="' + U.esc(m.id) + '">' + U.esc(m.home + ' – ' + m.away + ' (' + U.fmtDayShort(m.ts) + ')') + '</option>';
      }).join('') +
      '<option value="__custom">✏️ Autre match (saisie libre)</option>';
    if (cur) sel.value = cur;
    updateBetPreview();
  }

  function updateBetPreview() {
    var matchId = U.el('betMatch').value;
    var pick = U.el('betPick').value;
    var odds = Number(U.el('betOdds').value);
    var stake = Number(U.el('betStake').value);
    var pred = STATE.preds[matchId];
    var host = U.el('betAnalysis');

    U.el('betMatchLabel').style.display = (matchId === '__custom') ? '' : 'none';

    if (pred) {
      var v = M.value(pred, pick, odds || pred.fairOdds[pick]);
      host.innerHTML =
        '<div class="probs" style="margin-bottom:10px">' +
          ['1', 'X', '2'].map(function (k) {
            return '<div class="prob ' + (k === pick ? 'best' : '') + '">' +
              '<div class="prob__k">' + (k === '1' ? 'Domicile' : k === 'X' ? 'Nul' : 'Extérieur') + '</div>' +
              '<div class="prob__v">' + Math.round(pred.probs[k] * 100) + '%</div>' +
              '<div class="prob__o">juste ' + pred.fairOdds[k].toFixed(2) + '</div></div>';
          }).join('') + '</div>' +
        '<div class="hint">Modèle : <b>' + U.esc(U.pickText(pick, STATE.matches.filter(function (x) { return x.id === matchId; })[0])) +
          '</b> à ' + Math.round(pred.probs[pick] * 100) + ' % · confiance ' + Math.round(pred.confidence * 100) +
          ' % · cote juste <b>' + pred.fairOdds[pick].toFixed(2) + '</b>.' +
          (v ? (v.isValue
            ? ' <b style="color:var(--emerald)">Value détectée : +' + (v.edge * 100).toFixed(1) + ' % d\'espérance</b> (Kelly ' + (v.kelly * 100).toFixed(1) + ' %).'
            : ' Aucune value à cette cote (espérance ' + (v.edge * 100).toFixed(1) + ' %).') : '') +
        '</div>';
      U.el('betStakeHint').textContent = 'Mise conseillée (demi-Kelly) : ' +
        U.money(B.suggestedStake(pred.probs[pick], odds || pred.fairOdds[pick]));
    } else {
      host.innerHTML = '<div class="hint">Sélectionnez un match pour afficher l\'analyse du modèle et ' +
        'détecter une éventuelle <b>value</b> par rapport à la cote jouée.</div>';
      U.el('betStakeHint').textContent = 'Mise conseillée : ' + U.money(B.stats().unit);
    }

    U.el('betReturn').textContent = (odds > 0 && stake > 0)
      ? U.money(stake * odds) + ' (dont ' + U.money(stake * odds - stake) + ' de gain net)'
      : '—';
  }

  /* ----------------------------- HISTORIQUE ----------------------------- */
  function buildHistory() {
    var items = [];

    // 1) Paris de l'utilisateur
    B.load().bets.forEach(function (b) {
      var m = STATE.matches.filter(function (x) { return x.id === b.matchId; })[0];
      items.push({
        kind: 'bet', status: b.status, betId: b.id,
        matchLabel: b.match, compLabel: b.comp, dateLabel: b.date,
        pickLabel: U.pickText(b.pick, m),
        scoreLabel: (m && m.hg != null) ? m.hg + ' – ' + m.ag : null,
        odds: b.odds, stake: b.stake, pnl: b.pnl, confidence: b.confidence,
        note: b.note, ts: b.settledAt || b.date
      });
    });

    // 2) Validation du modèle sur les matchs réellement terminés
    STATE.validation.forEach(function (v) {
      items.push({
        kind: 'model', status: v.won ? 'won' : 'lost',
        matchLabel: v.match.home + ' – ' + v.match.away,
        compLabel: (compById(v.match.comp) || {}).name || v.match.comp,
        dateLabel: String(v.match.ts).slice(0, 10),
        pickLabel: U.pickText(v.pred.pick, v.match),
        scoreLabel: v.match.hg + ' – ' + v.match.ag,
        odds: v.pred.pickOdds, stake: v.stake, pnl: v.pnl,
        confidence: v.pred.confidence,
        note: 'Validation du modèle : forces calculées sur la saison précédente, sans biais de connaissance anticipée.',
        ts: v.match.ts
      });
    });

    items.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    return items;
  }

  function renderHistory() {
    var items = buildHistory();
    var f = STATE.histFilter;
    var shown = items.filter(function (i) { return f === 'all' || i.status === f; });

    var won = items.filter(function (i) { return i.status === 'won'; }).length;
    var lost = items.filter(function (i) { return i.status === 'lost'; }).length;
    var pend = items.filter(function (i) { return i.status === 'pending'; }).length;
    var pnl = items.reduce(function (a, i) { return a + (i.pnl || 0); }, 0);

    U.el('histSummary').innerHTML =
      kpi('Pronostics gagnés', won, 'sur ' + (won + lost) + ' réglés', 'pos') +
      kpi('Pronostics perdus', lost, (won + lost) ? Math.round(won / (won + lost) * 100) + ' % de réussite' : '—', 'neg') +
      kpi('En attente', pend, 'paris non réglés', '') +
      kpi('Résultat cumulé', (pnl >= 0 ? '+' : '') + U.money(pnl), 'suivi + validation du modèle', pnl >= 0 ? 'pos' : 'neg');

    U.el('histGrid').innerHTML = shown.length
      ? shown.map(U.histCard).join('')
      : '<div class="empty"><div class="big">📜</div><p>Aucun pronostic dans cette catégorie.</p></div>';
  }

  /* --------------------------- COUPE DU MONDE --------------------------- */
  function renderWorldCup() {
    var wc = STATE.snapshot.worldCup;
    if (!wc) return;
    var badges = STATE.snapshot.badgeIndex || {};
    var finalMatch = STATE.matches.filter(function (m) { return m.comp === 'wc'; })[0];

    U.el('wcBody').innerHTML =
      '<div class="bank-grid">' +
        '<div class="card"><div class="card__head">' +
          '<div class="card__title">🏆 ' + U.esc(wc.edition) + ' — la finale</div>' +
          '<span class="src-chip" style="margin-left:auto">' + U.esc(wc.finalDate) + '</span></div>' +
          '<div class="card__body">' +
            '<div class="modal__score" style="margin:6px 0 18px">' +
              '<div class="side">' + U.crest(badges[wc.qualified[0].key], 'Espagne') +
                '<div class="nm">Espagne</div><div class="stat-tile__d">Vainqueur</div></div>' +
              '<div class="num">1 – 0</div>' +
              '<div class="side">' + U.crest(badges[wc.qualified[1].key], 'Argentine') +
                '<div class="nm">Argentine</div><div class="stat-tile__d">Finaliste</div></div>' +
            '</div>' +
            '<div class="modal__kv">' +
              '<div class="cell"><i>Score</i><b>' + U.esc(wc.final) + '</b></div>' +
              '<div class="cell"><i>Buteur</i><b>' + U.esc(wc.scorer) + '</b></div>' +
              '<div class="cell"><i>Stade</i><b>' + U.esc(wc.stadium) + '</b></div>' +
              '<div class="cell"><i>Affluence</i><b>' + U.esc(wc.attendance) + '</b></div>' +
            '</div>' +
            '<div class="modal__note">' + U.esc(wc.note) + '</div>' +
            (finalMatch ? '<div class="mc__actions"><button class="btn btn--ghost btn--sm" data-detail="' +
              U.esc(finalMatch.id) + '">Voir la fiche du match</button></div>' : '') +
          '</div></div>' +
        '<div class="card"><div class="card__head">' +
          '<div class="card__title">Sélections du tournoi (' + U.esc(wc.hosts) + ')</div></div>' +
          '<div class="card__body"><div class="scorers__l">' +
            wc.qualified.map(function (q) {
              return '<span class="goal" style="font-size:12.5px;padding:6px 11px">' + q.flag + ' ' + U.esc(q.country) +
                (q.country === wc.winner ? ' 🥇' : q.country === wc.runnerUp ? ' 🥈' : '') + '</span>';
            }).join('') +
          '</div>' +
          '<div class="hint" style="margin-top:14px">La Coupe du Monde 2026 s\'est déroulée du 11 juin au 19 juillet 2026 ' +
          'au Canada, au Mexique et aux États-Unis. L\'API TheSportsDB expose l\'intégralité de la compétition ; ' +
          'la clé gratuite limite toutefois le nombre de matchs renvoyés par requête, ce qui explique l\'affichage ' +
          'de la finale (résultat officiel, prolongation incluse) plutôt que des 104 matchs du tournoi.</div>' +
          '</div></div>' +
      '</div>';
  }

  /* --------------------------- STATISTIQUES ----------------------------- */
  function renderStats() {
    if (CH.available()) {
      // Buts marqués / encaissés — Bundesliga 2025/2026 (classement complet réel)
      var hist = STATE.tables.filter(function (t) {
        return t.comp === 'bl1' && t.historical && t.rows.length > 10;
      })[0];
      if (hist) {
        CH.goalsBar(U.el('chartGoals'),
          hist.rows.map(function (r) {
            return r.n.replace('FC Bayern München', 'Bayern')
                      .replace(/^(1\. |SV |SC |VfB |VfL |TSG |FC )/, '').slice(0, 14);
          }),
          hist.rows.map(function (r) { return r.gf; }),
          hist.rows.map(function (r) { return r.ga; }));
      }

      // Comparaison des championnats
      var labels = [], avgFor = [], avgAgainst = [];
      STATE.tables.filter(function (t) { return !t.historical && t.rows.length >= 5; }).forEach(function (t) {
        var gf = 0, ga = 0, pl = 0;
        t.rows.forEach(function (r) { gf += r.gf; ga += r.ga; pl += r.pl; });
        if (!pl) return;
        labels.push((compById(t.comp) || {}).name || t.comp);
        avgFor.push(+(gf / pl).toFixed(2));
        avgAgainst.push(+(ga / pl).toFixed(2));
      });
      if (labels.length) CH.leagueCompare(U.el('chartLeagues'), labels, avgFor, avgAgainst);

      var acc = accuracy();
      CH.resultsDoughnut(U.el('chartAccuracy'),
        { won: acc.won, lost: acc.total - acc.won, push: 0, pending: 0 });
    }

    U.el('validationBody').innerHTML = STATE.validation.length
      ? '<div class="table-wrap"><table class="standings"><thead><tr>' +
        '<th>Match</th><th>Compétition</th><th>Pronostic</th><th>Score réel</th><th>Résultat</th><th>Cote</th><th>Conf.</th>' +
        '</tr></thead><tbody>' +
        STATE.validation.map(function (v) {
          return '<tr><td>' + U.esc(v.match.home + ' – ' + v.match.away) + '</td>' +
            '<td>' + U.esc((compById(v.match.comp) || {}).name || v.match.comp) + '</td>' +
            '<td><span class="mini-tip ' + U.pickClass(v.pred.pick) + '">' + U.esc(U.pickShort(v.pred.pick)) + '</span></td>' +
            '<td><b>' + v.match.hg + ' – ' + v.match.ag + '</b></td>' +
            '<td><span class="hist-tag ' + (v.won ? 'won' : 'lost') + '">' + (v.won ? '✓ gagné' : '✗ perdu') + '</span></td>' +
            '<td>' + v.pred.pickOdds.toFixed(2) + '</td>' +
            '<td>' + Math.round(v.pred.confidence * 100) + ' %</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="hint" style="margin-top:12px">Échantillon de ' + STATE.validation.length +
        ' matchs terminés. Les forces sont volontairement recalculées sur la <b>saison précédente</b> : ' +
        'aucun résultat utilisé pour prédire n\'est connu à l\'avance (pas de biais de connaissance anticipée). ' +
        'La taille de l\'échantillon dépend des matchs terminés présents dans les données.</div>'
      : '<div class="empty"><div class="big">🧪</div>' +
        '<p>Aucun match terminé avec données suffisantes pour valider le modèle.</p></div>';

    var withScore = STATE.matches.filter(function (m) { return m.hg != null; });
    var goals = withScore.reduce(function (a, m) { return a + m.hg + m.ag; }, 0);
    var homeWins = withScore.filter(function (m) { return m.hg > m.ag; }).length;
    var draws = withScore.filter(function (m) { return m.hg === m.ag; }).length;

    U.el('dataStats').innerHTML =
      kpi('Matchs avec score', withScore.length, 'sur ' + STATE.matches.length + ' référencés', '') +
      kpi('Buts cumulés', goals, withScore.length ? (goals / withScore.length).toFixed(2) + ' buts / match' : '—', '') +
      kpi('Victoires domicile', withScore.length ? Math.round(homeWins / withScore.length * 100) + ' %' : '—', homeWins + ' matchs', 'pos') +
      kpi('Matchs nuls', withScore.length ? Math.round(draws / withScore.length * 100) + ' %' : '—', draws + ' matchs', '') +
      kpi('Classements chargés', STATE.tables.length, 'dont ' + STATE.tables.filter(function (t) { return t.live; }).length + ' temps réel', '') +
      kpi('Modèles agrégés', 4, 'Elo · Dixon-Coles · Forme · Marché', '');
  }

  /* ------------------------------ SOURCES ------------------------------- */
  function updateSourceStrip() {
    var mode = STATE.api.mode;
    var label = mode === 'live' ? 'Données temps réel' : mode === 'partial' ? 'Temps réel partiel' : 'Snapshot embarqué';
    var chip = U.el('modeChip');
    if (chip) {
      chip.textContent = (mode === 'live' ? '🟢 ' : mode === 'partial' ? '🟡 ' : '📦 ') + label;
      chip.className = 'src-chip' + (mode === 'live' ? '' : ' synced');
    }
    var ls = U.el('lastSync');
    if (ls) {
      ls.textContent = STATE.api.lastSync
        ? 'Dernière synchronisation : ' + new Date(STATE.api.lastSync).toLocaleTimeString('fr-FR')
        : 'Aucune synchro réseau — snapshot réel du ' + STATE.snapshot.meta.snapshotDate;
    }
  }

  function renderSources() {
    var meta = STATE.snapshot.meta;
    U.el('sourcesBody').innerHTML =
      '<div class="match-grid" style="margin-bottom:18px">' +
        meta.sources.map(function (s) {
          return '<div class="card"><div class="card__body">' +
            '<div class="card__title">🔗 ' + U.esc(s.name) + '</div>' +
            '<div class="hint" style="margin:8px 0 12px">' + U.esc(s.what) + '</div>' +
            '<a class="btn btn--ghost btn--sm" href="' + U.esc(s.url) + '" target="_blank" rel="noopener">Ouvrir la source</a>' +
            '</div></div>';
        }).join('') +
      '</div>' +

      '<div class="card" style="margin-bottom:16px"><div class="card__head">' +
        '<div class="card__title">État de la connexion aux API</div>' +
        '<button class="btn btn--ghost btn--sm" id="btnDiag" style="margin-left:auto">Tester maintenant</button></div>' +
        '<div class="card__body" id="diagBody"><div class="hint">Cliquez sur « Tester maintenant » pour vérifier ' +
        'la disponibilité des API depuis ce navigateur.</div></div></div>' +

      '<div class="card"><div class="card__head"><div class="card__title">Réglages des sources</div></div>' +
        '<div class="card__body"><div class="form-grid">' +
          '<div class="field"><label for="setKey">Clé API TheSportsDB</label>' +
            '<input id="setKey" value="' + U.esc(API.settings().tsdbKey) + '" placeholder="3">' +
            '<div class="hint">La clé publique de test « 3 » est utilisée par défaut. Une clé personnelle gratuite ' +
            '(thesportsdb.com) lève la limite de 5 enregistrements par requête.</div></div>' +
          '<div class="field"><label for="setRefresh">Rafraîchissement automatique (secondes)</label>' +
            '<input id="setRefresh" type="number" min="15" max="600" value="' + API.settings().autoRefresh + '">' +
            '<div class="hint">Fréquence de synchronisation des scores en direct.</div></div>' +
          '<div class="field full"><label>Options</label>' +
            '<label class="hint" style="display:flex;gap:8px;align-items:center">' +
              '<input type="checkbox" id="setProxy" ' + (API.settings().proxy ? 'checked' : '') + '> ' +
              'Autoriser le repli via le proxy local <code>/api/proxy</code></label>' +
            '<label class="hint" style="display:flex;gap:8px;align-items:center;margin-top:6px">' +
              '<input type="checkbox" id="setLive" ' + (API.settings().live ? 'checked' : '') + '> ' +
              'Suivi automatique des matchs en direct</label>' +
          '</div>' +
          '<div class="field full"><button class="btn btn--primary" id="btnSaveSettings">Enregistrer les réglages</button></div>' +
        '</div></div></div>';
  }

  /* ============================== ÉVÉNEMENTS ============================ */
  function bindGlobalEvents() {
    // Navigation par ancres
    U.qsa('[data-nav]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(a.getAttribute('data-nav'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        U.qsa('[data-nav]').forEach(function (x) { x.classList.remove('is-active'); });
        a.classList.add('is-active');
      });
    });

    /* Délégation globale : boutons et cartes générés dynamiquement. */
    document.addEventListener('click', function (e) {
      var t = e.target;

      if (t.id === 'btnRefresh') { refresh(false); return; }
      if (t.id === 'btnDemo') { toggleDemo(); return; }

      if (t.id === 'btnDiag') { runDiagnose(t); return; }
      if (t.id === 'btnSaveSettings') { saveSettings(); return; }
      if (t.id === 'btnDemoHistory') { loadDemoHistory(); return; }
      if (t.id === 'btnResetBank') { resetBankroll(); return; }

      var bet = t.closest('[data-bet]');
      if (bet) { openBetModal(bet.getAttribute('data-bet')); return; }

      var det = t.closest('[data-detail]');
      if (det) { openDetailModal(det.getAttribute('data-detail')); return; }

      var st = t.closest('[data-settle]');
      if (st) {
        B.settle(st.getAttribute('data-settle'), st.getAttribute('data-status'));
        renderBankroll(); renderHistory(); renderHero();
        toast('Pari réglé', 'Les statistiques de bankroll ont été mises à jour.', 'ok');
        return;
      }

      var ds = t.closest('[data-demo-settle]');
      if (ds) { cycleBetStatus(ds.getAttribute('data-demo-settle')); return; }

      var del = t.closest('[data-bet-del]');
      if (del) {
        B.removeBet(del.getAttribute('data-bet-del'));
        renderBankroll(); renderHistory(); renderHero();
        return;
      }

      var hl = t.closest('[data-hist]');
      if (hl) {
        STATE.histFilter = hl.getAttribute('data-hist');
        U.qsa('[data-hist]').forEach(function (x) { x.classList.remove('is-active'); });
        hl.classList.add('is-active');
        renderHistory();
        return;
      }

      var cc = t.closest('[data-comp]');
      if (cc) {
        STATE.standingsComp = cc.getAttribute('data-comp');
        STATE.standingsSeason = null;
        renderCompetitions(); renderStandings();
        var section = document.getElementById('competitions');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      var bub = t.closest('.bubble[data-match]');
      if (bub) { openDetailModal(bub.getAttribute('data-match')); return; }
    });

    // Filtres de statut et de période (statiques dans le HTML)
    U.qsa('[data-filter-status]').forEach(function (c) {
      c.addEventListener('click', function () {
        STATE.filters.status = c.getAttribute('data-filter-status');
        U.qsa('[data-filter-status]').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        renderCalendar();
      });
    });
    U.qsa('[data-filter-range]').forEach(function (c) {
      c.addEventListener('click', function () {
        STATE.filters.range = c.getAttribute('data-filter-range');
        U.qsa('[data-filter-range]').forEach(function (x) { x.classList.remove('is-active'); });
        c.classList.add('is-active');
        renderCalendar();
      });
    });

    var search = U.el('searchInput');
    if (search) search.addEventListener('input', function () {
      STATE.filters.q = search.value.trim();
      renderCalendar();
    });

    var ss = U.el('standingsSelect');
    if (ss) ss.addEventListener('change', function () {
      var parts = ss.value.split('|');
      STATE.standingsComp = parts[0];
      STATE.standingsSeason = parts[1];
      renderStandings();
    });

    // Formulaire de pari
    ['betMatch', 'betPick', 'betOdds', 'betStake'].forEach(function (id) {
      var x = U.el(id);
      if (!x) return;
      x.addEventListener('input', updateBetPreview);
      x.addEventListener('change', updateBetPreview);
    });

    var initForm = U.el('initialForm');
    if (initForm) initForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = Number(U.el('initialAmount').value);
      if (!v || v <= 0) { toast('Capital invalide', 'Saisissez un montant supérieur à 0.', 'err'); return; }
      B.setInitial(v);
      renderBankroll(); renderHero(); renderHistory();
      toast('Bankroll définie', 'Capital de départ : ' + U.money(v), 'ok');
    });

    var unitRange = U.el('unitRange');
    if (unitRange) unitRange.addEventListener('input', function () {
      U.el('unitValue').textContent = unitRange.value + ' %';
      B.setParam({ unitPct: Number(unitRange.value) });
      renderBankroll();
    });

    var betForm = U.el('betForm');
    if (betForm) betForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var matchId = U.el('betMatch').value;
      var pred = STATE.preds[matchId];
      var m = STATE.matches.filter(function (x) { return x.id === matchId; })[0];
      var pick = U.el('betPick').value;
      var odds = Number(U.el('betOdds').value);
      var stake = Number(U.el('betStake').value);
      var custom = U.el('betCustom').value;

      if (!odds || odds <= 1) { toast('Cote invalide', 'Saisissez une cote supérieure à 1,00.', 'err'); return; }
      if (!stake || stake <= 0) { toast('Mise invalide', 'Saisissez une mise supérieure à 0.', 'err'); return; }

      B.addBet({
        matchId: (matchId && matchId !== '__custom') ? matchId : null,
        match: m ? (m.home + ' – ' + m.away) : (custom || 'Match personnalisé'),
        comp: m ? m.compLabel : 'Hors jeu de données',
        market: U.el('betMarket').value,
        pick: pick, odds: odds, stake: stake,
        modelProb: pred ? pred.probs[pick] : null,
        modelFairOdd: pred ? pred.fairOdds[pick] : null,
        confidence: pred ? pred.confidence : null,
        status: 'pending',
        note: (pred && pred.partialData) ? 'Données partielles pour une équipe' : ''
      });
      renderBankroll(); renderHistory(); renderHero();
      toast('Pari enregistré', U.money(stake) + ' à la cote ' + odds.toFixed(2) + '.', 'ok');
    });

    // Modale
    var bg = U.el('modalBg'), cl = U.el('modalClose');
    if (bg) bg.addEventListener('click', closeModal);
    if (cl) cl.addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  }

  function runDiagnose(btn) {
    btn.textContent = 'Test en cours…';
    btn.disabled = true;
    API.diagnose().then(function (r) {
      var e = U.el('diagBody');
      if (!e) return;
      e.innerHTML =
        card(r.openliga, 'OpenLigaDB', 'api.openligadb.de · sans clé', r.openliga) +
        card(r.tsdb, 'TheSportsDB', 'clé « ' + U.esc(API.settings().tsdbKey) + ' »', r.tsdb) +
        ((r.error || r.tsdbError)
          ? '<div class="hint" style="margin-top:12px">Détail technique : ' + U.esc(r.error || r.tsdbError) +
            '<br><br>Si ce navigateur n\'a pas accès à Internet (ou si CORS bloque l\'appel direct), ' +
            'l\'application continue de fonctionner avec le <b>snapshot de données réelles</b> embarqué. ' +
            'En environnement local avec Internet, activez le repli via le proxy serveur pour contourner CORS.</div>'
          : '<div class="hint" style="margin-top:12px">Les deux sources répondent : scores et classements ' +
            'sont synchronisés en temps réel.</div>');
      btn.textContent = 'Tester maintenant';
      btn.disabled = false;
    });
  }

  function card(ok, name, sub, count) {
    return '<div class="hist-card ' + (ok ? 'won' : 'lost') + '" style="margin-bottom:10px">' +
      '<div class="hist-card__head"><div><div class="hist-card__match">' + name + '</div>' +
      '<div class="hist-card__meta">' + sub + '</div></div>' +
      '<span class="hist-tag ' + (ok ? 'won' : 'lost') + '">' +
      (ok ? 'OK · ' + count + ' match(s)' : 'INJOIGNABLE') + '</span></div></div>';
  }

  function saveSettings() {
    API.saveSettings({
      tsdbKey: U.el('setKey').value.trim() || '3',
      autoRefresh: Number(U.el('setRefresh').value) || 45,
      proxy: U.el('setProxy').checked,
      live: U.el('setLive').checked
    });
    toast('Réglages enregistrés', 'Les prochains cycles de synchronisation utiliseront ces paramètres.', 'ok');
    refresh(false);
  }

  function loadDemoHistory() {
    var n = B.loadDemo(STATE.snapshot);
    renderBankroll(); renderHistory(); renderHero();
    if (n) toast('Historique d\'exemple chargé', n + ' paris construits sur des matchs réels, marqués comme exemple.', 'info');
    else toast('Aucun match terminé', 'Impossible de construire un historique d\'exemple.', 'err');
  }

  function resetBankroll() {
    if (!global.confirm('Effacer tous les paris et réinitialiser la bankroll ?')) return;
    B.clearAll(true);
    renderBankroll(); renderHistory(); renderHero();
    toast('Bankroll réinitialisée', 'Tous les paris ont été supprimés.', 'info');
  }

  function cycleBetStatus(id) {
    var b = B.load().bets.filter(function (x) { return x.id === id; })[0];
    if (!b) return;
    var order = ['pending', 'won', 'lost', 'push'];
    B.settle(id, order[(order.indexOf(b.status) + 1) % order.length]);
    renderBankroll(); renderHistory(); renderHero();
  }

  /* ------------------------------- MODALES ------------------------------ */
  function openDetailModal(matchId) {
    var m = STATE.matches.filter(function (x) { return x.id === matchId; })[0];
    if (!m) return;
    U.el('modalBody').innerHTML = U.modalMatch(m, STATE.preds[matchId]);
    U.el('modal').classList.add('is-open');
    document.body.style.overflow = 'hidden';

    var pred = STATE.preds[matchId];
    if (pred && CH.available()) {
      setTimeout(function () {
        var r = U.el('modalRadar'); if (r) CH.modelRadar(r, pred);
        var s = U.el('modalScores'); if (s) CH.scoresBar(s, pred.scores);
      }, 60);
    }
  }

  function openBetModal(matchId) {
    var m = STATE.matches.filter(function (x) { return x.id === matchId; })[0];
    if (!m) return;
    var pred = STATE.preds[matchId];
    var pick = pred ? pred.pick : '1';
    var odds = pred ? pred.fairOdds[pick] : 2.0;
    var stake = pred ? B.suggestedStake(pred.probs[pick], odds) : B.stats().unit;

    U.el('modalBody').innerHTML =
      '<div class="modal__head"><div><h3>Enregistrer un pari</h3>' +
      '<div class="sub">' + U.esc(m.home + ' – ' + m.away) + ' · ' + U.esc(m.compLabel) + ' · ' +
      U.esc(U.dayLabel(m.ts)) + '</div></div></div>' +
      (pred ? '<div class="modal__note">Pronostic du consensus : <b>' + U.esc(U.pickText(pred.pick, m)) + '</b> (' +
        Math.round(pred.pickProb * 100) + ' %, confiance ' + Math.round(pred.confidence * 100) +
        ' %, cote juste ' + pred.pickOdds.toFixed(2) + ').</div>' : '') +
      '<form id="modalBetForm"><div class="form-grid">' +
        '<div class="field"><label for="mPick">Pronostic</label><select id="mPick">' +
          ['1', 'X', '2'].map(function (k) {
            return '<option value="' + k + '"' + (k === pick ? ' selected' : '') + '>' +
              U.esc(k === '1' ? '1 · ' + m.home : k === 'X' ? 'X · Match nul' : '2 · ' + m.away) + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label for="mMarket">Marché</label><select id="mMarket">' +
          ['1X2', 'Double chance', 'Plus/Moins de buts', 'Les deux marquent', 'Score exact']
            .map(function (x) { return '<option>' + x + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label for="mOdds">Cote proposée par le bookmaker</label>' +
          '<input id="mOdds" type="number" step="0.01" min="1.01" value="' + odds.toFixed(2) + '"></div>' +
        '<div class="field"><label for="mStake">Mise (' + B.stats().currency + ')</label>' +
          '<input id="mStake" type="number" step="1" min="1" value="' + stake.toFixed(2) + '">' +
          '<div class="hint">Mise conseillée (demi-Kelly) : ' + U.money(stake) + '</div></div>' +
        '<div class="field full"><label for="mNote">Note (facultatif)</label>' +
          '<input id="mNote" placeholder="ex. value détectée, 2 unités"></div>' +
        '<div class="field full"><button class="btn btn--primary" type="submit">Ajouter au suivi</button></div>' +
      '</div></form>';

    U.el('modal').classList.add('is-open');
    document.body.style.overflow = 'hidden';

    U.el('modalBetForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var p = U.el('mPick').value;
      var o = Number(U.el('mOdds').value);
      var st = Number(U.el('mStake').value);
      if (!o || o <= 1 || !st || st <= 0) {
        toast('Valeurs invalides', 'Vérifiez la cote et la mise.', 'err');
        return;
      }
      B.addBet({
        matchId: m.id, match: m.home + ' – ' + m.away, comp: m.compLabel,
        market: U.el('mMarket').value, pick: p, odds: o, stake: st,
        modelProb: pred ? pred.probs[p] : null,
        modelFairOdd: pred ? pred.fairOdds[p] : null,
        confidence: pred ? pred.confidence : null,
        status: 'pending', note: U.el('mNote').value
      });
      closeModal();
      renderBankroll(); renderHistory(); renderHero();
      var v = pred ? M.value(pred, p, o) : null;
      toast('Pari enregistré', U.money(st) + ' à la cote ' + o.toFixed(2) +
        (v && v.isValue ? ' · VALUE +' + (v.edge * 100).toFixed(1) + ' % d\'espérance' : ''), 'ok');
    });
  }

  function closeModal() {
    var m = U.el('modal');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  /* -------------------------------- TOASTS ------------------------------ */
  function toast(title, msg, kind) {
    var host = U.el('toastHost');
    if (!host) return;
    var d = document.createElement('div');
    d.className = 'toast' + (kind === 'err' ? ' err' : kind === 'info' ? ' info' : '');
    d.innerHTML = '<b>' + U.esc(title) + '</b><span>' + U.esc(msg) + '</span>';
    host.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .4s, transform .4s';
      d.style.opacity = '0';
      d.style.transform = 'translateX(24px)';
      setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 420);
    }, 4600);
  }

  global.ZacoApp = {
    state: STATE, refresh: refresh, closeModal: closeModal, toast: toast,
    toggleDemo: toggleDemo, stopDemo: stopDemo, renderAll: renderAll
  };
  document.addEventListener('DOMContentLoaded', init);
})(window);
