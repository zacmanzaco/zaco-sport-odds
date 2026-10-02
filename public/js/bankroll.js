/* ============================================================================
 * ZACO SPORT ODDS — Gestion de bankroll
 * ----------------------------------------------------------------------------
 * Suivi complet des paris : mise initiale, dépôts/retraits, paris en cours,
 * règlement (gagné / perdu / remboursé), calcul du ROI, du yield, du taux de
 * réussite, de la série en cours et du drawdown maximal.
 * Persistance : localStorage (aucune donnée envoyée sur un serveur).
 * ========================================================================== */
(function (global) {
  'use strict';

  var LS = 'zaco.bankroll.v1';

  var state = null;

  function blank() {
    return {
      initial: 1000,
      currency: '€',
      unitPct: 2,              // % de la bankroll misé par pari (mise conseillée)
      kellyFraction: 0.5,      // demi-Kelly par défaut
      deposit: 1000,
      bets: [],
      createdAt: new Date().toISOString()
    };
  }

  function load() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(LS);
      state = raw ? JSON.parse(raw) : blank();
    } catch (e) { state = blank(); }
    if (!state.bets) state.bets = [];
    if (typeof state.initial !== 'number') state.initial = 1000;
    return state;
  }

  function save() {
    try { localStorage.setItem(LS, JSON.stringify(state)); } catch (e) {}
    return state;
  }

  function uid() { return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ------------------------------ Opérations ---------------------------- */
  function setInitial(amount) {
    load();
    state.initial = Math.max(1, Number(amount) || 1);
    save();
    return state;
  }

  function setParam(patch) {
    load();
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    save();
    return state;
  }

  /**
   * Ajoute un pari. Le statut peut être 'pending', 'won', 'lost' ou 'push'.
   * Si le statut est déjà réglé (saisie d'un pari passé), le P&L est calculé.
   */
  function addBet(bet) {
    load();
    var stake = Number(bet.stake) || 0;
    var odds = Number(bet.odds) || 0;
    var b = {
      id: uid(),
      createdAt: new Date().toISOString(),
      date: bet.date || new Date().toISOString().slice(0, 10),
      matchId: bet.matchId || null,
      match: bet.match || '—',
      comp: bet.comp || '—',
      market: bet.market || '1X2',
      pick: bet.pick || '1',
      odds: odds,
      stake: stake,
      modelProb: bet.modelProb != null ? Number(bet.modelProb) : null,
      modelFairOdd: bet.modelFairOdd != null ? Number(bet.modelFairOdd) : null,
      confidence: bet.confidence != null ? Number(bet.confidence) : null,
      status: bet.status || 'pending',
      note: bet.note || '',
      pnl: 0
    };
    b.pnl = computePnl(b);
    state.bets.unshift(b);
    save();
    return b;
  }

  function computePnl(b) {
    if (b.status === 'won') return round(b.stake * (b.odds - 1), 2);
    if (b.status === 'lost') return -round(b.stake, 2);
    return 0;                                  // push / en cours
  }

  function settle(id, status) {
    load();
    var b = state.bets.filter(function (x) { return x.id === id; })[0];
    if (!b) return null;
    b.status = status;
    b.settledAt = new Date().toISOString();
    b.pnl = computePnl(b);
    save();
    return b;
  }

  function updateBet(id, patch) {
    load();
    var b = state.bets.filter(function (x) { return x.id === id; })[0];
    if (!b) return null;
    Object.keys(patch).forEach(function (k) { b[k] = patch[k]; });
    b.odds = Number(b.odds) || 0; b.stake = Number(b.stake) || 0;
    b.pnl = computePnl(b);
    save();
    return b;
  }

  function removeBet(id) {
    load();
    state.bets = state.bets.filter(function (x) { return x.id !== id; });
    save();
  }

  function clearAll(keepBankroll) {
    load();
    var init = state.initial;
    state = blank();
    if (keepBankroll) state.initial = init;
    save();
  }

  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /* ------------------------------ Statistiques -------------------------- */
  function stats() {
    load();
    var settled = state.bets.filter(function (b) { return b.status === 'won' || b.status === 'lost' || b.status === 'push'; });
    var pending = state.bets.filter(function (b) { return b.status === 'pending'; });

    var staked = settled.reduce(function (a, b) { return a + (b.status === 'push' ? 0 : b.stake); }, 0);
    var pnl = settled.reduce(function (a, b) { return a + b.pnl; }, 0);
    var won = settled.filter(function (b) { return b.status === 'won'; }).length;
    var lost = settled.filter(function (b) { return b.status === 'lost'; }).length;
    var push = settled.filter(function (b) { return b.status === 'push'; }).length;

    var decided = won + lost;
    var winRate = decided ? won / decided : 0;
    var roi = staked ? pnl / staked : 0;
    var bankroll = state.initial + pnl;
    var pendingStake = pending.reduce(function (a, b) { return a + b.stake; }, 0);

    var oddsSum = settled.reduce(function (a, b) { return a + b.odds; }, 0);
    var avgOdds = settled.length ? oddsSum / settled.length : 0;

    var best = settled.reduce(function (a, b) { return b.pnl > (a ? a.pnl : -1e9) ? b : a; }, null);
    var worst = settled.reduce(function (a, b) { return b.pnl < (a ? a.pnl : 1e9) ? b : a; }, null);

    // Courbe de bankroll + drawdown
    var ordered = settled.slice().sort(function (a, b) {
      return new Date(a.settledAt || a.date) - new Date(b.settledAt || b.date);
    });
    var curve = [{ i: 0, v: state.initial, label: 'Départ' }];
    var run = state.initial, peak = state.initial, maxDD = 0;
    ordered.forEach(function (b, i) {
      run += b.pnl;
      if (run > peak) peak = run;
      var dd = (peak - run) / peak;
      if (dd > maxDD) maxDD = dd;
      curve.push({ i: i + 1, v: round(run, 2), label: b.match });
    });

    // Série en cours (gains/pertes consécutifs)
    var streak = 0, streakType = null;
    for (var i = ordered.length - 1; i >= 0; i--) {
      var t = ordered[i].status === 'won' ? 'won' : 'lost';
      if (ordered[i].status === 'push') continue;
      if (streakType === null) { streakType = t; streak = 1; }
      else if (t === streakType) streak++;
      else break;
    }

    // Répartition par compétition
    var byComp = {};
    settled.forEach(function (b) {
      byComp[b.comp] = byComp[b.comp] || { staked: 0, pnl: 0, n: 0, won: 0 };
      byComp[b.comp].staked += b.status === 'push' ? 0 : b.stake;
      byComp[b.comp].pnl += b.pnl;
      byComp[b.comp].n++;
      if (b.status === 'won') byComp[b.comp].won++;
    });

    var growth = state.initial ? (bankroll - state.initial) / state.initial : 0;

    return {
      bankroll: round(bankroll, 2),
      initial: state.initial,
      pnl: round(pnl, 2),
      staked: round(staked, 2),
      pendingStake: round(pendingStake, 2),
      available: round(bankroll - pendingStake, 2),
      won: won, lost: lost, push: push,
      pending: pending.length,
      winRate: winRate,
      roi: roi,
      yield: roi,
      avgOdds: avgOdds,
      best: best, worst: worst,
      maxDrawdown: maxDD,
      streak: streak, streakType: streakType,
      curve: curve,
      byComp: byComp,
      growth: growth,
      currency: state.currency,
      unit: round(bankroll * (state.unitPct / 100), 2),
      unitPct: state.unitPct,
      kellyFraction: state.kellyFraction
    };
  }

  /** Mise conseillée par Kelly fractionné, plafonnée à 5 % de la bankroll. */
  function suggestedStake(prob, odds) {
    load();
    var st = stats();
    if (!odds || odds <= 1 || !prob) return round(st.bankroll * (state.unitPct / 100), 2);
    var kelly = (prob * odds - 1) / (odds - 1);
    if (kelly <= 0) return round(st.bankroll * (state.unitPct / 100) * 0.5, 2);
    var f = kelly * (state.kellyFraction || 0.5);
    return round(Math.min(st.bankroll * 0.05, st.bankroll * f), 2);
  }

  /* --------------------- Historique de démonstration --------------------- */
  /**
   * Charge un historique d'exemple (clairement identifié comme tel) sur la base
   * de matchs réels du snapshot, afin de visualiser immédiatement les
   * statistiques de bankroll. L'utilisateur peut tout effacer d'un clic.
   */
  function loadDemo(snapshot) {
    load();
    var real = (snapshot.matches || []).filter(function (m) {
      return m.status === 'FT' || m.status === 'AET';
    });
    if (!real.length) return 0;
    var added = 0;
    real.slice(0, 8).forEach(function (m, i) {
      var home = m.hg > m.ag;
      var draw = m.hg === m.ag;
      var pick = home ? '1' : (draw ? 'X' : '2');
      var odds = [1.62, 1.78, 2.05, 1.45, 2.35, 3.10, 1.90, 2.60][i % 8];
      var stake = 25 + (i % 4) * 5;
      var won = i % 3 !== 1;                       // historique varié mais plausible
      state.bets.push({
        id: uid(), createdAt: new Date().toISOString(),
        date: (m.ts || '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        matchId: m.id, match: m.home + ' – ' + m.away, comp: m.comp,
        market: '1X2', pick: pick, odds: odds, stake: stake,
        modelProb: null, modelFairOdd: null, confidence: null,
        status: won ? 'won' : 'lost',
        settledAt: m.ts, note: 'Historique d\'exemple (matchs réels)',
        pnl: 0
      });
      var b = state.bets[state.bets.length - 1];
      b.pnl = computePnl(b);
      added++;
    });
    state.bets.sort(function (a, b) { return new Date(b.settledAt || b.date) - new Date(a.settledAt || a.date); });
    save();
    return added;
  }

  global.ZacoBank = {
    load: load, save: save, stats: stats,
    setInitial: setInitial, setParam: setParam,
    addBet: addBet, settle: settle, updateBet: updateBet, removeBet: removeBet,
    clearAll: clearAll, suggestedStake: suggestedStake, loadDemo: loadDemo
  };
})(window);
