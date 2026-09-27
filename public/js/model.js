/* ============================================================================
 * ZACO SPORT ODDS — Moteur de pronostics
 * ----------------------------------------------------------------------------
 * Modèle d'ensemble inspiré des méthodes publiques les plus reconnues par la
 * communauté des parieurs professionnels. Aucun flux propriétaire n'est utilisé :
 * tout est recalibré à partir de résultats et de classements publics.
 *
 *  1. FORCE ELO        — méthode Elo adaptée au football, dans l'esprit des
 *                        classements ClubElo (clubelo.com) et SPI (FiveThirtyEight).
 *  2. DIXON–COLES      — modèle de Poisson bivarié avec correction des petits
 *                        scores (Dixon & Coles, 1997), référence académique du
 *                        marché des paris sur le 1X2 et les scores exacts.
 *  3. FORME / MOMENTUM — pondération des performances récentes (fenêtre glissante
 *                        type Opta / StatsBomb simplifiée).
 *  4. MARCHÉ           — probabilités implicites des cotes bookmakers, marge
 *                        retirée (méthode de normalisation proportionnelle).
 *
 * Le « Consensus ZACO » agrège ces 4 points de vue. Plus les modèles sont
 * d'accord et plus les données de départ sont nombreuses, plus la confiance
 * affichée est élevée.
 * ========================================================================== */
