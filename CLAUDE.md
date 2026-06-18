# CLAUDE.md

## Ce que fait ce projet

Publie automatiquement un post LinkedIn chaque jour à 9h UTC.

1. Lit le premier fichier `.md` dans `ideas/` (tri alphabétique)
2. Génère le texte du post via Claude Sonnet (`src/generatePost.js`)
3. Génère une image via Gemini 2.5 Flash Image (`src/generateImage.js`)
4. Upload l'image sur LinkedIn puis publie le post (`src/linkedinPost.js`)
5. Archive le fichier dans `posted/`
6. Commit + push via GitHub Actions

## Structure

```
ideas/          → déposer les idées .md ici (une par fichier)
posted/         → archivées automatiquement après publication
tone.md         → style et ton de l'auteur, lu à chaque run
src/main.js     → orchestrateur principal
src/generatePost.js   → appel Claude API
src/generateImage.js  → appel Gemini API
src/linkedinPost.js   → upload image + publication LinkedIn
src/setupAuth.js      → OAuth LinkedIn one-time (local uniquement)
.github/workflows/daily_post.yml → cron GitHub Actions
```

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude Sonnet pour la génération de texte |
| `GOOGLE_API_KEY` | Gemini pour la génération d'image (billing requis) |
| `LINKEDIN_ACCESS_TOKEN` | Expire ~60 jours — voir renouvellement ci-dessous |
| `LINKEDIN_PERSON_ID` | ID fixe du profil LinkedIn |

## Commandes utiles

```bash
# Tester en local
node src/main.js

# Déclencher le workflow manuellement
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation
gh run watch --repo JRB-y/linkedin-automation

# Renouveler le LinkedIn access token (~tous les 60 jours)
node src/setupAuth.js
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
```

## Points d'attention

- **LinkedIn access token** expire dans ~60 jours. Relancer `setupAuth.js` avant expiration.
- **ideas/** disparaît si vide (git ne track pas les dossiers vides) → `mkdir ideas/`
- `npm ci` est utilisé dans le workflow (pas `npm install`) → toujours committer `package-lock.json`
- Le post est archivé **après** publication. Si le workflow échoue avant l'archivage, l'idée sera retraitée au prochain run.
