# ⚽ ZACO SPORT ODDS

Site de pronostics football **francophone**, complet et responsive, construit sur des
**API publiques gratuites** et un moteur de prédiction qui agrège quatre méthodes
reconnues par la communauté des parieurs professionnels.

> **Démonstration en direct :** `npm start` puis <http://localhost:5173>

---

## 1. Fonctionnalités

| # | Demande | Réalisation |
|---|---------|-------------|
| 1 | **Statistiques complètes en direct** | **8 classements réels dont 6 complets** (18 à 20 équipes), buts marqués/encaissés, moyennes de buts par championnat, forme, buteurs avec minute, affluences — synchronisés depuis OpenLigaDB, TheSportsDB et l'API Wikipédia |
| 2 | **Regroupement de tous les matchs / championnats / Coupe du monde** | **10 compétitions** : Bundesliga, **2. Bundesliga**, Premier League, LaLiga, Serie A, Ligue 1, Ligue des Champions, MLS, USL Championship, Coupe du Monde FIFA 2026 |
| 3 | **Architecture moderne et attirante** | Design system CSS maison, palette « pelouse » (émeraude / citron / or / cramoisi), animations fluides, 100 % responsive (mobile → 4K) |
| 4 | **Affichage des matchs en direct** | Statuts `LIVE / MI-TEMPS / À venir / Terminé`, minute de jeu calculée, polling automatique configurable (45 s par défaut) |
| 5 | **Pronostics basés sur les meilleurs pronostiqueurs** | Consensus de 4 modèles : **Elo**, **Poisson bivarié Dixon-Coles**, **forme/momentum**, **probabilités implicites du marché** |
| 6 | **Bulles / widgets temps réel** | Carrousel de bulles horizontales avec écussons, score animé, pronostic et niveau de confiance ; mise à jour automatique |
| 7 | **Calendrier du jour et à venir** | Groupement par journée, filtres par compétition / statut / période (aujourd'hui, 7 j, 30 j, terminés) et recherche plein texte |
| 8 | **Gestion de bankroll** | Capital, dépôts, mises, ROI/Yield, taux de réussite, série en cours, drawdown maximal, mise conseillée **demi-Kelly**, graphiques Chart.js |
| 9 | **Historique gagnés / perdus** | Paris réglés (gagné / perdu / remboursé / en cours) **+ validation du modèle** sur les matchs réellement joués, sans biais de connaissance anticipée |

---

## 2. Sources de données — toutes réelles et gratuites

Aucune donnée n'est inventée. Le fichier `public/js/data/snapshot.js` est un
**instantané réel** collecté le **27 septembre 2026** :

| Source | URL | Contenu utilisé |
|--------|-----|-----------------|
| **OpenLigaDB** | `https://api.openligadb.de` | Bundesliga 1 & **2. Bundesliga** : classements **complets** (18 équipes), journées 4 à 7, résultats, buteurs avec minute |
| **TheSportsDB** | `https://www.thesportsdb.com/api/v1/json/3/` | Premier League, LaLiga, Serie A, Ligue 1, UEFA Champions League, MLS, USL Championship, Coupe du Monde — classements, matchs joués et à venir |
| **Wikipédia** (API `action=parse`) | `https://en.wikipedia.org/w/api.php` | **Classements finaux complets 2025/2026** des quatre grands championnats (20/20/20/18 équipes), recoupés ligne par ligne avec TheSportsDB |

> L'API `action=parse` de Wikipédia est le contournement utilisé pour la limite de
> 5 lignes de TheSportsDB : elle renvoie le tableau de classement **entier et dans
> l'ordre officiel**, ce qui permet d'obtenir les 20 équipes de Premier League, de
> LaLiga et de Serie A et les 18 de Ligue 1 (positions, points, différence de buts).

### Exemples de données réelles embarquées

* **Premier League 2025/2026 (finale, 20 équipes)** — Arsenal champion 85 pts (26-7-5, 71-27) devant Manchester City 78 et Manchester United 71 ; West Ham, Burnley et Wolverhampton relégués.
* **LaLiga 2025/2026 (finale, 20 équipes)** — Barcelona 94 pts (95 buts marqués), Real Madrid 86, Villarreal 72, Atlético 69 ; Mallorca, Girona et Real Oviedo relégués.
* **Serie A 2025/2026 (finale, 20 équipes)** — Inter 87 pts, Napoli 76, Roma 73, Como 71, AC Milan 70 ; Cremonese, Hellas Verona et Pisa relégués.
* **Ligue 1 2025/2026 (finale, 18 équipes)** — PSG champion 76 pts, Lens 70, Lille 61, Lyon 60, Marseille 59 ; Nantes et Metz relégués.
* **Bundesliga 2025/2026 (classement final complet)** — Bayern 89 pts (122 buts marqués), Dortmund 73, Leipzig 65, Stuttgart 62, Hoffenheim 61…
* **Bundesliga 2026/2027 (après 4 journées)** — Dortmund 12 pts devant Bayern 10 et Freiburg 10 ; Union Berlin 17e, Gladbach 18e.
* **2. Bundesliga 2026/2027 (après 6 journées)** — Hertha BSC 18 pts (6 victoires en 6 matchs), Nürnberg 16, Heidenheim 13 ; 9 résultats réels (Wolfsburg 5-1 Darmstadt, Dresden 1-2 Hertha…) et les 9 affiches de la 7ᵉ journée.
* **Bayern Munich 7 – 0 Union Berlin** (18/09/2026) — buts de Musiala 18', Kane 39' (pen.) et 54', Olise 43', 73', 76', Saibari 70'.
* **Gladbach 3 – 4 Mainz** (19/09/2026) — 7 buts, dont un penalty de Machino à la 95'.
* **AC Milan 3 – 0 Lecce**, **Valence 2 – 3 Real Sociedad**, **Como 4 – 1 RB Leipzig**, **Fulham 1 – 1 Manchester United**.
* **Finale de la Coupe du Monde 2026** — **Espagne 1 – 0 Argentine** (après prolongation), 19 juillet 2026, MetLife Stadium, 80 663 spectateurs, but de Ferran Torres à la 106ᵉ minute.

> **Limite connue et affichée dans l'interface :** la clé gratuite de TheSportsDB
> plafonne les réponses à **5 enregistrements** par requête. L'application le
> signale explicitement (« top 5 — limite de l'API gratuite ») et permet de saisir
> une clé personnelle dans **Sources → Réglages** pour lever cette limite.
> OpenLigaDB n'a aucune limite : la Bundesliga est donc affichée en intégralité.

---

## 3. Le moteur de pronostics (`public/js/model.js`)

### Calcul des forces d'équipe

1. **Niveau de buts de référence** par championnat, toutes saisons confondues,
   régularisé vers un prior global de 1,42 but/équipe/match :
   `base = (Σbuts + prior × 130) / (Σmatchs + 130)`
   → évite les biais des petits échantillons (début de saison) et des classements tronqués.
2. **Force offensive / défensive** : `attaque = (buts marqués/match) / base`,
   `défense = (buts encaissés/match) / base`, avec contraction
   `1 + (x − 1) × pl/(pl+10)` (régression vers la moyenne).
3. **Mélange des saisons** : saison en cours (poids 1,0) + saison précédente (poids 0,55).
4. **Rating Elo** reconstruit sur une échelle 1200–2100 à partir des points/match et
   de la domination offensive/défensive, moyenne du championnat ≈ 1500.
5. **Équipe inconnue** : prior explicite (Elo 1430, attaque 0,97, défense 1,05) et
   confiance dégradée — jamais de prédiction « silencieusement fausse ».

### Les quatre modèles

| Modèle | Principe | Poids |
|--------|----------|-------|
| **Elo** | `E = 1 / (1 + 10^(−Δ/400))` avec bonus terrain de +65 pts | 0,10 – 0,26 |
| **Poisson · Dixon-Coles** | `λ_dom = moy_dom × att_dom × déf_ext`, `λ_ext = moy_ext × att_ext × déf_dom`, correction ρ = −0,055 sur les scores 0-0, 1-0, 0-1, 1-1 | 0,38 |
| **Forme / momentum** | Fenêtre glissante pondérée sur les 5 derniers résultats | 0,18 |
| **Marché** | Probabilités implicites des cotes, marge du bookmaker retirée par normalisation proportionnelle | 0,30 |

Le **Consensus ZACO** agrège ces points de vue. La **confiance** combine trois
facteurs : accord inter-modèles, probabilité maximale et volume de données disponibles.

### Sorties par match

Probabilités 1X2 · cote juste · score exact le plus probable · plus/moins de 2,5 buts ·
les deux équipes marquent · double chance · λ (buts attendus) · ratings Elo ·
**détection de value** (espérance = `p × cote − 1`) et **fraction de Kelly** pour la mise.

---

## 4. Structure du projet

```
zaco-sport-odds/
├── server.mjs                  Serveur Node.js (zéro dépendance) + proxy API
├── package.json
├── public/
│   ├── index.html              Page unique, 10 sections ancrées
│   ├── css/app.css             Design system complet (~700 lignes)
│   ├── vendor/chart.umd.js     Chart.js 4.4.7 (copie locale, aucune dépendance CDN)
│   └── js/
│       ├── data/snapshot.js    Jeu de données RÉELLES embarqué
│       ├── model.js            Moteur de pronostics (Elo + Dixon-Coles + forme + marché)
│       ├── api.js              Couche réseau temps réel (OpenLigaDB bl1/bl2, TheSportsDB, proxy)
│       ├── bankroll.js         Gestion de bankroll et statistiques (localStorage)
│       ├── charts.js           Graphiques Chart.js (7 visualisations)
│       ├── ui.js               Templates et helpers de rendu
│       └── app.js              Orchestration, filtres, modales, navigation
└── tests/
    ├── data.mjs                Intégrité du jeu de données et du moteur (arithmétique des classements, alias, pronostics)
    ├── smoke.mjs               Test d'intégration DOM complet (jsdom)
    └── charts.mjs              Validation des configurations Chart.js
```

---

## 5. Installation et lancement

```bash
npm install          # installe Chart.js
npm start            # → http://localhost:5173
```

Le serveur écoute sur `0.0.0.0` (accessible depuis un réseau local ou un
environnement de prévisualisation).

### Tests

```bash
npm test             # 3 suites : intégrité des données, rendu DOM, graphiques
```

### Repli proxy

Si le navigateur ne peut pas appeler les API directement (CORS ou réseau
restreint), `api.js` retente automatiquement via :

```
/api/proxy?url=<url encodée>
```

Le proxy n'accepte qu'une **liste blanche d'hôtes** (`api.openligadb.de`,
`www.thesportsdb.com`) et refuse toute autre destination.

### Comportement hors ligne

L'application **fonctionne intégralement sans Internet** grâce au snapshot réel
embarqué : toutes les sections, le moteur de pronostics et la bankroll restent
opérationnels. Le bandeau d'en-tête indique alors « 📦 Snapshot embarqué ».
Le direct peut aussi être **désactivé manuellement** dans *Sources → Réglages* :
aucune requête réseau n'est alors émise, seules les données embarquées sont utilisées.

---

## 6. Limites assumées

* **Cotes des bookmakers** : non incluses (les API d'odds gratuites exigent une clé).
  Le site affiche la **cote juste** issue du modèle ; si l'utilisateur saisit la cote
  de son bookmaker, la **value** et la mise **demi-Kelly** sont calculées.
* **Classements tronqués à 5 équipes** uniquement pour la **saison en cours des
  championnats étrangers** (limite de la clé gratuite TheSportsDB) — signalé dans
  l'interface par la mention « partiel ». Les classements **finaux** de ces mêmes
  championnats sont, eux, complets (20/20/20/18 équipes) via l'API Wikipédia.
* **Validation du modèle** : l'échantillon de matchs terminés est volontairement
  petit et la taille est affichée. Les forces sont recalculées sur la saison
  précédente pour éviter tout biais de connaissance anticipée.
* **Démo live** : en dehors des créneaux de match, un bouton permet de lancer un
  match **simulé** pour visualiser les bulles temps réel. Il est explicitement
  étiqueté « démonstration — données non réelles ».
* **Résultats live** : OpenLigaDB met à jour les scores en cours de match en temps
  réel. Pour les autres championnats, la clé gratuite ne fournit pas de flux live
  détaillé ; le statut est déduit de l'heure de coup d'envoi.

---

## 7. Jeu responsable

⚠️ Ce projet est une **démonstration technique**. Les probabilités affichées sont
issues de modèles statistiques calculés à partir de données publiques ; elles ne
constituent ni un conseil en investissement, ni une garantie de gain. Les paris
sportifs comportent un risque de perte et sont interdits aux mineurs.

En France : **09 74 75 13 13** — joueurs-info-service.fr

---

## 8. Technologies

HTML5 sémantique · CSS3 (variables, grid, flexbox, animations) · JavaScript ES5+
sans framework ni étape de build · Chart.js 4.4.7 (copie locale) · Node.js
(`node:http`, zéro dépendance serveur) · jsdom pour les tests.
