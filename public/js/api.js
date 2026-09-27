/* ============================================================================
 * ZACO SPORT ODDS — Couche d'accès aux données (temps réel)
 * ----------------------------------------------------------------------------
 * L'application démarre sur le snapshot embarqué (voir js/data/snapshot.js) puis
 * synchronise les données réelles depuis deux API publiques et gratuites :
 *
 *   • OpenLigaDB   — https://api.openligadb.de     (sans clé, CORS ouvert)
 *       Bundesliga 1 : calendrier complet, scores live, buteurs, classement.
 *
 *   • TheSportsDB  — https://www.thesportsdb.com/api/v1/json/{clé}
 *       Championnats du monde entier, matchs du jour, classements.
 *       Clé de test publique par défaut : « 3 » (remplaçable dans les réglages).
 *
 * Stratégie réseau : requête directe (CORS) → en cas d'échec, repli sur le
 * proxy /api/proxy du serveur local → en dernier recours, snapshot embarqué.
 * ========================================================================== */
(function (global) {
  'use strict';

  var LS_KEY = 'zaco.settings.v1';
  var LS_CACHE = 'zaco.cache.v1';
  var CACHE_TTL = 4 * 60 * 1000;          // 4 minutes

  var CFG = {
    tsdb: 'https://www.thesportsdb.com/api/v1/json/',
    openliga: 'https://api.openligadb.de',
    timeout: 9000
  };

  /* Identifiants des compétitions côté TheSportsDB */
  var TSDB_LEAGUES = [
    { comp: 'pl',      id: '4328', season: '2026-2027' },
    { comp: 'laliga',  id: '4335', season: '2026-2027' },
    { comp: 'seriea',  id: '4332', season: '2026-2027' },
    { comp: 'ligue1',  id: '4334', season: '2026-2027' },
    { comp: 'ucl',     id: '4480', season: '2026-2027' },
    { comp: 'mls',     id: '4346', season: '2026' },
    { comp: 'usl',     id: '4684', season: '2026' },
    { comp: 'wc',      id: '4429', season: '2026' },
    { comp: 'bl1',     id: '4331', season: '2026-2027' }
  ];

  var STATUS = { mode: 'snapshot', sources: [], lastSync: null, errors: [] };

  /* ------------------------------ Réglages ------------------------------ */
  function settings() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return {
        tsdbKey: s.tsdbKey || '3',
        proxy: s.proxy !== false,           // repli proxy autorisé par défaut
        live: s.live !== false,
        autoRefresh: s.autoRefresh || 45     // secondes
      };
    } catch (e) { return { tsdbKey: '3', proxy: true, live: true, autoRefresh: 45 }; }
  }
  function saveSettings(patch) {
    var s = settings();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }

  /* ------------------------------ Réseau -------------------------------- */
  function withTimeout(ms) {
    if (typeof AbortController === 'undefined') return { signal: null, done: function () {} };
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    return { signal: ctrl.signal, done: function () { clearTimeout(t); } };
  }

  function tryFetch(url) {
    var t = withTimeout(CFG.timeout);
    return fetch(url, { signal: t.signal, headers: { Accept: 'application/json' } })
      .then(function (r) {
        t.done();
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) { t.done(); throw e; });
  }

  /** Récupère un JSON avec repli automatique sur le proxy serveur. */
  function getJson(url) {
    return tryFetch(url).catch(function (err) {
      var s = settings();
      if (!s.proxy) throw err;
      return tryFetch('/api/proxy?url=' + encodeURIComponent(url));
    });
  }

  /* ---------------------- Normalisation des matchs ---------------------- */
  var TS_STATUS = {
    NS: 'NS', TBD: 'NS', '1H': 'LIVE', '2H': 'LIVE', HT: 'LIVE', ET: 'LIVE', BT: 'LIVE',
    PT: 'LIVE', 'PEN': 'LIVE', LIVE: 'LIVE', FT: 'FT', AET: 'AET', PEN_FT: 'FT',
    AWD: 'FT', WO: 'FT', PPD: 'PPD', CANC: 'CANC', SUSP: 'CANC', ABD: 'CANC', INT: 'CANC'
  };

  function tsdbEvent(e) {
    if (!e) return null;
    var status = TS_STATUS[e.strStatus] || (e.strStatus ? 'NS' : 'NS');
    var hg = e.intHomeScore === null || e.intHomeScore === undefined ? null : Number(e.intHomeScore);
    var ag = e.intAwayScore === null || e.intAwayScore === undefined ? null : Number(e.intAwayScore);
    var ts = e.strTimestamp ? e.strTimestamp + 'Z' : (e.dateEvent ? e.dateEvent + 'T' + (e.strTime || '00:00:00') + 'Z' : null);
    return {
      id: 'ts-' + e.idEvent,
      comp: compFromTsdbLeague(e.idLeague),
      round: e.intRound && e.intRound !== '0' ? ('Journée ' + e.intRound) : (e.strGroup || 'Saison régulière'),
      ts: ts,
      status: status,
      venue: e.strVenue || null,
      home: e.strHomeTeam,
      away: e.strAwayTeam,
      homeKey: global.ZacoModel ? ZacoModel.teamKey(e.strHomeTeam) : e.strHomeTeam,
      awayKey: global.ZacoModel ? ZacoModel.teamKey(e.strAwayTeam) : e.strAwayTeam,
      hb: e.strHomeTeamBadge || null,
      ab: e.strAwayTeamBadge || null,
      hg: hg, ag: ag,
      leagueName: e.strLeague,
      leagueBadge: e.strLeagueBadge || null,
      source: 'TheSportsDB',
      note: e.strResult || null
    };
  }

  var TSDB_ID_TO_COMP = {};
  TSDB_LEAGUES.forEach(function (l) { TSDB_ID_TO_COMP[l.id] = l.comp; });
  function compFromTsdbLeague(id) { return TSDB_ID_TO_COMP[String(id)] || 'other-' + id; }

  /** OpenLigaDB : un match brut → format normalisé. */
  function openLigaMatch(m) {
    var end = null, ht = null;
    (m.matchResults || []).forEach(function (r) {
      if (r.resultTypeID === 2) end = r;
      if (r.resultTypeID === 1) ht = r;
    });
    var hg = end ? end.pointsTeam1 : null;
    var ag = end ? end.pointsTeam2 : null;

    // score « en cours » reconstruit depuis la liste des buts (mise à jour live)
    if (!end && m.goals && m.goals.length) {
      var last = m.goals[m.goals.length - 1];
      hg = last.scoreTeam1; ag = last.scoreTeam2;
    }
    var start = Date.parse(m.matchDateTimeUTC || m.matchDateTime);
    var now = Date.now();
    var status;
    if (m.matchIsFinished) status = 'FT';
    else if (start && now >= start && now < start + 150 * 60000) status = 'LIVE';
    else status = 'NS';

    return {
      id: 'ol-' + m.matchID,
      comp: 'bl1',
      round: (m.group && m.group.groupName) || 'Saison',
      ts: m.matchDateTimeUTC || m.matchDateTime,
      status: status,
      venue: m.location || null,
      home: m.team1.teamName,
      away: m.team2.teamName,
      homeKey: global.ZacoModel ? ZacoModel.teamKey(m.team1.teamName) : m.team1.teamName,
      awayKey: global.ZacoModel ? ZacoModel.teamKey(m.team2.teamName) : m.team2.teamName,
      hb: m.team1.teamIconUrl || null,
      ab: m.team2.teamIconUrl || null,
      hg: hg, ag: ag,
      ht: ht ? [ht.pointsTeam1, ht.pointsTeam2] : null,
      goals: m.goals || [],
      leagueName: m.leagueName,
      source: 'OpenLigaDB',
      minutes: status === 'LIVE' ? Math.min(90, Math.round((now - start) / 60000)) : (m.matchIsFinished ? 90 : 0)
    };
  }

  function openLigaTable(rows) {
    return rows.map(function (r, i) {
      return {
        id: global.ZacoModel ? ZacoModel.teamKey(r.teamName) : r.teamName,
        n: r.teamName, b: r.teamIconUrl, rank: i + 1,
        pl: r.matches, w: r.won, d: r.draw, l: r.lost,
        gf: r.goals, ga: r.opponentGoals, gd: r.goalDiff, pts: r.points, form: null, note: null
      };
    });
  }

  function tsdbTable(rows) {
    return rows.map(function (r) {
      return {
        id: global.ZacoModel ? ZacoModel.teamKey(r.strTeam) : r.strTeam,
        n: r.strTeam, b: (r.strBadge || '').replace(/\/tiny$/, ''), rank: Number(r.intRank),
        pl: Number(r.intPlayed), w: Number(r.intWin), d: Number(r.intDraw), l: Number(r.intLoss),
        gf: Number(r.intGoalsFor), ga: Number(r.intGoalsAgainst), gd: Number(r.intGoalDifference),
        pts: Number(r.intPoints), form: r.strForm || null, note: r.strDescription || null
      };
    });
  }

  /* ------------------------------ Helpers ------------------------------- */
  function ymd(d) {
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  function settle(promise) {
    return promise.then(function (v) { return { ok: true, value: v }; })
                  .catch(function (e) { return { ok: false, error: e.message || String(e) }; });
  }

  /* ============================== SYNC ================================== */
  /**
   * Récupère l'ensemble des données disponibles puis renvoie un jeu fusionné.
   * Chaque source est isolée : un échec n'empêche pas les autres.
   */
  function sync() {
    var s = settings();
    var jobs = [];
    var srcResults = [];

    // --- 1. OpenLigaDB : Bundesliga complète (calendrier + classement)
    jobs.push(settle(getJson(CFG.openliga + '/getmatchdata/bl1')).then(function (r) {
      srcResults.push({ name: 'OpenLigaDB · matchs', ok: r.ok, count: r.ok ? r.value.length : 0, error: r.error });
      return r.ok ? r.value.map(openLigaMatch) : [];
    }));
    jobs.push(settle(getJson(CFG.openliga + '/getbltable/bl1/2026')).then(function (r) {
      srcResults.push({ name: 'OpenLigaDB · classement', ok: r.ok, count: r.ok ? r.value.length : 0, error: r.error });
      return r.ok ? { comp: 'bl1', season: '2026/2027', rows: openLigaTable(r.value),
                      label: 'Bundesliga · saison en cours (temps réel)', updated: new Date().toISOString().slice(0, 10),
                      complete: true, live: true } : null;
    }));

    // --- 2. TheSportsDB : matchs du jour et de demain (tous championnats)
    [0, 1].forEach(function (offset) {
      var d = new Date(Date.now() + offset * 86400000);
      jobs.push(settle(getJson(CFG.tsdb + s.tsdbKey + '/eventsday.php?d=' + ymd(d) + '&s=Soccer')).then(function (r) {
        srcResults.push({ name: 'TheSportsDB · matchs du ' + ymd(d), ok: r.ok, count: r.ok && r.value.events ? r.value.events.length : 0, error: r.error });
        return r.ok && r.value.events ? r.value.events.map(tsdbEvent).filter(Boolean) : [];
      }));
    });

    // --- 3. TheSportsDB : prochains matchs + classements par compétition
    TSDB_LEAGUES.forEach(function (L) {
      jobs.push(settle(getJson(CFG.tsdb + s.tsdbKey + '/eventsnextleague.php?id=' + L.id)).then(function (r) {
        if (!r.ok || !r.value.events) return [];
        return r.value.events.map(tsdbEvent).filter(Boolean);
      }));
      jobs.push(settle(getJson(CFG.tsdb + s.tsdbKey + '/eventspastleague.php?id=' + L.id)).then(function (r) {
        if (!r.ok || !r.value.events) return [];
        return r.value.events.map(tsdbEvent).filter(Boolean);
      }));
      jobs.push(settle(getJson(CFG.tsdb + s.tsdbKey + '/lookuptable.php?l=' + L.id + '&s=' + L.season)).then(function (r) {
        if (!r.ok || !r.value.table) return null;
        return { comp: L.comp, season: L.season.replace('-', '/'),
                 rows: tsdbTable(r.value.table), complete: r.value.table.length >= 16,
                 label: 'Classement ' + L.season.replace('-', '/') + ' (temps réel)',
                 updated: new Date().toISOString().slice(0, 10), live: true };
      }));
    });

    return Promise.all(jobs).then(function (res) {
      var matches = [], tables = [];
      res.forEach(function (r) {
        if (Array.isArray(r)) matches = matches.concat(r);
        else if (r && r.rows) tables.push(r);
      });

      var okCount = srcResults.filter(function (x) { return x.ok; }).length;
      STATUS.sources = srcResults;
      STATUS.lastSync = new Date().toISOString();
      STATUS.errors = srcResults.filter(function (x) { return !x.ok; }).map(function (x) { return x.name + ' : ' + x.error; });
      STATUS.mode = okCount === 0 ? 'snapshot' : (okCount < srcResults.length ? 'partial' : 'live');

      var payload = { matches: matches, tables: tables, status: STATUS };
      try { localStorage.setItem(LS_CACHE, JSON.stringify({ at: Date.now(), payload: payload })); } catch (e) {}
      return payload;
    });
  }

  function cached() {
    try {
      var c = JSON.parse(localStorage.getItem(LS_CACHE) || 'null');
      if (c && Date.now() - c.at < CACHE_TTL) return c.payload;
      if (c) return c.payload;      // on renvoie le cache périmé : mieux que rien
    } catch (e) {}
    return null;
  }

  /** Diagnostic réseau affiché dans l'interface. */
  function diagnose() {
    return getJson(CFG.openliga + '/getmatchdata/bl1').then(function (d) {
      return { openliga: Array.isArray(d) ? d.length : 0 };
    }).catch(function (e) {
      return Promise.resolve({ openliga: 0, error: e.message });
    }).then(function (r) {
      return getJson(CFG.tsdb + settings().tsdbKey + '/eventsday.php?d=' + ymd(new Date()) + '&s=Soccer')
        .then(function (d) { r.tsdb = d && d.events ? d.events.length : 0; return r; })
        .catch(function (e) { r.tsdb = 0; r.tsdbError = e.message; return r; });
    });
  }

  global.ZacoAPI = {
    sync: sync,
    cached: cached,
    diagnose: diagnose,
    settings: settings,
    saveSettings: saveSettings,
    status: STATUS,
    TSDB_LEAGUES: TSDB_LEAGUES,
    tsdbEvent: tsdbEvent,
    openLigaMatch: openLigaMatch,
    getJson: getJson
  };
})(window);
