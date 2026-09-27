/* ============================================================================
 * ZACO SPORT ODDS — Rendu de l'interface (templates + helpers)
 * ========================================================================== */
(function (global) {
  'use strict';

  var TZ = 'Europe/Paris';

  /* ------------------------------- Helpers ------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function el(id) { return document.getElementById(id); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function initials(name) {
    var w = String(name || '?').replace(/[^\wÀ-ÿ\s]/g, ' ').split(/\s+/).filter(Boolean);
    return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
  }

  function crestPlaceholder(name, cls) {
    return '<span class="crest-ph ' + (cls || '') + '">' + esc(initials(name)) + '</span>';
  }

  /** Image d'écusson avec repli automatique sur un monogramme. */
  function crest(url, name, cls) {
    if (!url) return crestPlaceholder(name, cls);
    return '<img src="' + esc(url) + '" alt="' + esc(name) + '" class="' + (cls || '') +
      '" loading="lazy" referrerpolicy="no-referrer" onerror="ZacoUI.imgFail(this)">';
  }

  function imgFail(img) {
    var span = document.createElement('span');
    span.className = 'crest-ph ' + (img.className || '');
    span.textContent = initials(img.alt);
    img.parentNode && img.parentNode.replaceChild(span, img);
  }

  function paris(ts, opts) {
    if (!ts) return null;
    var d = new Date(ts);
    if (isNaN(d)) return null;
    try { return d.toLocaleString('fr-FR', Object.assign({ timeZone: TZ }, opts || {})); }
    catch (e) { return d.toLocaleString('fr-FR', opts || {}); }
  }
  function fmtTime(ts) { return paris(ts, { hour: '2-digit', minute: '2-digit' }) || '—'; }
  function fmtDate(ts) {
    return paris(ts, { weekday: 'long', day: 'numeric', month: 'long' }) || '—';
  }
  function fmtDayShort(ts) { return paris(ts, { day: '2-digit', month: '2-digit' }) || '—'; }

  function dayKey(ts) { return ts ? String(ts).slice(0, 10) : 'inconnu'; }

  function dayLabel(ts) {
    var now = new Date();
    var t = new Date(ts);
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var diff = Math.round((b - a) / 86400000);
    if (diff === 0) return 'Aujourd\'hui · ' + fmtDate(ts);
    if (diff === 1) return 'Demain · ' + fmtDate(ts);
    if (diff === -1) return 'Hier · ' + fmtDate(ts);
    return fmtDate(ts);
  }

  var STATUS_LABEL = {
    NS: 'À venir', FT: 'Terminé', AET: 'Terminé (a.p.)', LIVE: 'EN DIRECT',
    PPD: 'Reporté', CANC: 'Annulé'
  };

  function statusBadge(m) {
    if (m.status === 'LIVE') {
      var min = m.minutes != null && m.minutes > 0 ? ' · ' + m.minutes + '\'' : '';
      return '<span class="badge-status"><span class="dot-live" style="width:6px;height:6px;display:inline-block;margin-right:5px"></span>' +
             (m.ht ? 'MI-TEMPS' : 'DIRECT' + min) + '</span>';
    }
    if (m.status === 'NS') return '<span class="badge-status ns">' + fmtTime(m.ts) + '</span>';
    return '<span class="badge-status ft">' + (STATUS_LABEL[m.status] || m.status) + '</span>';
  }

  var PICK_TXT = { '1': '1 (domicile)', X: 'X (nul)', '2': '2 (extérieur)' };
  function pickText(pick, m) {
    if (m) return pick === '1' ? ('Victoire ' + m.home) : pick === 'X' ? 'Match nul' : ('Victoire ' + m.away);
    return PICK_TXT[pick] || pick;
  }
  function pickShort(pick) { return pick === 'X' ? 'Nul' : pick; }
  function pickClass(pick) { return pick === '1' ? 'b1' : pick === 'X' ? 'bx' : 'b2'; }

  function pct(v) { return Math.round((v || 0) * 100) + ' %'; }
  function money(v, cur) {
    var n = Number(v || 0);
    return (n >= 0 ? '' : '-') + Math.abs(n).toFixed(2).replace('.', ',') + ' ' + (cur || '€');
  }

  /* ------------------------------- Écussons ----------------------------- */
  function teamCrest(m, side) {
    var url = side === 'home' ? m.hb : m.ab;
    var name = side === 'home' ? m.home : m.away;
    return crest(url, name);
  }

  /* --------------------------- Bulles « direct » ------------------------ */
  function liveBubble(m, pred) {
    var live = m.status === 'LIVE';
    var sc = (m.hg != null && m.ag != null) ? m.hg + ' <span class="sep">-</span> ' + m.ag : '<span class="sep">VS</span>';
    var conf = pred ? Math.round(pred.confidence * 100) : null;
    return '' +
      '<article class="bubble ' + (live ? 'is-live' : '') + '" data-match="' + esc(m.id) + '" tabindex="0" role="button">' +
        '<div class="bubble__top">' +
          '<span class="bubble__comp">' + esc(m.compLabel || '') + '</span>' + statusBadge(m) +
        '</div>' +
        '<div class="bubble__teams">' +
          '<div class="bubble__team">' + crest(m.hb, m.home) + '<span class="bubble__tname">' + esc(m.home) + '</span></div>' +
          '<div class="bubble__score">' + sc + '</div>' +
          '<div class="bubble__team">' + crest(m.ab, m.away) + '<span class="bubble__tname">' + esc(m.away) + '</span></div>' +
        '</div>' +
        (pred && m.status === 'NS' ?
          '<div class="bubble__foot">' +
            '<span class="mini-tip ' + pickClass(pred.pick) + '">' + esc(pickShort(pred.pick)) + ' · ' + pct(pred.pickProb) + '</span>' +
            '<span class="mini-tip ' + 'b1' + '">cote ' + pred.pickOdds.toFixed(2) + '</span>' +
            '<span class="bubble__conf">confiance ' + conf + ' %</span>' +
          '</div>'
          : '<div class="bubble__foot"><span class="hint">' + esc(fmtTime(m.ts)) + ' · ' + esc(m.compLabel || '') + '</span>' +
            (m.scorers && m.scorers.length ? '<span class="bubble__conf">' + m.scorers.length + ' but(s)</span>' : '') + '</div>') +
      '</article>';
  }

  /* --------------------------- Carte de match --------------------------- */
  function matchCard(m, pred, opts) {
    opts = opts || {};
    var hasScore = m.hg != null && m.ag != null;
    var mid = hasScore ? '<span class="mc__score">' + m.hg + ' – ' + m.ag + '</span>' : '';
    var timeCell = (m.status === 'NS')
      ? '<div><div class="mc__time">' + fmtTime(m.ts) + '</div><div style="font-size:10.5px;color:var(--ink-3);text-align:center">' + fmtDayShort(m.ts) + '</div></div>'
      : '<div class="mc__time ft">' + fmtTime(m.ts) + '</div>';

    var scorers = '';
    if (m.scorers && m.scorers.length && opts.showScorers !== false) {
      scorers = '<div class="scorers"><div class="scorers__t">Buteurs</div><div class="scorers__l">' +
        m.scorers.map(function (s) {
          var side = s[2] === m.homeKey ? 'h' : 'a';
          return '<span class="goal ' + side + '">' + esc(s[0]) + " <b>" + s[1] + "'</b>" + (s[3] ? ' (P)' : '') + '</span>';
        }).join('') + '</div></div>';
    }

    var tip = '';
    if (pred && m.status === 'NS') {
      tip = '<div class="mc__tip">' +
        '<span class="lbl">Pronostic</span>' +
        '<span class="mini-tip ' + pickClass(pred.pick) + '">' + esc(pickShort(pred.pick)) + '</span>' +
        '<span class="val">' + esc(pickText(pred.pick, m)) + '</span>' +
        '<span class="bubble__conf">' + pct(pred.probs[pred.pick]) + ' · conf. ' + Math.round(pred.confidence * 100) + ' %</span>' +
        '</div>' +
        '<div class="bar-mini"><i style="width:' + Math.round(pred.probs[pred.pick] * 100) + '%"></i></div>';
    }

    var result = '';
    if (pred && (m.status === 'FT' || m.status === 'AET')) {
      var real = m.hg > m.ag ? '1' : m.hg === m.ag ? 'X' : '2';
      var ok = pred.pick === real;
      result = '<div class="mc__tip"><span class="lbl">Pronostic du modèle</span>' +
        '<span class="mini-tip ' + pickClass(pred.pick) + '">' + esc(pickShort(pred.pick)) + '</span>' +
        '<span class="hist-tag ' + (ok ? 'won' : 'lost') + '" style="margin-left:auto">' + (ok ? '✓ GAGNÉ' : '✗ PERDU') + '</span></div>';
    }

    return '' +
      '<article class="match-card ' + (m.status === 'LIVE' ? 'is-live' : '') + '" data-match="' + esc(m.id) + '">' +
        '<div class="mc__head">' +
          '<span class="mc__league">' + crest(m.compBadge, m.compLabel, '') + esc(m.compLabel) + '</span>' +
          '<span class="mc__round">' + esc(m.round || '') + '</span>' +
        '</div>' +
        '<div class="mc__row">' +
          '<div class="mc__side">' + teamCrest(m, 'home') + '<span class="mc__name">' + esc(m.home) + '</span></div>' +
          mid + timeCell +
          '<div class="mc__side away">' + teamCrest(m, 'away') + '<span class="mc__name">' + esc(m.away) + '</span></div>' +
        '</div>' +
        '<div class="mc__meta">' +
          (m.venue ? '<span>📍 ' + esc(m.venue) + '</span>' : '') +
          (m.status === 'LIVE' || m.status === 'FT' ? '<span>📊 ' + esc(STATUS_LABEL[m.status] || m.status) + '</span>' : '') +
          (m.source ? '<span>🔗 ' + esc(m.source) + '</span>' : '') +
        '</div>' +
        scorers + tip + result +
        '<div class="mc__actions">' +
          '<button class="btn btn--ghost btn--sm" data-detail="' + esc(m.id) + '">Détails & analyse</button>' +
          (m.status === 'NS' ? '<button class="btn btn--primary btn--sm" data-bet="' + esc(m.id) + '">Parier</button>' : '') +
        '</div>' +
      '</article>';
  }

  /* --------------------------- Carte pronostic -------------------------- */
  function proCard(pred, rank, m) {
    var p = pred.probs;
    var max = Math.max(p['1'], p.X, p['2']);
    function probCell(k, label) {
      return '<div class="prob ' + (k === pred.pick ? 'best' : '') + '">' +
        '<div class="prob__k">' + label + '</div>' +
        '<div class="prob__v">' + Math.round(p[k] * 100) + '%</div>' +
        '<div class="prob__o">cote ' + pred.fairOdds[k].toFixed(2) + '</div></div>';
    }
    var confLabel = pred.confidence > 0.72 ? 'Élevée' : pred.confidence > 0.55 ? 'Moyenne' : pred.confidence > 0.4 ? 'Modérée' : 'Faible';
    var confColor = pred.confidence > 0.72 ? 'green' : pred.confidence > 0.55 ? 'gold' : 'violet';

    var why = 'Force offensive domicile <b>' + pred.lambdaHome.toFixed(2) + '</b> but attendu contre <b>' +
      pred.lambdaAway.toFixed(2) + '</b> pour l\'extérieur. ' +
      'Le consensus des 4 modèles place <b>' + esc(pickText(pred.pick, m)) + '</b> en tête avec ' +
      Math.round(pred.pickProb * 100) + ' % (soit une cote juste de ' + pred.pickOdds.toFixed(2) + '). ' +
      'Score le plus probable : <b>' + pred.scores[0].score + '</b> (' + Math.round(pred.scores[0].p * 100) + ' %). ' +
      'Plus de 2,5 buts : ' + Math.round(pred.over25 * 100) + ' % · Les deux équipes marquent : ' + Math.round(pred.btts * 100) + ' %.';

    return '' +
      '<article class="pro-card" data-match="' + esc(pred.matchId) + '">' +
        '<span class="pro-card__rank">#' + rank + '</span>' +
        '<div class="pro-card__teams">' + esc(pred.home) + ' <span style="color:var(--ink-3)">vs</span> ' + esc(pred.away) + '</div>' +
        '<div class="pro-card__comp">' + esc((m && m.compLabel) || pred.comp) + ' · ' + esc((m && m.round) || '') +
          ' · ' + esc((m && fmtTime(m.ts)) || '') + '</div>' +
        '<div class="verdict ' + pickClass(pred.pick) + '">🎯 ' + esc(pickText(pred.pick, m)) +
          ' <span style="opacity:.75">· ' + Math.round(pred.pickProb * 100) + ' %</span></div>' +
        '<div class="probs">' + probCell('1', 'Domicile') + probCell('X', 'Nul') + probCell('2', 'Extérieur') + '</div>' +
        '<div class="bars">' +
          '<div class="bar-row"><div class="bar-row__top"><span>Confiance du consensus</span><b>' + confLabel + ' · ' + Math.round(pred.confidence * 100) + ' %</b></div>' +
            '<div class="bar g"><i style="width:' + Math.round(pred.confidence * 100) + '%"></i></div></div>' +
          '<div class="bar-row"><div class="bar-row__top"><span>Plus de 2,5 buts</span><b>' + pct(pred.over25) + '</b></div>' +
            '<div class="bar y"><i style="width:' + Math.round(pred.over25 * 100) + '%"></i></div></div>' +
          '<div class="bar-row"><div class="bar-row__top"><span>Les 2 équipes marquent</span><b>' + pct(pred.btts) + '</b></div>' +
            '<div class="bar p"><i style="width:' + Math.round(pred.btts * 100) + '%"></i></div></div>' +
        '</div>' +
        '<div class="pro-card__why">' + why + '</div>' +
        '<div class="pro-card__sources">' +
          '<span class="tag-src">Elo</span><span class="tag-src">Dixon-Coles</span>' +
          '<span class="tag-src">Forme</span><span class="tag-src">Marché</span>' +
          (pred.partialData ? '<span class="tag-src" style="color:var(--gold);border-color:rgba(255,207,63,.35)">données partielles</span>' : '') +
        '</div>' +
        '<div class="kelly">Mise conseillée (demi-Kelly) : <b>' + money(global.ZacoBank.suggestedStake(pred.pickProb, pred.pickOdds)) + '</b>' +
          ' · cote juste <b>' + pred.pickOdds.toFixed(2) + '</b></div>' +
        '<div class="mc__actions">' +
          '<button class="btn btn--primary btn--sm" data-bet="' + esc(pred.matchId) + '">Ajouter au suivi</button>' +
          '<button class="btn btn--ghost btn--sm" data-detail="' + esc(pred.matchId) + '">Analyse complète</button>' +
        '</div>' +
        '<div class="stat-tile__d" style="margin-top:10px">Force ' + confColor + ' · λ dom ' + pred.lambdaHome +
          ' / λ ext ' + pred.lambdaAway + (pred.eloHome ? ' · Elo ' + pred.eloHome + ' vs ' + pred.eloAway : '') + '</div>' +
      '</article>';
  }

  /* ------------------------------- Classement --------------------------- */
  function zoneClass(rank, total) {
    if (rank === 1) return 'champion';
    if (total >= 16) {
      if (rank <= 4) return 'zone-cl';
      if (rank === 5 || rank === 6) return 'zone-el';
      if (rank >= total - 1) return 'zone-rel';
    }
    return '';
  }

  function standingsTable(rows, opts) {
    opts = opts || {};
    var total = rows.length;
    var body = rows.map(function (r, i) {
      var rank = r.rank || i + 1;
      var form = '';
      if (r.form) {
        form = '<span class="form-dots">' + r.form.split('').slice(-5).map(function (c) {
          var k = c === 'W' ? 'w' : c === 'D' ? 'd' : 'l';
          return '<i class="' + k + '">' + (c === 'W' ? 'V' : c === 'D' ? 'N' : 'D') + '</i>';
        }).join('') + '</span>';
      }
      return '<tr class="' + zoneClass(rank, total) + '">' +
        '<td class="t-rank">' + rank + '</td>' +
        '<td><span class="t-team">' + crest(r.b, r.n) + '<span>' + esc(r.n) + '</span></span></td>' +
        '<td class="t-num">' + r.pl + '</td>' +
        '<td class="t-num">' + r.w + '</td>' +
        '<td class="t-num">' + r.d + '</td>' +
        '<td class="t-num">' + r.l + '</td>' +
        '<td class="t-num">' + r.gf + '</td>' +
        '<td class="t-num">' + r.ga + '</td>' +
        '<td class="t-num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td>' +
        '<td class="t-pts">' + r.pts + '</td>' +
        (opts.showForm ? '<td>' + (form || '—') + '</td>' : '') +
      '</tr>';
    }).join('');

    return '<div class="table-wrap"><table class="standings"><thead><tr>' +
      '<th>#</th><th>Équipe</th><th>J</th><th>G</th><th>N</th><th>P</th><th>BP</th><th>BC</th><th>Diff</th><th>Pts</th>' +
      (opts.showForm ? '<th>Forme</th>' : '') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      (opts.legend === false ? '' :
      '<div class="legend">' +
        '<span><i style="background:var(--gold)"></i>Champion / 1er</span>' +
        '<span><i style="background:var(--emerald)"></i>Ligue des Champions</span>' +
        '<span><i style="background:var(--violet)"></i>Europa / Conference League</span>' +
        '<span><i style="background:var(--red)"></i>Zone de relégation</span>' +
      '</div>');
  }

  /* ------------------------ Cartes de compétition ----------------------- */
  function compCard(c, data) {
    var badge = c.badge ? '<img class="comp-card__badge" src="' + esc(c.badge) + '" alt="" onerror="ZacoUI.imgFail(this)">'
                        : '<span class="comp-card__badge ph">' + (c.flag || '⚽') + '</span>';
    return '' +
      '<article class="comp-card" data-comp="' + esc(c.id) + '" style="--c:' + esc(c.accent || '#1ed980') + '">' +
        '<span class="comp-card__stripe"></span>' +
        '<div class="comp-card__head">' + badge +
          '<div><div class="comp-card__name">' + esc(c.name) + '</div>' +
          '<div class="comp-card__meta">' + (c.flag || '') + ' ' + esc(c.country) + ' · ' + esc(c.season) + '</div></div>' +
        '</div>' +
        '<div class="comp-card__stats">' +
          '<div class="comp-card__stat"><b>' + data.total + '</b><span>Matchs</span></div>' +
          '<div class="comp-card__stat"><b>' + data.upcoming + '</b><span>À venir</span></div>' +
          '<div class="comp-card__stat"><b>' + (data.live ? '<span style="color:var(--red)">' + data.live + '</span>' : '0') + '</b><span>Direct</span></div>' +
          '<div class="comp-card__stat"><b>' + data.goals + '</b><span>Buts</span></div>' +
        '</div>' +
        '<div class="stat-tile__d" style="margin-top:10px">Source : ' + esc(c.source) + ' · ' +
          (data.tables ? 'classement ' + (data.completeTable ? 'complet' : 'partiel') : 'pas de classement') + '</div>' +
      '</article>';
  }

  /* ------------------------------ Historique ---------------------------- */
  function histCard(item) {
    var m = item.match, b = item.bet;
    var cls = item.status === 'won' ? 'won' : item.status === 'lost' ? 'lost' : item.status === 'push' ? 'push' : 'pending';
    var label = { won: '✓ GAGNÉ', lost: '✗ PERDU', push: '↺ REMBOURSÉ', pending: '⏳ EN COURS' }[item.status];
    return '' +
      '<article class="hist-card ' + cls + '">' +
        '<div class="hist-card__head">' +
          '<div><div class="hist-card__match">' + esc(item.matchLabel) + '</div>' +
          '<div class="hist-card__meta">' + esc(item.compLabel) + ' · ' + esc(item.dateLabel) + '</div></div>' +
          '<span class="hist-tag ' + cls + '">' + label + '</span>' +
        '</div>' +
        '<div class="hist-card__rows">' +
          '<div class="hist-row"><span>Pronostic</span><b>' + esc(item.pickLabel) + '</b></div>' +
          (item.scoreLabel ? '<div class="hist-row"><span>Score final</span><b>' + esc(item.scoreLabel) + '</b></div>' : '') +
          '<div class="hist-row"><span>Cote</span><b>' + Number(item.odds).toFixed(2) + '</b></div>' +
          '<div class="hist-row"><span>Mise</span><b>' + money(item.stake) + '</b></div>' +
          (item.status !== 'pending'
            ? '<div class="hist-row"><span>Résultat</span><b class="' + (item.pnl >= 0 ? 'pos' : 'neg') + '">' + (item.pnl > 0 ? '+' : '') + money(item.pnl) + '</b></div>'
            : '') +
          (item.confidence != null ? '<div class="hist-row"><span>Confiance modèle</span><b>' + Math.round(item.confidence * 100) + ' %</b></div>' : '') +
          (item.note ? '<div class="hist-row"><span>Note</span><b style="font-weight:600;color:var(--ink-2)">' + esc(item.note) + '</b></div>' : '') +
        '</div>' +
        (item.betId ? '<div class="mc__actions"><button class="btn btn--ghost btn--sm" data-demo-settle="' + esc(item.betId) + '">Modifier le statut</button>' +
          '<button class="btn btn--danger btn--sm" data-bet-del="' + esc(item.betId) + '">Supprimer</button></div>' : '') +
      '</article>';
  }

  /* -------------------------------- Modale ------------------------------ */
  function modalMatch(m, pred) {
    var real = (m.hg != null && m.ag != null) ? (m.hg > m.ag ? '1' : m.hg === m.ag ? 'X' : '2') : null;
    var ok = real && pred ? pred.pick === real : null;

    var html = '' +
      '<div class="modal__head">' +
        '<div><h3>' + esc(m.home) + ' – ' + esc(m.away) + '</h3>' +
        '<div class="sub">' + esc(m.compLabel) + ' · ' + esc(m.round || '') + ' · ' + esc(dayLabel(m.ts)) + ' à ' + fmtTime(m.ts) + '</div></div>' +
      '</div>' +
      '<div class="modal__score">' +
        '<div class="side">' + crest(m.hb, m.home) + '<div class="nm">' + esc(m.home) + '</div></div>' +
        '<div class="num">' + (m.hg != null ? m.hg + ' – ' + m.ag : fmtTime(m.ts)) + '</div>' +
        '<div class="side">' + crest(m.ab, m.away) + '<div class="nm">' + esc(m.away) + '</div></div>' +
      '</div>' +
      '<div class="modal__kv">' +
        '<div class="cell"><i>Statut</i><b>' + (STATUS_LABEL[m.status] || m.status) + '</b></div>' +
        '<div class="cell"><i>Stade</i><b>' + esc(m.venue || '—') + '</b></div>' +
        '<div class="cell"><i>Source</i><b>' + esc(m.source || 'Snapshot') + '</b></div>' +
        '<div class="cell"><i>Compétition</i><b>' + esc(m.compLabel) + '</b></div>' +
      '</div>' +
      (m.note ? '<div class="modal__note">📝 ' + esc(m.note) + '</div>' : '');

    if (m.scorers && m.scorers.length) {
      html += '<div class="scorers" style="margin-bottom:16px"><div class="scorers__t">Buteurs</div><div class="scorers__l">' +
        m.scorers.map(function (s) {
          var side = s[2] === m.homeKey ? 'h' : 'a';
          return '<span class="goal ' + side + '">' + esc(s[0]) + " <b>" + s[1] + "'</b>" + (s[3] ? ' (pen.)' : '') + '</span>';
        }).join('') + '</div></div>';
    }

    if (pred) {
      html += '' +
        '<div class="section__head" style="margin-bottom:10px"><div><div class="card__title">Analyse du consensus ZACO</div>' +
        '<div class="section__sub">4 modèles agrégés · confiance ' + Math.round(pred.confidence * 100) + ' %' +
        (pred.partialData ? ' · <span style="color:var(--gold)">données partielles pour ' + esc(pred.missing.join(', ')) + '</span>' : '') + '</div></div>' +
        (ok !== null ? '<span class="hist-tag ' + (ok ? 'won' : 'lost') + '" style="margin-left:auto">' + (ok ? '✓ Pronostic gagné' : '✗ Pronostic perdu') + '</span>' : '') +
        '</div>' +
        '<div class="probs" style="margin-bottom:14px">' +
          ['1', 'X', '2'].map(function (k) {
            return '<div class="prob ' + (k === pred.pick ? 'best' : '') + '">' +
              '<div class="prob__k">' + (k === '1' ? 'Domicile' : k === 'X' ? 'Nul' : 'Extérieur') + '</div>' +
              '<div class="prob__v">' + Math.round(pred.probs[k] * 100) + '%</div>' +
              '<div class="prob__o">cote juste ' + pred.fairOdds[k].toFixed(2) + '</div></div>';
          }).join('') +
        '</div>' +
        '<div class="card" style="margin-bottom:14px"><div class="card__head"><div class="card__title">Comparaison des 4 modèles</div></div>' +
        '<div class="card__body"><div class="chart-box"><canvas id="modalRadar"></canvas></div></div></div>' +
        '<div class="card" style="margin-bottom:14px"><div class="card__head"><div class="card__title">Scores exacts les plus probables</div></div>' +
        '<div class="card__body"><div class="chart-box"><canvas id="modalScores"></canvas></div></div></div>' +
        '<div class="modal__kv">' +
          '<div class="cell"><i>λ buts domicile</i><b>' + pred.lambdaHome + '</b></div>' +
          '<div class="cell"><i>λ buts extérieur</i><b>' + pred.lambdaAway + '</b></div>' +
          '<div class="cell"><i>Plus de 2,5 buts</i><b>' + pct(pred.over25) + '</b></div>' +
          '<div class="cell"><i>Les 2 marquent</i><b>' + pct(pred.btts) + '</b></div>' +
          '<div class="cell"><i>Double chance 1X</i><b>' + pct(pred.doubleChance['1X']) + '</b></div>' +
          '<div class="cell"><i>Double chance X2</i><b>' + pct(pred.doubleChance.X2) + '</b></div>' +
          (pred.eloHome ? '<div class="cell"><i>Elo domicile</i><b>' + pred.eloHome + '</b></div>' : '') +
          (pred.eloHome ? '<div class="cell"><i>Elo extérieur</i><b>' + pred.eloAway + '</b></div>' : '') +
        '</div>';
      if (m.status === 'NS') {
        html += '<div class="mc__actions" style="margin-top:14px"><button class="btn btn--primary" data-bet="' + esc(m.id) + '">' +
          'Ajouter ce pronostic au suivi</button></div>';
      }
    } else {
      html += '<div class="hint">Aucune analyse disponible pour ce match (données insuffisantes).</div>';
    }

    return html;
  }

  global.ZacoUI = {
    esc: esc, el: el, qsa: qsa, crest: crest, crestPlaceholder: crestPlaceholder, imgFail: imgFail,
    fmtTime: fmtTime, fmtDate: fmtDate, fmtDayShort: fmtDayShort, dayKey: dayKey, dayLabel: dayLabel,
    statusBadge: statusBadge, pickText: pickText, pickShort: pickShort, pickClass: pickClass,
    pct: pct, money: money, initials: initials, STATUS_LABEL: STATUS_LABEL,
    liveBubble: liveBubble, matchCard: matchCard, proCard: proCard,
    standingsTable: standingsTable, compCard: compCard, histCard: histCard, modalMatch: modalMatch
  };
})(window);
