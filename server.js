const express = require('express');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_PATH = process.env.SESSION_STATE_PATH || path.join(__dirname, 'medirect-session.json');

// ---------------------------------------------------------------------------
// Chargement de la session au démarrage.
// Deux options :
//   1) Un volume persistant Easypanel monté sur SESSION_STATE_PATH
//   2) La variable d'env MEDIRECT_SESSION_STATE_B64 (session encodée en base64),
//      pratique quand on n'a pas configuré de volume.
// ---------------------------------------------------------------------------
function ensureSessionFile() {
  if (fs.existsSync(SESSION_PATH)) return;

  if (process.env.MEDIRECT_SESSION_STATE_B64) {
    const decoded = Buffer.from(process.env.MEDIRECT_SESSION_STATE_B64, 'base64');
    fs.writeFileSync(SESSION_PATH, decoded);
    console.log(`Session restaurée depuis MEDIRECT_SESSION_STATE_B64 -> ${SESSION_PATH}`);
  } else {
    console.warn(
      `Aucun fichier de session trouvé à ${SESSION_PATH} et MEDIRECT_SESSION_STATE_B64 non défini. ` +
      `L'endpoint /medirect-etf-scrape échouera tant qu'une session valide n'est pas fournie.`
    );
  }
}

// ---------------------------------------------------------------------------
// Authentification simple par clé d'API (évite qu'un endpoint public
// exposant des données bancaires soit appelable par n'importe qui).
// ---------------------------------------------------------------------------
function requireApiKey(req, res, next) {
  const expected = process.env.SCRAPER_API_KEY;
  if (!expected) {
    return res.status(500).json({ error: 'server_misconfigured', message: 'SCRAPER_API_KEY non défini côté serveur' });
  }
  if (req.header('x-api-key') !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessionFileExists: fs.existsSync(SESSION_PATH) });
});

app.get('/medirect-etf-scrape', requireApiKey, async (_req, res) => {
  if (!fs.existsSync(SESSION_PATH)) {
    return res.status(412).json({
      error: 'session_missing',
      message: 'Aucune session MeDirect disponible. Relancer scripts/login-once.js et mettre à jour la config.',
    });
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ storageState: SESSION_PATH });
    const page = await context.newPage();

    await page.goto('https://online.medirect.be/e-banking/browse-products--explore-investments', {
      waitUntil: 'networkidle',
    });

    // Si la session a expiré, MeDirect redirige typiquement vers une page de login.
    const isLoginPage = await page.locator('input[type="password"]').count();
    if (isLoginPage > 0) {
      return res.status(401).json({
        error: 'session_expired',
        message: 'La session MeDirect a expiré. Relancer scripts/login-once.js.',
      });
    }

    // ---------------------------------------------------------------
    // TODO (étape 2 — pas encore faite) : remplacer ces sélecteurs
    // génériques par les vrais, une fois le DOM inspecté en conditions
    // réelles (filtres Région/Devise/Type + tableau de résultats).
    // ---------------------------------------------------------------
    await page.click('[SELECTEUR_FILTRE_REGION]');
    await page.click('[SELECTEUR_WORLD]');
    await page.click('[SELECTEUR_FILTRE_DEVISE]');
    await page.click('[SELECTEUR_EUR]');
    await page.click('[SELECTEUR_FILTRE_TYPE]');
    await page.click('[SELECTEUR_CAPITALISATION]');

    await page.waitForSelector('[SELECTEUR_TABLEAU_RESULTATS]');

    const etfs = await page.$$eval('[SELECTEUR_LIGNE_ETF]', (rows) =>
      rows.map((row) => ({
        nom: row.querySelector('[SELECTEUR_NOM]')?.textContent.trim() ?? null,
        isin: row.querySelector('[SELECTEUR_ISIN]')?.textContent.trim() ?? null,
        ter: row.querySelector('[SELECTEUR_TER]')?.textContent.trim() ?? null,
        taille: row.querySelector('[SELECTEUR_TAILLE]')?.textContent.trim() ?? null,
        replication: row.querySelector('[SELECTEUR_REPLICATION]')?.textContent.trim() ?? null,
      }))
    );

    res.json({ count: etfs.length, etfs });
  } catch (err) {
    console.error('Erreur pendant le scraping MeDirect :', err);
    res.status(500).json({ error: 'scrape_failed', message: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

ensureSessionFile();
app.listen(PORT, () => {
  console.log(`medirect-etf-scraper à l'écoute sur le port ${PORT}`);
});
