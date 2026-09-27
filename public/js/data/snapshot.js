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
  function R(id, n, b, pl, w, d, l, gf, ga, pts, form, note) {
    return { id: id, n: n, b: badge(id), pl: pl, w: w, d: d, l: l, gf: gf, ga: ga,
             gd: gf - ga, pts: pts, form: form || null, note: note || null };
  }

  var tables = [
    /* --- Bundesliga 2026/2027 — classement COMPLET (OpenLigaDB) ---------- */
    { comp: 'bl1', season: '2026/2027', label: 'Bundesliga · saison en cours (après 4 journées)',
      updated: '2026-09-24', complete: true, rows: [
      R('dortmund', 'Borussia Dortmund', 1, 4, 4, 0, 0, 9, 2, 12, null, 'Champions League'),
      R('bayern', 'FC Bayern München', 1, 4, 3, 1, 0, 14, 2, 10, null, 'Champions League'),
      R('freiburg', 'SC Freiburg', 1, 4, 3, 1, 0, 12, 3, 10, null, 'Champions League'),
      R('augsburg', 'FC Augsburg', 1, 4, 2, 1, 1, 11, 6, 7, null, 'Champions League'),
      R('leverkusen', 'Bayer 04 Leverkusen', 1, 4, 2, 1, 1, 10, 5, 7, null, 'Europa League'),
      R('mainz', '1. FSV Mainz 05', 1, 4, 2, 1, 1, 10, 6, 7, null, 'Conference League'),
      R('elversberg', 'SV 07 Elversberg', 1, 4, 2, 1, 1, 8, 7, 7, null, null),
      R('bremen', 'SV Werder Bremen', 1, 4, 2, 1, 1, 8, 8, 7, null, null),
      R('leipzig', 'RB Leipzig', 1, 4, 2, 0, 2, 9, 5, 6, null, null),
      R('frankfurt', 'Eintracht Frankfurt', 1, 4, 1, 2, 1, 9, 10, 5, null, null),
      R('schalke', 'FC Schalke 04', 1, 4, 1, 2, 1, 3, 4, 5, null, null),
      R('paderborn', 'SC Paderborn 07', 1, 4, 1, 1, 2, 3, 5, 4, null, null),
      R('koeln', '1. FC Köln', 1, 4, 1, 1, 2, 6, 9, 4, null, null),
      R('hoffenheim', 'TSG Hoffenheim', 1, 4, 1, 0, 3, 7, 10, 3, null, null),
      R('stuttgart', 'VfB Stuttgart', 1, 4, 1, 0, 3, 6, 9, 3, null, null),
      R('hsv', 'Hamburger SV', 1, 4, 1, 0, 3, 2, 13, 3, null, null),
      R('union', '1. FC Union Berlin', 1, 4, 0, 1, 3, 4, 17, 1, null, null),
      R('gladbach', 'Borussia Mönchengladbach', 1, 4, 0, 0, 4, 6, 16, 0, null, 'Zone de barrage')
    ] },

    /* --- Bundesliga 2025/2026 — classement final COMPLET (OpenLigaDB) ---- */
    { comp: 'bl1', season: '2025/2026', label: 'Bundesliga · classement final 2025/2026',
      updated: '2026-05-16', complete: true, historical: true, rows: [
      R('bayern', 'FC Bayern München', 1, 34, 28, 5, 1, 122, 36, 89, null, 'Champion'),
      R('dortmund', 'Borussia Dortmund', 1, 34, 22, 7, 5, 70, 34, 73, null, 'Champions League'),
      R('leipzig', 'RB Leipzig', 1, 34, 20, 5, 9, 66, 47, 65, null, 'Champions League'),
      R('stuttgart', 'VfB Stuttgart', 1, 34, 18, 8, 8, 71, 49, 62, null, 'Champions League'),
      R('hoffenheim', 'TSG Hoffenheim', 1, 34, 18, 7, 9, 65, 52, 61, null, 'Europa League'),
      R('leverkusen', 'Bayer 04 Leverkusen', 1, 34, 17, 8, 9, 68, 47, 59, null, 'Europa League'),
      R('freiburg', 'SC Freiburg', 1, 34, 13, 8, 13, 51, 57, 47, null, null),
      R('frankfurt', 'Eintracht Frankfurt', 1, 34, 11, 11, 12, 61, 65, 44, null, null),
      R('augsburg', 'FC Augsburg', 1, 34, 12, 7, 15, 45, 61, 43, null, null),
      R('mainz', '1. FSV Mainz 05', 1, 34, 10, 10, 14, 44, 53, 40, null, null),
      R('union', '1. FC Union Berlin', 1, 34, 10, 9, 15, 44, 58, 39, null, null),
      R('gladbach', 'Borussia Mönchengladbach', 1, 34, 9, 11, 14, 42, 53, 38, null, null),
      R('hsv', 'Hamburger SV', 1, 34, 9, 11, 14, 40, 54, 38, null, null),
      R('koeln', '1. FC Köln', 1, 34, 7, 11, 16, 49, 63, 32, null, null),
      R('bremen', 'SV Werder Bremen', 1, 34, 8, 8, 18, 37, 60, 32, null, null),
      R('wolfsburg', 'VfL Wolfsburg', 1, 34, 7, 8, 19, 45, 69, 29, null, 'Barrage de relégation'),
      R('heidenheim', '1. FC Heidenheim 1846', 1, 34, 6, 8, 20, 41, 72, 26, null, 'Relégué'),
      R('stpauli', 'FC St. Pauli', 1, 34, 6, 8, 20, 29, 60, 26, null, 'Relégué')
    ] },

    /* --- Premier League 2025/2026 — top 5 (TheSportsDB) ------------------ */
    { comp: 'pl', season: '2025/2026', label: 'Premier League · final 2025/2026 (top 5)',
      updated: '2026-06-12', complete: false, historical: true, rows: [
      R('arsenal', 'Arsenal', 1, 38, 26, 7, 5, 71, 27, 85, 'WWWWW', 'Champion'),
      R('man city', 'Manchester City', 1, 38, 23, 9, 6, 77, 35, 78, 'LDWWD', 'Champions League'),
      R('man united', 'Manchester United', 1, 38, 20, 11, 7, 69, 50, 71, 'WWDWW', 'Champions League'),
      R('aston villa', 'Aston Villa', 1, 38, 19, 8, 11, 56, 49, 65, 'WWDLL', 'Champions League'),
      R('liverpool', 'Liverpool', 1, 38, 17, 9, 12, 63, 53, 60, 'DLDLW', 'Champions League')
    ] },

    /* --- Premier League 2026/2027 — top 5, saison en cours -------------- */
    { comp: 'pl', season: '2026/2027', label: 'Premier League · saison en cours (après 5 journées, top 5)',
      updated: '2026-09-24', complete: false, rows: [
      R('man city', 'Manchester City', 1, 5, 5, 0, 0, 13, 5, 15, 'WWWWW', null),
      R('arsenal', 'Arsenal', 1, 5, 4, 0, 1, 8, 4, 12, 'LWWWW', null),
      R('brighton', 'Brighton and Hove Albion', 1, 5, 3, 1, 1, 16, 5, 10, 'WWDLW', null),
      R('brentford', 'Brentford', 1, 5, 2, 3, 0, 10, 4, 9, 'WDDDW', null),
      R('leeds', 'Leeds United', 1, 5, 2, 3, 0, 7, 3, 9, 'DWDDW', null)
    ] },

    /* --- LaLiga 2025/2026 — top 5 (TheSportsDB) ------------------------- */
    { comp: 'laliga', season: '2025/2026', label: 'LaLiga · final 2025/2026 (top 5)',
      updated: '2026-06-12', complete: false, historical: true, rows: [
      R('barcelona', 'Barcelona', 1, 38, 31, 1, 6, 95, 36, 94, 'LWLWW', 'Champion'),
      R('real madrid', 'Real Madrid', 1, 38, 27, 5, 6, 77, 35, 86, 'WWWLW', 'Champions League'),
      R('villarreal', 'Villarreal', 1, 38, 22, 6, 10, 72, 46, 72, 'WLLDW', 'Champions League'),
      R('atletico', 'Atlético Madrid', 1, 38, 21, 6, 11, 62, 44, 69, 'LWWLW', 'Champions League'),
      R('betis', 'Real Betis', 1, 38, 15, 15, 8, 59, 48, 60, 'WLWDW', 'Champions League')
    ] },

    /* --- Ligue 1 2025/2026 — top 5 (TheSportsDB) ------------------------ */
    { comp: 'ligue1', season: '2025/2026', label: 'Ligue 1 · final 2025/2026 (top 5)',
      updated: '2026-06-11', complete: false, historical: true, rows: [
      R('psg', 'Paris Saint-Germain', 1, 34, 24, 4, 6, 74, 29, 76, 'LWWDW', 'Champion'),
      R('lens', 'Lens', 1, 34, 22, 4, 8, 66, 35, 70, 'WLWDD', 'Champions League'),
      R('lille', 'Lille', 1, 34, 18, 7, 9, 52, 37, 61, 'LWDWD', 'Champions League'),
      R('lyon', 'Lyon', 1, 34, 18, 6, 10, 53, 40, 60, 'LLWWW', 'Barrages CL'),
      R('marseille', 'Marseille', 1, 34, 18, 5, 11, 63, 45, 59, 'WWLDL', 'Europa League')
    ] },

    /* --- Bundesliga 2025/2026 — top 5 (TheSportsDB, recoupement) -------- */
    { comp: 'bl1', season: '2025/2026', label: 'Bundesliga · final 2025/2026 (top 5)',
      updated: '2026-06-12', complete: false, historical: true, rows: [
      R('bayern', 'Bayern Munich', 1, 34, 28, 5, 1, 122, 36, 89, 'WWDWW', 'Champion'),
      R('dortmund', 'Borussia Dortmund', 1, 34, 22, 7, 5, 70, 34, 73, 'WWLWL', 'Champions League'),
      R('leipzig', 'RB Leipzig', 1, 34, 20, 5, 9, 66, 47, 65, 'LWLWW', 'Champions League'),
      R('stuttgart', 'Stuttgart', 1, 34, 18, 8, 8, 71, 49, 62, 'DWDDL', 'Champions League'),
      R('hoffenheim', 'Hoffenheim', 1, 34, 18, 7, 9, 65, 52, 61, 'LWDWW', 'Europa League')
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
