// Encode medirect-session.json en base64, pour le coller dans la variable
// d'environnement MEDIRECT_SESSION_STATE_B64 sur Easypanel.
//
// Usage : npm run encode-session

const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '..', 'medirect-session.json');

if (!fs.existsSync(inputPath)) {
  console.error(`Fichier introuvable : ${inputPath}. Lance d'abord "npm run login".`);
  process.exit(1);
}

const base64 = fs.readFileSync(inputPath).toString('base64');
console.log(base64);
