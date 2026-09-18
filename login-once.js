// À exécuter en LOCAL (pas dans le conteneur Easypanel), en mode headed.
// Usage : npm run login
//
// Ouvre un vrai navigateur, te laisse te connecter manuellement à MeDirect,
// puis sauvegarde l'état de session (cookies + storage) dans
// medirect-session.json à la racine du projet.

const path = require('path');
const { chromium } = require('playwright');

const OUTPUT_PATH = path.join(__dirname, '..', 'medirect-session.json');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://online.medirect.be/e-banking/');

  console.log('');
  console.log('1. Connecte-toi manuellement à MeDirect dans la fenêtre ouverte.');
  console.log('2. Une fois bien loggé et sur ton tableau de bord, reviens ici.');
  console.log('3. Appuie sur Entrée dans ce terminal pour sauvegarder la session.');
  console.log('');

  await new Promise((resolve) => process.stdin.once('data', resolve));

  await page.context().storageState({ path: OUTPUT_PATH });
  console.log(`Session sauvegardée dans ${OUTPUT_PATH}`);

  await browser.close();
  process.exit(0);
})();
