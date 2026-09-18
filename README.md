# medirect-etf-scraper

Microservice Playwright qui extrait, depuis `online.medirect.be`, la liste des
ETF filtrés (Région = World, Devise = EUR, Type = Capitalisation), pour
alimenter un workflow n8n qui génère un Excel comparatif.

Basé sur le même pattern que le service `webscrap` (n8n + Playwright,
déployé via Easypanel) : connexion humaine unique, puis session réutilisée
par le microservice — aucun identifiant bancaire n'est stocké en clair.

## ⚠️ État actuel

Les sélecteurs DOM dans `server.js` (`[SELECTEUR_...]`) sont des
**placeholders**. Il reste à inspecter la page MeDirect une fois loggé et
filtré pour les remplacer par les vrais sélecteurs avant que le scraping
fonctionne réellement.

## Setup local

```bash
npm install
npx playwright install chromium   # si pas déjà fait sur ta machine
```

### 1. Capturer une session MeDirect

```bash
npm run login
```

Une fenêtre s'ouvre : connecte-toi manuellement à MeDirect (2FA compris),
attends d'être sur le tableau de bord, reviens dans le terminal et appuie
sur Entrée. Ça génère `medirect-session.json` à la racine (déjà dans
`.gitignore`, ne jamais le committer).

### 2. Tester le serveur en local

```bash
export SCRAPER_API_KEY=test123
npm start
curl -H "x-api-key: test123" http://localhost:3000/medirect-etf-scrape
```

## Déploiement sur Easypanel

1. **Push ce repo sur GitHub** (sans `medirect-session.json`, il est ignoré).
2. Dans Easypanel : nouveau service **App** → source GitHub → sélectionner
   le repo. Easypanel détecte automatiquement le `Dockerfile`.
3. Port du service : `3000`.
4. Variables d'environnement à définir dans Easypanel :
   - `SCRAPER_API_KEY` : une clé aléatoire (ex. générée avec `openssl rand -hex 32`)
   - `MEDIRECT_SESSION_STATE_B64` : sortie de `npm run encode-session` (voir ci-dessous)
5. Déployer.

### Fournir la session au conteneur

Deux options, une variable d'env suffit dans la majorité des cas vu la
petite taille du fichier de session :

**Option A — variable d'environnement (recommandé, plus simple)**

```bash
npm run encode-session
# copier la sortie base64 dans MEDIRECT_SESSION_STATE_B64 sur Easypanel
```

**Option B — volume persistant**

Monter un volume Easypanel sur `/data`, définir `SESSION_STATE_PATH=/data/medirect-session.json`,
et déposer le fichier dedans (ex. via un job ponctuel ou un accès shell au conteneur).

### Renouveler la session

Les sessions bancaires expirent (souvent assez vite). Quand
`/medirect-etf-scrape` renvoie `session_expired` :

```bash
npm run login
npm run encode-session
```

Puis mettre à jour `MEDIRECT_SESSION_STATE_B64` sur Easypanel et redéployer.

## Appel depuis n8n

Nœud **HTTP Request** :
- Méthode : `GET`
- URL : `https://<ton-service>.easypanel.host/medirect-etf-scrape`
- Header : `x-api-key: <SCRAPER_API_KEY>`

La réponse JSON (`{ count, etfs }`) alimente ensuite un nœud Code pour le
tri/filtrage, puis un nœud d'export Excel.
