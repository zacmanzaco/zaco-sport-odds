/* ============================================================================
 * ZACO SPORT ODDS — Jeu de données RÉELLES (snapshot)
 * ----------------------------------------------------------------------------
 * Toutes les données de ce fichier proviennent de sources publiques réelles,
 * récupérées le 27/09/2026 :
 *
 *   • OpenLigaDB  (https://api.openligadb.de)          — API libre, sans clé,
 *     Bundesliga 1/2, résultats, buteurs, classements, calendrier complet.
 *   • TheSportsDB (https://www.thesportsdb.com/api)    — API gratuite, clé de
 *     test publique « 3 ». Premier League, LaLiga, Serie A, Ligue 1, UEFA
 *     Champions League, MLS, USL Championship, Coupe du Monde FIFA.
 *   • Wikipédia    (https://en.wikipedia.org)          — vérification des
 *     effectifs / stades des championnats.
 *
 * Ce snapshot sert de « cache de démarrage » : l'application interroge ensuite
 * les mêmes API en direct depuis le navigateur (voir js/api.js) et remplace
 * les données dès qu'une réponse réseau est disponible.
 * ========================================================================== */
(function () {
  'use strict';

  /* --- Écussons des clubs (URLs officielles renvoyées par les API) --------- */
  var TEAM_BADGES = {
    // Bundesliga (OpenLigaDB)
    '125':  null, // placeholder volontairement absent (voir helper badge())
    'bayern': 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Logo_FC_Bayern_M%C3%BCnchen_%282002%E2%80%932017%29.svg',
    'dortmund': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/960px-Borussia_Dortmund_logo.svg.png',
    'leipzig': 'https://i.imgur.com/Rpwsjz1.png',
    'stuttgart': 'https://i.imgur.com/v0tkpNx.png',
    'hoffenheim': 'https://i.imgur.com/gF0PfEl.png',
    'leverkusen': 'https://www.bundesliga-reisefuehrer.de/sites/default/files/B04_Standard_Logo_RGB.png',
    'freiburg': 'https://i.imgur.com/r3mvi0h.png',
    'frankfurt': 'https://i.imgur.com/X8NFkOb.png',
    'augsburg': 'https://i.imgur.com/sdE62e2.png',
    'mainz': 'https://upload.wikimedia.org/wikipedia/commons/9/9e/Logo_Mainz_05.svg',
    'union': 'https://assets.dfb.de/uploads/000/018/232/small_union-Berlin.jpg',
    'gladbach': 'https://i.imgur.com/KSIk0Eu.png',
    'hsv': 'https://upload.wikimedia.org/wikipedia/commons/f/f7/Hamburger_SV_logo.svg',
    'koeln': 'https://upload.wikimedia.org/wikipedia/commons/0/01/1._FC_Koeln_Logo_2014%E2%80%93.svg',
    'wolfsburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/VfL_Wolfsburg_logo_2026.svg/960px-VfL_Wolfsburg_logo_2026.svg.png',
    'heidenheim': 'https://upload.wikimedia.org/wikipedia/commons/9/9d/1._FC_Heidenheim_1846.svg',
    'stpauli': 'https://upload.wikimedia.org/wikipedia/commons/b/b3/Fc_st_pauli_logo.svg',
    'elversberg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/SV_Elversberg_Logo.svg/500px-SV_Elversberg_Logo.svg.png',
    'schalke': 'https://upload.wikimedia.org/wikipedia/commons/9/97/FC_Schalke_04_Logo.png',
    'paderborn': 'https://upload.wikimedia.org/wikipedia/commons/e/e3/SC_Paderborn_07_Logo.svg',
    // Premier League (TheSportsDB)
    'man city': 'https://r2.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
    'arsenal': 'https://r2.thesportsdb.com/images/media/team/badge/uyhbfe1612467038.png',
    'brighton': 'https://r2.thesportsdb.com/images/media/team/badge/ywypts1448810904.png',
    'brentford': 'https://r2.thesportsdb.com/images/media/team/badge/grv1aw1546453779.png',
    'leeds': 'https://r2.thesportsdb.com/images/media/team/badge/jcgrml1756649030.png',
    'man united': 'https://r2.thesportsdb.com/images/media/team/badge/xzqdr11517660252.png',
    'aston villa': 'https://r2.thesportsdb.com/images/media/team/badge/jykrpv1717309891.png',
    'liverpool': 'https://r2.thesportsdb.com/images/media/team/badge/kfaher1737969724.png',
    'fulham': 'https://r2.thesportsdb.com/images/media/team/badge/xwwvyt1448811086.png',
    // LaLiga
    'barcelona': 'https://r2.thesportsdb.com/images/media/team/badge/wq9sir1639406443.png',
    'real madrid': 'https://r2.thesportsdb.com/images/media/team/badge/vvwvwr1473502969.png',
    'villarreal': 'https://r2.thesportsdb.com/images/media/team/badge/vrypqy1473503073.png',
    'atletico': 'https://r2.thesportsdb.com/images/media/team/badge/0ulh3q1719984315.png',
    'betis': 'https://r2.thesportsdb.com/images/media/team/badge/2oqulv1663245386.png',
    'valencia': 'https://r2.thesportsdb.com/images/media/team/badge/dm8l6o1655594864.png',
    'real sociedad': 'https://r2.thesportsdb.com/images/media/team/badge/vptvpr1473502986.png',
    'malaga': 'https://r2.thesportsdb.com/images/media/team/badge/upqyvr1473502952.png',
    'espanyol': 'https://r2.thesportsdb.com/images/media/team/badge/867nzz1681703222.png',
    // Serie A
    'ac milan': 'https://r2.thesportsdb.com/images/media/team/badge/wvspur1448806617.png',
    'lecce': 'https://r2.thesportsdb.com/images/media/team/badge/j4vznr1567365249.png',
    'genoa': 'https://r2.thesportsdb.com/images/media/team/badge/52s8dn1655553600.png',
    'fiorentina': 'https://r2.thesportsdb.com/images/media/team/badge/hc8nhu1656098030.png',
    'como': 'https://r2.thesportsdb.com/images/media/team/badge/02x81t1627405841.png',
    // Ligue 1
    'psg': 'https://r2.thesportsdb.com/images/media/team/badge/rwqrrq1473504808.png',
    'lens': 'https://r2.thesportsdb.com/images/media/team/badge/3pxoum1598797195.png',
    'lille': 'https://r2.thesportsdb.com/images/media/team/badge/2giize1534005340.png',
    'lyon': 'https://r2.thesportsdb.com/images/media/team/badge/blk9771656932845.png',
    'marseille': 'https://r2.thesportsdb.com/images/media/team/badge/c6bazh1779212287.png',
    // Europe / MLS / USL
    'sporting cp': 'https://r2.thesportsdb.com/images/media/team/badge/5hiuk71783137875.png',
    'columbus crew': 'https://r2.thesportsdb.com/images/media/team/badge/dzs8cp1629059854.png',
    'inter miami': 'https://r2.thesportsdb.com/images/media/team/badge/m4it3e1602103647.png',
    'monterey bay': 'https://r2.thesportsdb.com/images/media/team/badge/4wca4f1736267704.png',
    'lexington': 'https://r2.thesportsdb.com/images/media/team/badge/whrnkt1674118711.png',
    'new mexico': 'https://r2.thesportsdb.com/images/media/team/badge/bhydtp1690267200.png',
    'sacramento': 'https://r2.thesportsdb.com/images/media/team/badge/qlxpys1706283543.png',
    'oakland roots': 'https://r2.thesportsdb.com/images/media/team/badge/vzzkkj1616767958.png',
    'phoenix rising': 'https://r2.thesportsdb.com/images/media/team/badge/lanpqo1690267344.png',
    // Sélections
    'spain': 'https://r2.thesportsdb.com/images/media/team/badge/ncgqyr1726166942.png',
    'argentina': 'https://r2.thesportsdb.com/images/media/team/badge/3zplhu1726167477.png'
  };

  function badge(key) { return TEAM_BADGES[key] || null; }

  /* --- Compétitions ------------------------------------------------------ */
  var competitions = [
    { id: 'bl1', name: 'Bundesliga', full: '1. Fußball-Bundesliga', country: 'Allemagne', flag: '🇩🇪',
      type: 'Championnat', season: '2026/2027', live: true,
      badge: null, accent: '#d20515', source: 'OpenLigaDB' },
    { id: 'bl2', name: '2. Bundesliga', full: '2. Fußball-Bundesliga', country: 'Allemagne', flag: '🇩🇪',
      type: 'Championnat', season: '2026/2027', live: true,
      badge: null, accent: '#7c4dff', source: 'OpenLigaDB' },
    { id: 'pl', name: 'Premier League', full: 'English Premier League', country: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      type: 'Championnat', season: '2026/2027', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png', accent: '#3d195b', source: 'TheSportsDB' },
    { id: 'laliga', name: 'LaLiga', full: 'Spanish La Liga', country: 'Espagne', flag: '🇪🇸',
      type: 'Championnat', season: '2026/2027', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/ja4it51687628717.png', accent: '#ee8707', source: 'TheSportsDB' },
    { id: 'seriea', name: 'Serie A', full: 'Italian Serie A', country: 'Italie', flag: '🇮🇹',
      type: 'Championnat', season: '2026/2027', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/67q3q21679951383.png', accent: '#008fd7', source: 'TheSportsDB' },
    { id: 'ligue1', name: 'Ligue 1', full: 'French Ligue 1', country: 'France', flag: '🇫🇷',
      type: 'Championnat', season: '2026/2027', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/9f7z9d1742983155.png', accent: '#091c3e', source: 'TheSportsDB' },
    { id: 'ucl', name: 'Ligue des Champions', full: 'UEFA Champions League', country: 'Europe', flag: '🇪🇺',
      type: 'Coupe', season: '2026/2027', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/facv1u1742998896.png', accent: '#0b1b6b', source: 'TheSportsDB' },
    { id: 'mls', name: 'Major League Soccer', full: 'American Major League Soccer', country: 'États-Unis', flag: '🇺🇸',
      type: 'Championnat', season: '2026', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/dqo6r91549878326.png', accent: '#1c2c5b', source: 'TheSportsDB' },
    { id: 'usl', name: 'USL Championship', full: 'American USL Championship', country: 'États-Unis', flag: '🇺🇸',
      type: 'Championnat', season: '2026', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/uh4zas1688513782.png', accent: '#0d5c3f', source: 'TheSportsDB' },
    { id: 'wc', name: 'Coupe du Monde', full: 'FIFA World Cup 2026', country: 'International', flag: '🏆',
      type: 'Compétition internationale', season: '2026', live: false,
      badge: 'https://r2.thesportsdb.com/images/media/league/badge/e7er5g1696521789.png', accent: '#c9a227', source: 'TheSportsDB' }
  ];

  /* --- Matchs (structure normalisée) -------------------------------------
   * ts     : coup d'envoi en UTC (ISO 8601)
   * status : 'NS' (à venir) · 'FT' (terminé) · 'AET' (terminé a.p.) · 'LIVE'
   * hg/ag  : buts domicile / extérieur
   * --------------------------------------------------------------------- */
  var M = [];
  function match(o) { M.push(o); }

  /* ===== BUNDESLIGA 2026/2027 — journées 4 à 7 (OpenLigaDB) ============= */
  // Journée 4 — résultats réels (18-19 sept. 2026)
  match({ id: 'ol-83183', comp: 'bl1', round: '4e journée', ts: '2026-09-18T18:30:00Z', status: 'FT',
    venue: 'Allianz Arena, Munich', homeId: 'bayern', home: 'FC Bayern München',
    awayId: 'union', away: '1. FC Union Berlin', hg: 7, ag: 0,
    scorers: [['J. Musiala', 18, 'bayern'], ['H. Kane', 39, 'bayern', true], ['M. Olise', 43, 'bayern'],
              ['H. Kane', 54, 'bayern'], ['I. Saibari', 70, 'bayern'], ['M. Olise', 73, 'bayern'], ['M. Olise', 76, 'bayern']] });
  match({ id: 'ol-83186', comp: 'bl1', round: '4e journée', ts: '2026-09-19T13:30:00Z', status: 'FT',
    venue: 'Deutsche Bank Park, Francfort', homeId: 'frankfurt', home: 'Eintracht Frankfurt',
    awayId: 'freiburg', away: 'SC Freiburg', hg: 2, ag: 2,
    scorers: [['Y. Ebnoutalib', 10, 'frankfurt'], ['D. Scherhant', 34, 'freiburg'],
              ['J. Burkardt', 36, 'frankfurt'], ['Y. Suzuki', 48, 'freiburg']] });
  match({ id: 'ol-83187', comp: 'bl1', round: '4e journée', ts: '2026-09-19T13:30:00Z', status: 'FT',
    venue: 'Borussia-Park, Mönchengladbach', homeId: 'gladbach', home: 'Borussia Mönchengladbach',
    awayId: 'mainz', away: '1. FSV Mainz 05', hg: 3, ag: 4,
    scorers: [['F. Neuhaus', 11, 'gladbach'], ['P. Tietz', 18, 'mainz'], ['S. Becker', 46, 'mainz'],
              ['I. Lidberg', 59, 'gladbach'], ['E. Martel', 78, 'mainz'], ['D. da Costa', 89, 'mainz'],
              ['S. Machino', 95, 'gladbach', true]] });

  // Journée 5 — à venir (9-11 oct. 2026)
  var J5 = [
    ['83192', '2026-10-09T18:30:00Z', 'dortmund', 'Borussia Dortmund', 'bremen', 'SV Werder Bremen', 'Signal Iduna Park, Dortmund'],
    ['83194', '2026-10-10T13:30:00Z', 'hoffenheim', 'TSG Hoffenheim', 'hsv', 'Hamburger SV', 'PreZero Arena, Sinsheim'],
    ['83196', '2026-10-10T13:30:00Z', 'augsburg', 'FC Augsburg', 'bayern', 'FC Bayern München', 'WWK Arena, Augsbourg'],
    ['83197', '2026-10-10T13:30:00Z', 'mainz', '1. FSV Mainz 05', 'leverkusen', 'Bayer 04 Leverkusen', 'Mewa Arena, Mayence'],
    ['83198', '2026-10-10T13:30:00Z', 'union', '1. FC Union Berlin', 'elversberg', 'SV 07 Elversberg', 'An der Alten Försterei, Berlin'],
    ['83200', '2026-10-10T13:30:00Z', 'paderborn', 'SC Paderborn 07', 'stuttgart', 'VfB Stuttgart', 'Home Deluxe Arena, Paderborn'],
    ['83193', '2026-10-10T16:30:00Z', 'leipzig', 'RB Leipzig', 'frankfurt', 'Eintracht Frankfurt', 'Red Bull Arena, Leipzig'],
    ['83199', '2026-10-11T13:30:00Z', 'koeln', '1. FC Köln', 'gladbach', 'Borussia Mönchengladbach', 'RheinEnergieStadion, Cologne'],
    ['83195', '2026-10-11T15:30:00Z', 'freiburg', 'SC Freiburg', 'schalke', 'FC Schalke 04', 'Europa-Park Stadion, Fribourg']
  ];
  var J6 = [
    ['83203', '2026-10-16T18:30:00Z', 'frankfurt', 'Eintracht Frankfurt', 'koeln', '1. FC Köln', 'Deutsche Bank Park, Francfort'],
    ['83204', '2026-10-17T13:30:00Z', 'union', '1. FC Union Berlin', 'dortmund', 'Borussia Dortmund', 'An der Alten Försterei, Berlin'],
    ['83206', '2026-10-17T13:30:00Z', 'hsv', 'Hamburger SV', 'stuttgart', 'VfB Stuttgart', 'Volksparkstadion, Hambourg'],
    ['83207', '2026-10-17T13:30:00Z', 'bremen', 'SV Werder Bremen', 'paderborn', 'SC Paderborn 07', 'Weserstadion, Brême'],
    ['83208', '2026-10-17T13:30:00Z', 'schalke', 'FC Schalke 04', 'mainz', '1. FSV Mainz 05', 'Veltins-Arena, Gelsenkirchen'],
    ['83209', '2026-10-17T13:30:00Z', 'elversberg', 'SV 07 Elversberg', 'augsburg', 'FC Augsburg', 'Ursapharm-Arena, Elversberg'],
    ['83201', '2026-10-17T16:30:00Z', 'bayern', 'FC Bayern München', 'leipzig', 'RB Leipzig', 'Allianz Arena, Munich'],
    ['83202', '2026-10-18T13:30:00Z', 'leverkusen', 'Bayer 04 Leverkusen', 'freiburg', 'SC Freiburg', 'BayArena, Leverkusen'],
    ['83205', '2026-10-18T15:30:00Z', 'gladbach', 'Borussia Mönchengladbach', 'hoffenheim', 'TSG Hoffenheim', 'Borussia-Park, Mönchengladbach']
  ];
  var J7 = [
    ['83212', '2026-10-23T18:30:00Z', 'stuttgart', 'VfB Stuttgart', 'gladbach', 'Borussia Mönchengladbach', 'MHPArena, Stuttgart'],
    ['83211', '2026-10-24T13:30:00Z', 'leipzig', 'RB Leipzig', 'elversberg', 'SV 07 Elversberg', 'Red Bull Arena, Leipzig'],
    ['83215', '2026-10-24T13:30:00Z', 'augsburg', 'FC Augsburg', 'union', '1. FC Union Berlin', 'WWK Arena, Augsbourg'],
    ['83216', '2026-10-24T13:30:00Z', 'mainz', '1. FSV Mainz 05', 'bremen', 'SV Werder Bremen', 'Mewa Arena, Mayence'],
    ['83217', '2026-10-24T13:30:00Z', 'koeln', '1. FC Köln', 'schalke', 'FC Schalke 04', 'RheinEnergieStadion, Cologne'],
    ['83218', '2026-10-24T13:30:00Z', 'paderborn', 'SC Paderborn 07', 'hsv', 'Hamburger SV', 'Home Deluxe Arena, Paderborn'],
    ['83210', '2026-10-24T16:30:00Z', 'dortmund', 'Borussia Dortmund', 'frankfurt', 'Eintracht Frankfurt', 'Signal Iduna Park, Dortmund'],
    ['83213', '2026-10-25T14:30:00Z', 'hoffenheim', 'TSG Hoffenheim', 'leverkusen', 'Bayer 04 Leverkusen', 'PreZero Arena, Sinsheim'],
    ['83214', '2026-10-25T16:30:00Z', 'freiburg', 'SC Freiburg', 'bayern', 'FC Bayern München', 'Europa-Park Stadion, Fribourg']
  ];
  [['5e journée', J5], ['6e journée', J6], ['7e journée', J7]].forEach(function (pair) {
    pair[1].forEach(function (r) {
      match({ id: 'ol-' + r[0], comp: 'bl1', round: pair[0], ts: r[1], status: 'NS', venue: r[6],
        homeId: r[2], home: r[3], awayId: r[4], away: r[5], hg: null, ag: null });
    });
  });

  /* ===== 2. BUNDESLIGA 2026/2027 — journées 6 (résultats) & 7 (OpenLigaDB) */
  // Journée 6 — résultats réels (18-20 sept. 2026), buteurs inclus
  var BL2_J6 = [
    ['83591', '2026-09-18T16:30:00Z', 'wolfsburg', 'VfL Wolfsburg', 'darmstadt', 'SV Darmstadt 98',
      'Volkswagen Arena, Wolfsbourg', 5, 1, [['A. Bernhardsson', 14], ['R. Glatzel', 40],
      ['A. Bernhardsson', 61], ['M. Damar', 67], ['R. Glatzel', 79]],
      [['Milan Smit', 29]]],
    ['83606', '2026-09-18T16:30:00Z', 'fuerth', 'SpVgg Greuther Fürth', 'magdeburg', '1. FC Magdeburg',
      'Sportpark Ronhof, Fürth', 1, 1, [['Omar Sillah', 20]], [['E. Iyoha', 5]]],
    ['83595', '2026-09-19T11:00:00Z', 'kaiserslautern', '1. FC Kaiserslautern', 'braunschweig', 'Eintracht Braunschweig',
      'Fritz-Walter-Stadion, Kaiserslautern', 1, 0, [['Erencan Yardimci', 73]], []],
    ['83597', '2026-09-19T11:00:00Z', 'karlsruhe', 'Karlsruher SC', 'nuernberg', '1. FC Nürnberg',
      'Wildparkstadion, Karlsruhe', 0, 1, [], [['Mohamed Alì Zoma', 30]]],
    ['83600', '2026-09-19T11:00:00Z', 'kiel', 'Holstein Kiel', 'osnabrueck', 'VfL Osnabrück',
      'Holstein-Stadion, Kiel', 1, 1, [['Phil Harres', 45, true]], [['Hiroki Sekine', 72]]],
    ['83598', '2026-09-19T18:30:00Z', 'dresden', 'Dynamo Dresden', 'hertha', 'Hertha BSC',
      'Rudolf-Harbig-Stadion, Dresde', 1, 2, [['Patrice Covic', 10]],
      [['Jón Dagur Thorsteinsson', 29], ['Jón Dagur Thorsteinsson', 80]]],
    ['83593', '2026-09-20T11:30:00Z', 'hannover', 'Hannover 96', 'bochum', 'VfL Bochum',
      'Heinz von Heiden Arena, Hanovre', 2, 1, [['S. Teitur Thórdarson', 24], ['M. Hartel', 43]],
      [['T. Meyer', 77]]],
    ['83604', '2026-09-20T11:30:00Z', 'bielefeld', 'DSC Arminia Bielefeld', 'heidenheim', '1. FC Heidenheim 1846',
      'SchücoArena, Bielefeld', 2, 2, [['Joel Grodowski', 13], ['Felix Hagmann', 55]],
      [['B. Zivzivadze', 30, true], ['P. Hennrich', 48]]],
    ['83607', '2026-09-20T11:30:00Z', 'cottbus', 'Energie Cottbus', 'stpauli', 'FC St. Pauli',
      'Stadion der Freundschaft, Cottbus', 1, 1, [['J. Butler', 37]], [['M. Kaars', 80]]]
  ];
  BL2_J6.forEach(function (r) {
    var scorers = r[9].map(function (g) { return [g[0], g[1], r[2]].concat(g[2] ? [true] : []); })
      .concat(r[10].map(function (g) { return [g[0], g[1], r[4]].concat(g[2] ? [true] : []); }));
    match({ id: 'ol-' + r[0], comp: 'bl2', round: '6e journée', ts: r[1], status: 'FT', venue: r[6],
      homeId: r[2], home: r[3], awayId: r[4], away: r[5], hg: r[7], ag: r[8],
      scorers: scorers.length ? scorers : null });
  });

  // Journée 7 — à venir (9-11 oct. 2026)
  var BL2_J7 = [
    ['83609', '2026-10-09T16:30:00Z', 'heidenheim', '1. FC Heidenheim 1846', 'kaiserslautern', '1. FC Kaiserslautern', 'Voith-Arena, Heidenheim'],
    ['83620', '2026-10-09T16:30:00Z', 'braunschweig', 'Eintracht Braunschweig', 'kiel', 'Holstein Kiel', 'Eintracht-Stadion, Brunswick'],
    ['83611', '2026-10-10T11:00:00Z', 'darmstadt', 'SV Darmstadt 98', 'cottbus', 'Energie Cottbus', 'Merck-Stadion am Böllenfalltor, Darmstadt'],
    ['83617', '2026-10-10T11:00:00Z', 'magdeburg', '1. FC Magdeburg', 'hannover', 'Hannover 96', 'Avnet Arena, Magdebourg'],
    ['83622', '2026-10-10T11:00:00Z', 'osnabrueck', 'VfL Osnabrück', 'dresden', 'Dynamo Dresden', 'Bremer Brücke, Osnabrück'],
    ['83615', '2026-10-10T18:30:00Z', 'nuernberg', '1. FC Nürnberg', 'wolfsburg', 'VfL Wolfsburg', 'Max-Morlock-Stadion, Nuremberg'],
    ['83608', '2026-10-11T11:30:00Z', 'stpauli', 'FC St. Pauli', 'karlsruhe', 'Karlsruher SC', 'Millerntor-Stadion, Hambourg'],
    ['83613', '2026-10-11T11:30:00Z', 'hertha', 'Hertha BSC', 'fuerth', 'SpVgg Greuther Fürth', 'Olympiastadion, Berlin'],
    ['83616', '2026-10-11T11:30:00Z', 'bochum', 'VfL Bochum', 'bielefeld', 'DSC Arminia Bielefeld', 'Vonovia Ruhrstadion, Bochum']
  ];
  BL2_J7.forEach(function (r) {
    match({ id: 'ol-' + r[0], comp: 'bl2', round: '7e journée', ts: r[1], status: 'NS', venue: r[6],
      homeId: r[2], home: r[3], awayId: r[4], away: r[5], hg: null, ag: null });
  });

  /* ===== Autres championnats — matchs réels (TheSportsDB) ================ */
  match({ id: 'ts-2506231', comp: 'laliga', round: '7e journée', ts: '2026-09-20T19:00:00Z', status: 'FT',
    venue: 'Estadio de Mestalla, Valence', homeId: 'valencia', home: 'Valencia',
    awayId: 'real sociedad', away: 'Real Sociedad', hg: 2, ag: 3 });
  match({ id: 'ts-2506240', comp: 'laliga', round: '8e journée', ts: '2026-10-09T19:00:00Z', status: 'NS',
    venue: 'Estadio La Rosaleda, Málaga', homeId: 'malaga', home: 'Málaga',
    awayId: 'espanyol', away: 'Espanyol', hg: null, ag: null });

  match({ id: 'ts-2494042', comp: 'pl', round: '5e journée', ts: '2026-09-20T15:30:00Z', status: 'FT',
    venue: 'Craven Cottage, Londres', homeId: 'fulham', home: 'Fulham',
    awayId: 'man united', away: 'Manchester United', hg: 1, ag: 1 });
  match({ id: 'ts-2494052', comp: 'pl', round: '6e journée', ts: '2026-10-10T11:30:00Z', status: 'NS',
    venue: 'Emirates Stadium, Londres', homeId: 'arsenal', home: 'Arsenal',
    awayId: 'leeds', away: 'Leeds United', hg: null, ag: null });

  match({ id: 'ts-2482178', comp: 'seriea', round: '5e journée', ts: '2026-09-20T18:45:00Z', status: 'FT',
    venue: 'Stadio Giuseppe Meazza, Milan', homeId: 'ac milan', home: 'AC Milan',
    awayId: 'lecce', away: 'Lecce', hg: 3, ag: 0 });
  match({ id: 'ts-2482192', comp: 'seriea', round: '6e journée', ts: '2026-10-10T13:00:00Z', status: 'NS',
    venue: 'Stadio Luigi Ferraris, Gênes', homeId: 'genoa', home: 'Genoa',
    awayId: 'fiorentina', away: 'Fiorentina', hg: null, ag: null });

  match({ id: 'ts-2489515', comp: 'ligue1', round: '6e journée', ts: '2026-10-09T18:45:00Z', status: 'NS',
    venue: 'Stade Bollaert-Delelis, Lens', homeId: 'lens', home: 'Lens',
    awayId: 'lyon', away: 'Lyon', hg: null, ag: null });

  match({ id: 'ts-2594669', comp: 'ucl', round: 'Phase de ligue · J1', ts: '2026-09-10T19:00:00Z', status: 'FT',
    venue: 'Stadio Giuseppe Sinigaglia, Côme', homeId: 'como', home: 'Como',
    awayId: 'leipzig', away: 'RB Leipzig', hg: 4, ag: 1 });
  match({ id: 'ts-2594564', comp: 'ucl', round: 'Phase de ligue · J2', ts: '2026-10-13T16:45:00Z', status: 'NS',
    venue: 'Stade Bollaert-Delelis, Lens', homeId: 'lens', home: 'Lens',
    awayId: 'sporting cp', away: 'Sporting CP', hg: null, ag: null });

  match({ id: 'ts-2407112', comp: 'mls', round: '27e journée', ts: '2026-09-27T23:00:00Z', status: 'NS',
    venue: 'ScottsMiracle-Gro Field, Columbus', homeId: 'columbus crew', home: 'Columbus Crew',
    awayId: 'inter miami', away: 'Inter Miami', hg: null, ag: null });

  /* Matchs déjà joués le jour du snapshot (USL Championship) */
  match({ id: 'ts-2397346', comp: 'usl', round: 'Saison régulière', ts: '2026-09-27T02:00:00Z', status: 'FT',
    venue: 'Cardinale Stadium, Seaside', homeId: 'monterey bay', home: 'Monterey Bay FC',
    awayId: 'lexington', away: 'Lexington SC', hg: 2, ag: 3 });
  match({ id: 'ts-2397347', comp: 'usl', round: 'Saison régulière', ts: '2026-09-27T01:00:00Z', status: 'FT',
    venue: 'Isotopes Park, Albuquerque', homeId: 'new mexico', home: 'New Mexico United',
    awayId: 'sacramento', away: 'Sacramento Republic', hg: 2, ag: 3 });
  match({ id: 'ts-2397348', comp: 'usl', round: 'Saison régulière', ts: '2026-09-27T02:00:00Z', status: 'FT',
    venue: 'Oakland Coliseum, Oakland', homeId: 'oakland roots', home: 'Oakland Roots',
    awayId: 'phoenix rising', away: 'Phoenix Rising', hg: 3, ag: 0 });

  /* ===== Coupe du Monde FIFA 2026 — finale réelle ======================= */
  match({ id: 'ts-2533361', comp: 'wc', round: 'Finale', ts: '2026-07-19T19:00:00Z', status: 'AET',
    venue: 'MetLife Stadium, East Rutherford (80 663 spect.)', homeId: 'spain', home: 'Espagne',
    awayId: 'argentina', away: 'Argentine', hg: 1, ag: 0,
    scorers: [['Ferran Torres', 106, 'spain']],
    note: 'L\'Espagne décroche sa 2e étoile. Ferran Torres, entré en jeu, marque à la 106e minute de la prolongation. ' +
          'L\'Argentine termine à 10 après l\'exclusion d\'Enzo Fernández (2e jaune, 90+).' });

  /* --- Classements ------------------------------------------------------ */
  /* R(id, nom, joués, gagnés, nuls, perdus, buts pour, buts contre, points, forme, note) */
  function R(id, n, pl, w, d, l, gf, ga, pts, form, note) {
    return { id: id, n: n, b: badge(id), pl: pl, w: w, d: d, l: l, gf: gf, ga: ga,
             gd: gf - ga, pts: pts, form: form || null, note: note || null };
  }

  var tables = [
    /* ===================================================================
     * BUNDESLIGA 1 — OpenLigaDB, classements COMPLETS (aucune limite d'API)
     * =================================================================== */
    { comp: 'bl1', season: '2026/2027', label: 'Bundesliga · saison en cours (après 4 journées)',
      updated: '2026-09-24', complete: true, live: true, rows: [
      R('dortmund', 'Borussia Dortmund', 4, 4, 0, 0, 9, 2, 12, null, 'Champions League'),
      R('bayern', 'FC Bayern München', 4, 3, 1, 0, 14, 2, 10, null, 'Champions League'),
      R('freiburg', 'SC Freiburg', 4, 3, 1, 0, 12, 3, 10, null, 'Champions League'),
      R('augsburg', 'FC Augsburg', 4, 2, 1, 1, 11, 6, 7, null, 'Champions League'),
      R('leverkusen', 'Bayer 04 Leverkusen', 4, 2, 1, 1, 10, 5, 7, null, 'Europa League'),
      R('mainz', '1. FSV Mainz 05', 4, 2, 1, 1, 10, 6, 7, null, 'Conference League'),
      R('elversberg', 'SV 07 Elversberg', 4, 2, 1, 1, 8, 7, 7, null, null),
      R('bremen', 'SV Werder Bremen', 4, 2, 1, 1, 8, 8, 7, null, null),
      R('leipzig', 'RB Leipzig', 4, 2, 0, 2, 9, 5, 6, null, null),
      R('frankfurt', 'Eintracht Frankfurt', 4, 1, 2, 1, 9, 10, 5, null, null),
      R('schalke', 'FC Schalke 04', 4, 1, 2, 1, 3, 4, 5, null, null),
      R('paderborn', 'SC Paderborn 07', 4, 1, 1, 2, 3, 5, 4, null, null),
      R('koeln', '1. FC Köln', 4, 1, 1, 2, 6, 9, 4, null, null),
      R('hoffenheim', 'TSG Hoffenheim', 4, 1, 0, 3, 7, 10, 3, null, null),
      R('stuttgart', 'VfB Stuttgart', 4, 1, 0, 3, 6, 9, 3, null, null),
      R('hsv', 'Hamburger SV', 4, 1, 0, 3, 2, 13, 3, null, null),
      R('union', '1. FC Union Berlin', 4, 0, 1, 3, 4, 17, 1, null, null),
      R('gladbach', 'Borussia Mönchengladbach', 4, 0, 0, 4, 6, 16, 0, null, 'Barrage de relégation')
    ] },

    { comp: 'bl1', season: '2025/2026', label: 'Bundesliga · classement final 2025/2026 (18 équipes)',
      updated: '2026-05-16', complete: true, historical: true, rows: [
      R('bayern', 'FC Bayern München', 34, 28, 5, 1, 122, 36, 89, null, 'Champion'),
      R('dortmund', 'Borussia Dortmund', 34, 22, 7, 5, 70, 34, 73, null, 'Champions League'),
      R('leipzig', 'RB Leipzig', 34, 20, 5, 9, 66, 47, 65, null, 'Champions League'),
      R('stuttgart', 'VfB Stuttgart', 34, 18, 8, 8, 71, 49, 62, null, 'Champions League'),
      R('hoffenheim', 'TSG Hoffenheim', 34, 18, 7, 9, 65, 52, 61, null, 'Europa League'),
      R('leverkusen', 'Bayer 04 Leverkusen', 34, 17, 8, 9, 68, 47, 59, null, 'Europa League'),
      R('freiburg', 'SC Freiburg', 34, 13, 8, 13, 51, 57, 47, null, null),
      R('frankfurt', 'Eintracht Frankfurt', 34, 11, 11, 12, 61, 65, 44, null, null),
      R('augsburg', 'FC Augsburg', 34, 12, 7, 15, 45, 61, 43, null, null),
      R('mainz', '1. FSV Mainz 05', 34, 10, 10, 14, 44, 53, 40, null, null),
      R('union', '1. FC Union Berlin', 34, 10, 9, 15, 44, 58, 39, null, null),
      R('gladbach', 'Borussia Mönchengladbach', 34, 9, 11, 14, 42, 53, 38, null, null),
      R('hsv', 'Hamburger SV', 34, 9, 11, 14, 40, 54, 38, null, null),
      R('koeln', '1. FC Köln', 34, 7, 11, 16, 49, 63, 32, null, null),
      R('bremen', 'SV Werder Bremen', 34, 8, 8, 18, 37, 60, 32, null, null),
      R('wolfsburg', 'VfL Wolfsburg', 34, 7, 8, 19, 45, 69, 29, null, 'Barrage de relégation'),
      R('heidenheim', '1. FC Heidenheim 1846', 34, 6, 8, 20, 41, 72, 26, null, 'Relégué'),
      R('stpauli', 'FC St. Pauli', 34, 6, 8, 20, 29, 60, 26, null, 'Relégué')
    ] },

    /* ===================================================================
     * BUNDESLIGA 2 — OpenLigaDB, classement COMPLET en temps réel
     * =================================================================== */
    { comp: 'bl2', season: '2026/2027', label: '2. Bundesliga · saison en cours (après 6 journées)',
      updated: '2026-09-24', complete: true, live: true, rows: [
      R('hertha', 'Hertha BSC', 6, 6, 0, 0, 17, 7, 18, null, 'Promotion'),
      R('nuernberg', '1. FC Nürnberg', 6, 5, 1, 0, 16, 6, 16, null, 'Promotion'),
      R('heidenheim', '1. FC Heidenheim 1846', 6, 4, 1, 1, 14, 12, 13, null, 'Barrage'),
      R('wolfsburg', 'VfL Wolfsburg', 6, 3, 2, 1, 15, 8, 11, null, null),
      R('kaiserslautern', '1. FC Kaiserslautern', 6, 3, 2, 1, 6, 4, 11, null, null),
      R('magdeburg', '1. FC Magdeburg', 6, 3, 1, 2, 11, 9, 10, null, null),
      R('cottbus', 'Energie Cottbus', 6, 2, 2, 2, 14, 13, 8, null, null),
      R('stpauli', 'FC St. Pauli', 6, 1, 4, 1, 8, 8, 7, null, null),
      R('bochum', 'VfL Bochum', 6, 2, 1, 3, 5, 6, 7, null, null),
      R('hannover', 'Hannover 96', 6, 2, 1, 3, 7, 9, 7, null, null),
      R('osnabrueck', 'VfL Osnabrück', 6, 2, 1, 3, 9, 12, 7, null, null),
      R('fuerth', 'SpVgg Greuther Fürth', 6, 1, 3, 2, 9, 11, 6, null, null),
      R('bielefeld', 'DSC Arminia Bielefeld', 6, 1, 2, 3, 10, 12, 5, null, null),
      R('karlsruhe', 'Karlsruher SC', 6, 1, 2, 3, 6, 12, 5, null, null),
      R('braunschweig', 'Eintracht Braunschweig', 6, 1, 1, 4, 12, 13, 4, null, null),
      R('kiel', 'Holstein Kiel', 6, 0, 4, 2, 7, 10, 4, null, null),
      R('dresden', 'Dynamo Dresden', 6, 1, 1, 4, 8, 14, 4, null, null),
      R('darmstadt', 'SV Darmstadt 98', 6, 1, 1, 4, 5, 13, 4, null, 'Relégation')
    ] },

    /* ===================================================================
     * PREMIER LEAGUE 2025/2026 — classement final COMPLET (Wikipédia,
     * recoupé à l'identique avec TheSportsDB sur le top 5)
     * =================================================================== */
    { comp: 'pl', season: '2025/2026', label: 'Premier League · classement final 2025/2026 (20 équipes)',
      updated: '2026-05-24', complete: true, historical: true, rows: [
      R('arsenal', 'Arsenal', 38, 26, 7, 5, 71, 27, 85, null, 'Champion'),
      R('man city', 'Manchester City', 38, 23, 9, 6, 77, 35, 78, null, 'Champions League'),
      R('man united', 'Manchester United', 38, 20, 11, 7, 69, 50, 71, null, 'Champions League'),
      R('aston villa', 'Aston Villa', 38, 19, 8, 11, 56, 49, 65, null, 'Champions League'),
      R('liverpool', 'Liverpool', 38, 17, 9, 12, 63, 53, 60, null, 'Champions League'),
      R('bournemouth', 'Bournemouth', 38, 13, 18, 7, 58, 54, 57, null, 'Europa League'),
      R('sunderland', 'Sunderland', 38, 14, 12, 12, 42, 48, 54, null, 'Europa League'),
      R('brighton', 'Brighton & Hove Albion', 38, 14, 11, 13, 52, 46, 53, null, 'Conference League'),
      R('brentford', 'Brentford', 38, 14, 11, 13, 55, 52, 53, null, null),
      R('chelsea', 'Chelsea', 38, 14, 10, 14, 58, 52, 52, null, null),
      R('fulham', 'Fulham', 38, 15, 7, 16, 47, 51, 52, null, null),
      R('newcastle', 'Newcastle United', 38, 14, 7, 17, 53, 55, 49, null, null),
      R('everton', 'Everton', 38, 13, 10, 15, 47, 50, 49, null, null),
      R('leeds', 'Leeds United', 38, 11, 14, 13, 49, 56, 47, null, null),
      R('crystal palace', 'Crystal Palace', 38, 11, 12, 15, 41, 51, 45, null, 'Europa League'),
      R('nottm forest', 'Nottingham Forest', 38, 11, 11, 16, 48, 51, 44, null, null),
      R('tottenham', 'Tottenham Hotspur', 38, 10, 11, 17, 48, 57, 41, null, null),
      R('west ham', 'West Ham United', 38, 10, 9, 19, 46, 65, 39, null, 'Relégué'),
      R('burnley', 'Burnley', 38, 4, 10, 24, 38, 75, 22, null, 'Relégué'),
      R('wolves', 'Wolverhampton Wanderers', 38, 3, 11, 24, 27, 68, 20, null, 'Relégué')
    ] },

    { comp: 'pl', season: '2026/2027', label: 'Premier League · saison en cours (après 5 journées, top 5 — limite de l\'API gratuite)',
      updated: '2026-09-24', complete: false, live: true, rows: [
      R('man city', 'Manchester City', 5, 5, 0, 0, 13, 5, 15, 'WWWWW', null),
      R('arsenal', 'Arsenal', 5, 4, 0, 1, 8, 4, 12, 'LWWWW', null),
      R('brighton', 'Brighton and Hove Albion', 5, 3, 1, 1, 16, 5, 10, 'WWDLW', null),
      R('brentford', 'Brentford', 5, 2, 3, 0, 10, 4, 9, 'WDDDW', null),
      R('leeds', 'Leeds United', 5, 2, 3, 0, 7, 3, 9, 'DWDDW', null)
    ] },

    /* ===================================================================
     * LALIGA 2025/2026 — classement final COMPLET (20 équipes)
     * =================================================================== */
    { comp: 'laliga', season: '2025/2026', label: 'LaLiga · classement final 2025/2026 (20 équipes)',
      updated: '2026-05-24', complete: true, historical: true, rows: [
      R('barcelona', 'Barcelona', 38, 31, 1, 6, 95, 36, 94, null, 'Champion'),
      R('real madrid', 'Real Madrid', 38, 27, 5, 6, 77, 35, 86, null, 'Champions League'),
      R('villarreal', 'Villarreal', 38, 22, 6, 10, 72, 46, 72, null, 'Champions League'),
      R('atletico', 'Atlético Madrid', 38, 21, 6, 11, 62, 44, 69, null, 'Champions League'),
      R('betis', 'Real Betis', 38, 15, 15, 8, 59, 48, 60, null, 'Champions League'),
      R('celta vigo', 'Celta Vigo', 38, 14, 12, 12, 53, 48, 54, null, 'Europa League'),
      R('getafe', 'Getafe', 38, 15, 6, 17, 32, 38, 51, null, 'Conference League'),
      R('rayo', 'Rayo Vallecano', 38, 12, 14, 12, 41, 44, 50, null, null),
      R('valencia', 'Valencia', 38, 13, 10, 15, 46, 55, 49, null, null),
      R('real sociedad', 'Real Sociedad', 38, 11, 13, 14, 59, 61, 46, null, 'Europa League'),
      R('espanyol', 'Espanyol', 38, 12, 10, 16, 43, 55, 46, null, null),
      R('athletic bilbao', 'Athletic Bilbao', 38, 13, 6, 19, 43, 58, 45, null, null),
      R('sevilla', 'Sevilla', 38, 12, 7, 19, 46, 60, 43, null, null),
      R('alaves', 'Alavés', 38, 11, 10, 17, 44, 56, 43, null, null),
      R('elche', 'Elche', 38, 10, 13, 15, 49, 57, 43, null, null),
      R('levante', 'Levante', 38, 11, 9, 18, 47, 61, 42, null, null),
      R('osasuna', 'Osasuna', 38, 11, 9, 18, 44, 50, 42, null, null),
      R('mallorca', 'Mallorca', 38, 11, 9, 18, 47, 57, 42, null, 'Relégué'),
      R('girona', 'Girona', 38, 9, 14, 15, 39, 55, 41, null, 'Relégué'),
      R('real oviedo', 'Real Oviedo', 38, 6, 11, 21, 26, 60, 29, null, 'Relégué')
    ] },

    /* ===================================================================
     * SERIE A 2025/2026 — classement final COMPLET (20 équipes)
     * =================================================================== */
    { comp: 'seriea', season: '2025/2026', label: 'Serie A · classement final 2025/2026 (20 équipes)',
      updated: '2026-05-24', complete: true, historical: true, rows: [
      R('inter', 'Inter Milan', 38, 27, 6, 5, 89, 35, 87, null, 'Champion'),
      R('napoli', 'Napoli', 38, 23, 7, 8, 58, 36, 76, null, 'Champions League'),
      R('roma', 'Roma', 38, 23, 4, 11, 59, 31, 73, null, 'Champions League'),
      R('como', 'Como', 38, 20, 11, 7, 65, 29, 71, null, 'Champions League'),
      R('ac milan', 'AC Milan', 38, 20, 10, 8, 53, 35, 70, null, 'Champions League'),
      R('juventus', 'Juventus', 38, 19, 12, 7, 61, 34, 69, null, 'Europa League'),
      R('atalanta', 'Atalanta', 38, 15, 14, 9, 51, 36, 59, null, 'Conference League'),
      R('bologna', 'Bologna', 38, 16, 8, 14, 49, 46, 56, null, null),
      R('lazio', 'Lazio', 38, 14, 12, 12, 41, 40, 54, null, null),
      R('udinese', 'Udinese', 38, 14, 8, 16, 45, 48, 50, null, null),
      R('sassuolo', 'Sassuolo', 38, 14, 7, 17, 46, 50, 49, null, null),
      R('torino', 'Torino', 38, 12, 9, 17, 44, 63, 45, null, null),
      R('parma', 'Parma', 38, 11, 12, 15, 28, 46, 45, null, null),
      R('cagliari', 'Cagliari', 38, 11, 10, 17, 40, 53, 43, null, null),
      R('fiorentina', 'Fiorentina', 38, 9, 15, 14, 41, 50, 42, null, null),
      R('genoa', 'Genoa', 38, 10, 11, 17, 41, 51, 41, null, null),
      R('lecce', 'Lecce', 38, 10, 8, 20, 28, 50, 38, null, null),
      R('cremonese', 'Cremonese', 38, 8, 10, 20, 32, 57, 34, null, 'Relégué'),
      R('verona', 'Hellas Verona', 38, 3, 12, 23, 25, 61, 21, null, 'Relégué'),
      R('pisa', 'Pisa', 38, 2, 12, 24, 26, 71, 18, null, 'Relégué')
    ] },

    /* ===================================================================
     * LIGUE 1 2025/2026 — classement final COMPLET (18 équipes)
     * =================================================================== */
    { comp: 'ligue1', season: '2025/2026', label: 'Ligue 1 · classement final 2025/2026 (18 équipes)',
      updated: '2026-05-24', complete: true, historical: true, rows: [
      R('psg', 'Paris Saint-Germain', 34, 24, 4, 6, 74, 29, 76, null, 'Champion'),
      R('lens', 'Lens', 34, 22, 4, 8, 66, 35, 70, null, 'Champions League'),
      R('lille', 'Lille', 34, 18, 7, 9, 52, 37, 61, null, 'Champions League'),
      R('lyon', 'Lyon', 34, 18, 6, 10, 53, 40, 60, null, 'Barrages CL'),
      R('marseille', 'Marseille', 34, 18, 5, 11, 63, 45, 59, null, 'Europa League'),
      R('rennes', 'Rennes', 34, 17, 8, 9, 59, 50, 59, null, 'Europa League'),
      R('monaco', 'Monaco', 34, 16, 6, 12, 60, 54, 54, null, 'Conference League'),
      R('strasbourg', 'Strasbourg', 34, 15, 8, 11, 58, 47, 53, null, null),
      R('toulouse', 'Toulouse', 34, 12, 9, 13, 47, 46, 45, null, null),
      R('lorient', 'Lorient', 34, 11, 12, 11, 48, 51, 45, null, null),
      R('paris fc', 'Paris FC', 34, 11, 11, 12, 47, 50, 44, null, null),
      R('brest', 'Brest', 34, 10, 9, 15, 43, 55, 39, null, null),
      R('angers', 'Angers', 34, 9, 9, 16, 29, 48, 36, null, null),
      R('le havre', 'Le Havre', 34, 7, 14, 13, 32, 44, 35, null, null),
      R('auxerre', 'Auxerre', 34, 8, 10, 16, 34, 44, 34, null, null),
      R('nice', 'Nice', 34, 7, 11, 16, 37, 60, 32, null, 'Barrage'),
      R('nantes', 'Nantes', 34, 5, 9, 20, 29, 52, 24, null, 'Relégué'),
      R('metz', 'Metz', 34, 3, 8, 23, 32, 76, 17, null, 'Relégué')
    ] }
  ];

  /* --- Palmarès / contexte Coupe du Monde ------------------------------- */
  var worldCup = {
    edition: 'FIFA World Cup 2026',
    hosts: 'Canada · Mexique · États-Unis',
    final: 'Espagne 1 – 0 Argentine (a.p.)',
    finalDate: '19 juillet 2026',
    stadium: 'MetLife Stadium, East Rutherford, New Jersey',
    attendance: '80 663 spectateurs',
    winner: 'Espagne',
    runnerUp: 'Argentine',
    scorer: 'Ferran Torres (106e)',
    note: 'L\'Espagne remporte son deuxième titre mondial, 16 ans après celui de 2010. ' +
          'L\'Argentine, tenante du titre, a évolué à dix après l\'expulsion d\'Enzo Fernández en fin de temps réglementaire.',
    qualified: [
      { country: 'Espagne', flag: '🇪🇸', key: 'spain' },
      { country: 'Argentine', flag: '🇦🇷', key: 'argentina' },
      { country: 'France', flag: '🇫🇷' },
      { country: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      { country: 'Brésil', flag: '🇧🇷' },
      { country: 'Portugal', flag: '🇵🇹' },
      { country: 'Allemagne', flag: '🇩🇪' },
      { country: 'Pays-Bas', flag: '🇳🇱' },
      { country: 'États-Unis', flag: '🇺🇸' },
      { country: 'Canada', flag: '🇨🇦' },
      { country: 'Mexique', flag: '🇲🇽' },
      { country: 'Maroc', flag: '🇲🇦' }
    ]
  };

  window.ZACO_SNAPSHOT = {
    meta: {
      generatedAt: '2026-09-27T14:40:00Z',
      snapshotDate: '27 septembre 2026',
      sources: [
        { name: 'OpenLigaDB', url: 'https://api.openligadb.de', what: 'Bundesliga 1 — résultats, buteurs, classements, calendrier (API libre sans clé)' },
        { name: 'TheSportsDB', url: 'https://www.thesportsdb.com/api', what: 'Premier League, LaLiga, Serie A, Ligue 1, UEFA CL, MLS, USL, Coupe du Monde (clé de test publique « 3 »)' },
        { name: 'Wikipédia', url: 'https://en.wikipedia.org/wiki/2025%E2%80%9326_Premier_League', what: 'Vérification des clubs et stades du championnat d\'Angleterre 2025/2026' }
      ]
    },
    competitions: competitions,
    matches: M,
    tables: tables,
    worldCup: worldCup,
    badgeIndex: TEAM_BADGES
  };
})();