(function (global) {
  'use strict';

  var MAX_GOALS = 7;      // grille de scores 0..7
  var RHO = -0.055;       // paramètre de dépendance Dixon-Coles (petits scores)

  /* ------------------------------ Utilitaires --------------------------- */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Alias : permet de relier un nom d'équipe venu d'une API à une clé interne. */
  var ALIASES = {
    'bayern': 'bayern', 'fc bayern munchen': 'bayern', 'bayern munich': 'bayern', 'bayern munchen': 'bayern',
    'borussia dortmund': 'dortmund', 'dortmund': 'dortmund',
    'rb leipzig': 'leipzig', 'leipzig': 'leipzig',
    'vfb stuttgart': 'stuttgart', 'stuttgart': 'stuttgart',
    'tsg hoffenheim': 'hoffenheim', 'hoffenheim': 'hoffenheim',
    'bayer leverkusen': 'leverkusen', 'bayer 04 leverkusen': 'leverkusen', 'leverkusen': 'leverkusen',
    'sc freiburg': 'freiburg', 'freiburg': 'freiburg',
    'eintracht frankfurt': 'frankfurt', 'frankfurt': 'frankfurt',
    'fc augsburg': 'augsburg', 'augsburg': 'augsburg',
    'mainz': 'mainz', '1 fsv mainz 05': 'mainz', 'fsv mainz 05': 'mainz',
    'union berlin': 'union', '1 fc union berlin': 'union',
    'borussia monchengladbach': 'gladbach', 'gladbach': 'gladbach', 'monchengladbach': 'gladbach',
    'hamburger sv': 'hsv', 'hsv': 'hsv', 'hamburg': 'hsv',
    'koln': 'koeln', '1 fc koln': 'koeln', 'cologne': 'koeln',
    'wolfsburg': 'wolfsburg', 'vfl wolfsburg': 'wolfsburg',
    'heidenheim': 'heidenheim', '1 fc heidenheim 1846': 'heidenheim',
    'st pauli': 'stpauli', 'fc st pauli': 'stpauli',
    'elversberg': 'elversberg', 'sv 07 elversberg': 'elversberg', 'sv elversberg': 'elversberg',
    'schalke': 'schalke', 'fc schalke 04': 'schalke', 'schalke 04': 'schalke',
    'paderborn': 'paderborn', 'sc paderborn 07': 'paderborn',
    'arsenal': 'arsenal', 'manchester city': 'man city', 'man city': 'man city',
    'brighton and hove albion': 'brighton', 'brighton': 'brighton', 'brighton hove albion': 'brighton',
    'brentford': 'brentford', 'leeds united': 'leeds', 'leeds': 'leeds',
    'manchester united': 'man united', 'man united': 'man united',
    'aston villa': 'aston villa', 'liverpool': 'liverpool', 'fulham': 'fulham',
    'barcelona': 'barcelona', 'real madrid': 'real madrid', 'villarreal': 'villarreal',
    'atletico madrid': 'atletico', 'atletico': 'atletico', 'real betis': 'betis', 'betis': 'betis',
    'valencia': 'valencia', 'real sociedad': 'real sociedad', 'malaga': 'malaga', 'espanyol': 'espanyol',
    'ac milan': 'ac milan', 'milan': 'ac milan', 'lecce': 'lecce', 'genoa': 'genoa',
    'fiorentina': 'fiorentina', 'como': 'como',
    'paris saint germain': 'psg', 'psg': 'psg', 'lens': 'lens', 'lille': 'lille', 'lyon': 'lyon',
    'marseille': 'marseille', 'sporting cp': 'sporting cp', 'sporting': 'sporting cp',
    'columbus crew': 'columbus crew', 'inter miami': 'inter miami',
    'monterey bay fc': 'monterey bay', 'monterey bay': 'monterey bay',
    'lexington sc': 'lexington', 'lexington': 'lexington',
    'new mexico united': 'new mexico', 'sacramento republic': 'sacramento',
    'oakland roots': 'oakland roots', 'phoenix rising': 'phoenix rising',
    'spain': 'spain', 'espagne': 'spain', 'argentina': 'argentina', 'argentine': 'argentina'
  };

  function teamKey(name) {
    var n = norm(name);
    return ALIASES[n] || n.replace(/ /g, '-');
  }

  /* ------------------------------ Math ---------------------------------- */
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function poisson(k, lambda) { return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /** Correction Dixon–Coles : ajuste les scores faibles (0-0, 1-0, 0-1, 1-1). */
  function dcTau(x, y, lh, la, rho) {
    if (x === 0 && y === 0) return 1 - lh * la * rho;
    if (x === 0 && y === 1) return 1 + lh * rho;
    if (x === 1 && y === 0) return 1 + la * rho;
    if (x === 1 && y === 1) return 1 - rho;
    return 1;
  }

  /* =================== Construction du contexte (ratings) =============== */
  /**
   * Calcule, pour chaque compétition, la moyenne de buts et les forces
   * offensives / défensives de chaque équipe, à partir des classements réels.
   * On mélange saison en cours et saison précédente (régression vers la moyenne
   * pour les petits échantillons).
   */
  /* Prior global : niveau de buts par équipe et par match hors contexte connu
     (≈ 2,84 buts par match). Sert à régulariser les petits échantillons. */
  var GLOBAL_PRIOR = 1.42;
  var PRIOR_MATCHES = 130;      // « pseudo-matchs » apportés par le prior
  var HOME_SHARE = 0.545;        // part des buts marqués par l'équipe à domicile
  var PRIOR_ELO = 1430;          // équipe inconnue ≈ légèrement sous la moyenne
  var PRIOR_ATK = 0.97, PRIOR_DEF = 1.05;

  /**
   * Construit les forces offensives/défensives et les ratings Elo.
   * Le niveau de buts de référence (`base`) est calculé par championnat, toutes
   * saisons confondues, puis régularisé vers un prior global : cela évite les
   * biais des petits échantillons (début de saison) et des classements tronqués.
   */
  function buildContext(snapshot) {
    var ctx = { leagues: {}, built: new Date().toISOString() };
    var tables = snapshot.tables || [];

    (snapshot.competitions || []).forEach(function (c) {
      ctx.leagues[c.id] = { comp: c.id, ratings: {}, forms: {}, played: {}, base: GLOBAL_PRIOR };
    });

    /* ---- Phase A : agrégats par championnat ---- */
    var agg = {};
    tables.forEach(function (t) {
      var L = ctx.leagues[t.comp];
      if (!L) L = ctx.leagues[t.comp] = { comp: t.comp, ratings: {}, forms: {}, played: {}, base: GLOBAL_PRIOR };
      var a = agg[t.comp] || (agg[t.comp] = { gf: 0, pl: 0 });
      t.rows.forEach(function (r) { a.gf += r.gf; a.pl += r.pl; });
    });

    /* ---- Phase B : niveau de référence régularisé ---- */
    Object.keys(agg).forEach(function (id) {
      var a = agg[id], L = ctx.leagues[id];
      if (!L || !a.pl) return;
      L.base = (a.gf + GLOBAL_PRIOR * PRIOR_MATCHES) / (a.pl + PRIOR_MATCHES);
      L.avgHome = 2 * L.base * HOME_SHARE;
      L.avgAway = 2 * L.base * (1 - HOME_SHARE);
    });

    /* ---- Phase C : forces par équipe ---- */
    tables.forEach(function (t) {
      var L = ctx.leagues[t.comp];
      if (!L) return;
      var weight = t.historical ? 0.55 : 1.0;   // la saison en cours pèse plus lourd
      var base = L.base || GLOBAL_PRIOR;

      t.rows.forEach(function (r) {
        var key = r.id || teamKey(r.n);
        var pl = r.pl || 1;
        var atk = (r.gf / pl) / base;
        var def = (r.ga / pl) / base;
        var shrink = pl / (pl + 10);            // petit échantillon → retour vers 1
        atk = 1 + (atk - 1) * shrink;
        def = 1 + (def - 1) * shrink;

        var prev = L.ratings[key];
        if (prev) {
          var w = prev.w + weight;
          L.ratings[key] = {
            atk: (prev.atk * prev.w + atk * weight) / w,
            def: (prev.def * prev.w + def * weight) / w,
            ppg: (prev.ppg * prev.w + (r.pts / pl) * weight) / w,
            w: w, played: prev.played + pl, elo: 0, names: [r.n]
          };
        } else {
          L.ratings[key] = {
            atk: atk, def: def, ppg: r.pts / pl, w: weight,
            played: pl, elo: 0, names: [r.n]
          };
        }
        if (r.form) L.forms[key] = r.form;
        L.played[key] = (L.played[key] || 0) + pl;
      });
    });

    /* ---- Phase D : rating Elo reconstruit depuis les points et la différence
       offensive/défensive (échelle 1200–2100, moyenne ligue ≈ 1500). ---- */
    Object.keys(ctx.leagues).forEach(function (id) {
      var L = ctx.leagues[id]; if (!L) return;
      var ppgs = Object.keys(L.ratings).map(function (k) { return L.ratings[k].ppg; });
      var meanPpg = ppgs.length ? ppgs.reduce(function (a, b) { return a + b; }, 0) / ppgs.length : 1.35;
      Object.keys(L.ratings).forEach(function (k) {
        var r = L.ratings[k];
        var ppg = clamp(r.ppg || 1.35, 0, 3);
        var domination = (r.atk - r.def) * 0.85;
        r.elo = round(1500 + (ppg - meanPpg) * 210 + domination * 130, 0);
      });
    });

    return ctx;
  }

  /** Force d'une équipe, avec prior explicite si aucune donnée n'existe. */
  function ratingOf(L, key) {
    if (L && L.ratings[key]) return { r: L.ratings[key], known: true };
    return {
      r: { atk: PRIOR_ATK, def: PRIOR_DEF, elo: PRIOR_ELO, ppg: 1.25, played: 0 },
      known: false
    };
  }

  /* ============================ Prédiction ============================== */
  /**
   * @param {Object} ctx        contexte produit par buildContext()
   * @param {String} compId     identifiant de compétition
   * @param {String} homeTeam   nom de l'équipe à domicile
   * @param {String} awayTeam   nom de l'équipe à l'extérieur
   * @param {Object} opt        { marketOdds:[o1,oX,o2], neutral:Boolean }
   */
  function predict(ctx, compId, homeTeam, awayTeam, opt) {
    opt = opt || {};
    var L = ctx.leagues[compId] || null;
    var hk = teamKey(homeTeam), ak = teamKey(awayTeam);
    var hrO = ratingOf(L, hk), arO = ratingOf(L, ak);
    var hr = hrO.r, ar = arO.r;

    // Niveau de buts de référence du championnat, séparé domicile / extérieur
    var base = (L && L.base) || GLOBAL_PRIOR;
    var avgHome = (L && L.avgHome) || 2 * base * HOME_SHARE;
    var avgAway = (L && L.avgAway) || 2 * base * (1 - HOME_SHARE);

    // Équipes sans historique → prior explicite, confiance dégradée
    var dataScore = 0;
    var homePrio = !hrO.known, awayPrio = !arO.known;
    var hatk = hr.atk, hdef = hr.def, aatk = ar.atk, adef = ar.def;
    if (hrO.known) dataScore += clamp(hr.played / 40, 0.25, 1) * 0.5;
    if (arO.known) dataScore += clamp(ar.played / 40, 0.25, 1) * 0.5;
    if (!hrO.known && !arO.known) dataScore = 0.12;
    else if (!hrO.known || !arO.known) dataScore = Math.min(dataScore, 0.55);

    // ---- 1) Modèle Poisson + Dixon–Coles
    var la = clamp(avgHome * hatk * adef, 0.15, 4.0);
    var lb = clamp(avgAway * aatk * hdef, 0.12, 3.8);

    var grid = [], sumP = 0, p1 = 0, pX = 0, p2 = 0, btts = 0, over = 0, bestList = [];
    for (var x = 0; x <= MAX_GOALS; x++) {
      grid[x] = [];
      for (var y = 0; y <= MAX_GOALS; y++) {
        var p = poisson(x, la) * poisson(y, lb) * dcTau(x, y, la, lb, RHO);
        p = Math.max(p, 0);
        grid[x][y] = p; sumP += p;
      }
    }
    for (var i = 0; i <= MAX_GOALS; i++) for (var j = 0; j <= MAX_GOALS; j++) {
      var pr = grid[i][j] / sumP;
      if (i > j) p1 += pr; else if (i === j) pX += pr; else p2 += pr;
      if (i > 0 && j > 0) btts += pr;
      if (i + j > 2.5) over += pr;
      bestList.push({ score: i + '-' + j, p: pr });
    }
    bestList.sort(function (a, b) { return b.p - a.p; });

    var poissonProbs = { '1': p1, X: pX, '2': p2 };

    // ---- 2) Modèle Elo (les équipes inconnues reçoivent un rating prior)
    var dr = hr.elo - ar.elo + 65;                // +65 = avantage du terrain
    var e = 1 / (1 + Math.pow(10, -dr / 400));    // probabilité « Elo » que le domicile ne perde pas
    var drawShare = clamp(0.29 - Math.abs(dr) / 4200, 0.12, 0.30);
    var eloProbs = { '1': e * (1 - drawShare), X: drawShare, '2': (1 - e) * (1 - drawShare) };

    // ---- 3) Modèle forme / momentum
    function formScore(k) {
      var f = (L && L.forms && L.forms[k]) || '';
      if (!f) return 0;
      var pts = 0, n = 0;
      for (var z = 0; z < f.length; z++) {
        var wgt = 1 + z * 0.18;                  // le match le plus récent pèse plus
        pts += (f[z] === 'W' ? 3 : f[z] === 'D' ? 1 : 0) * wgt; n += 3 * wgt;
      }
      return n ? (pts / n - 0.5) * 0.34 : 0;      // -0.17 … +0.17
    }
    var fh = formScore(hk), fa = formScore(ak);
    var formShift = fh - fa;
    var mLa = clamp(la * (1 + formShift), 0.2, 5), mLb = clamp(lb * (1 - formShift), 0.2, 5);
    var f1 = 0, fX = 0, f2 = 0;
    for (var a2 = 0; a2 <= MAX_GOALS; a2++) for (var b2 = 0; b2 <= MAX_GOALS; b2++) {
      var q = poisson(a2, mLa) * poisson(b2, mLb) * dcTau(a2, b2, mLa, mLb, RHO);
      if (a2 > b2) f1 += q; else if (a2 === b2) fX += q; else f2 += q;
    }
    var fs = f1 + fX + f2;
    var formProbs = { '1': f1 / fs, X: fX / fs, '2': f2 / fs };

    // ---- 4) Modèle marché (cotes bookmaker éventuelles)
    var marketProbs = null, margin = null;
    if (opt.marketOdds && opt.marketOdds.length === 3 && opt.marketOdds.every(function (o) { return o > 1; })) {
      var iv = opt.marketOdds.map(function (o) { return 1 / o; });
      var s = iv[0] + iv[1] + iv[2];
      margin = s - 1;
      marketProbs = { '1': iv[0] / s, X: iv[1] / s, '2': iv[2] / s };
    }

    // ---- Agrégation (consensus)
    var eloKnown = (hrO.known ? 1 : 0) + (arO.known ? 1 : 0);
    var W = {
      elo: eloKnown === 2 ? 0.26 : eloKnown === 1 ? 0.16 : 0.10,
      poisson: 0.38, form: 0.18, market: marketProbs ? 0.30 : 0
    };
    var wsum = W.elo + W.poisson + W.form + W.market;
    var cons = {};
    ['1', 'X', '2'].forEach(function (k) {
      var v = eloProbs[k] * W.elo + poissonProbs[k] * W.poisson + formProbs[k] * W.form;
      if (marketProbs) v += marketProbs[k] * W.market;
      cons[k] = v / wsum;
    });

    // Normalisation finale
    var tot = cons['1'] + cons.X + cons['2'];
    cons['1'] /= tot; cons.X /= tot; cons['2'] /= tot;

    // ---- Confiance : accord inter-modèles + volume de données + entropie
    var disagree = (Math.abs(eloProbs['1'] - poissonProbs['1']) +
                    Math.abs(eloProbs['2'] - poissonProbs['2']) +
                    Math.abs(formProbs['1'] - poissonProbs['1'])) / 3;
    var maxP = Math.max(cons['1'], cons.X, cons['2']);
    var confidence = clamp(
      0.34 * (1 - clamp(disagree / 0.16, 0, 1)) +
      0.36 * clamp((maxP - 0.33) / 0.34, 0, 1) +
      0.30 * dataScore,
      0.08, 0.97);

    var pick = cons['1'] >= cons['2'] && cons['1'] >= cons.X ? '1'
             : cons['2'] >= cons['1'] && cons['2'] >= cons.X ? '2' : 'X';

    var fair = { '1': 1 / cons['1'], X: 1 / cons.X, '2': 1 / cons['2'] };
    var bttsP = btts / sumP, overP = over / sumP;

    return {
      comp: compId,
      home: homeTeam, away: awayTeam,
      hk: hk, ak: ak,
      lambdaHome: round(la, 2), lambdaAway: round(lb, 2),
      probs: { '1': cons['1'], X: cons.X, '2': cons['2'] },
      models: { elo: eloProbs, poisson: poissonProbs, form: formProbs, market: marketProbs },
      fairOdds: { '1': round(fair['1'], 2), X: round(fair.X, 2), '2': round(fair['2'], 2) },
      margin: margin,
      pick: pick,
      pickProb: cons[pick],
      pickOdds: round(fair[pick], 2),
      confidence: confidence,
      dataScore: round(dataScore, 2),
      partialData: (homePrio || awayPrio),
      missing: [homePrio ? homeTeam : null, awayPrio ? awayTeam : null].filter(Boolean),
      scores: bestList.slice(0, 6).map(function (s) { return { score: s.score, p: s.p }; }),
      btts: bttsP, over25: overP, under25: 1 - overP,
      doubleChance: { '1X': cons['1'] + cons.X, '12': cons['1'] + cons['2'], X2: cons.X + cons['2'] },
      eloHome: hrO.known ? hr.elo : null, eloAway: arO.known ? ar.elo : null,
      base: round(base, 3), avgHome: round(avgHome, 3), avgAway: round(avgAway, 3)
    };
  }

  /** Prédit un match du snapshot ou un match live normalisé. */
  function predictMatch(match, ctx, opt) {
    var p = predict(ctx, match.comp, match.home, match.away, opt);
    p.matchId = match.id;
    p.ts = match.ts;
    return p;
  }

  /** Score de « value » : écart entre la cote proposée et la cote juste du modèle. */
  function value(pred, pick, offered) {
    if (!offered || offered <= 1) return null;
    var p = pred.probs[pick];
    var fair = 1 / p;
    var ev = (p * offered) - 1;                       // espérance de gain unitaire
    return {
      pick: pick, offered: offered, fair: round(fair, 2),
      edge: ev,                                        // > 0 → value bet
      isValue: ev > 0.02,
      kelly: clamp((p * offered - 1) / (offered - 1), 0, 0.25) // fraction de mise (Kelly)
    };
  }

  /**
   * Évalue les pronostics passés du modèle sur des matchs RÉELLEMENT terminés.
   * Les forces sont volontairement calculées sur la saison précédente afin
   * d'éviter tout biais de connaissance anticipée (look-ahead bias).
   */
  function backtest(ctx, finished, snapshot) {
    var histCtx = buildContext({
      competitions: snapshot.competitions,
      tables: (snapshot.tables || []).filter(function (t) { return t.historical; })
    });
    var out = [];
    finished.forEach(function (m) {
      if (m.hg === null || m.hg === undefined || m.ag === null || m.ag === undefined) return;
      var pred = predict(histCtx, m.comp, m.home, m.away);
      var real = m.hg > m.ag ? '1' : m.hg === m.ag ? 'X' : '2';
      var ok = pred.pick === real;
      var odd = pred.pickOdds;
      out.push({
        match: m, pred: pred,
        real: real, won: ok,
        stake: 10,
        pnl: round(ok ? (10 * (odd - 1)) : -10, 2),
        correctScore: pred.scores[0].score === (m.hg + '-' + m.ag)
      });
    });
    return out;
  }

  /** Classe les meilleurs pronostics (confiance + value) parmi les matchs à venir. */
  function rankPicks(upcoming, ctx, limit) {
    var list = upcoming.map(function (m) { return predictMatch(m, ctx); })
      .filter(function (p) { return p.confidence > 0.34; });
    list.sort(function (a, b) {
      var sa = a.confidence * 0.62 + a.pickProb * 0.38 + (a.partialData ? -0.1 : 0);
      var sb = b.confidence * 0.62 + b.pickProb * 0.38 + (b.partialData ? -0.1 : 0);
      return sb - sa;
    });
    return list.slice(0, limit || 8);
  }

  global.ZacoModel = {
    buildContext: buildContext,
    predict: predict,
    predictMatch: predictMatch,
    backtest: backtest,
    rankPicks: rankPicks,
    value: value,
    teamKey: teamKey,
    poisson: poisson
  };
})(window);
