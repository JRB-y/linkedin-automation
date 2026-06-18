# CLAUDE.md

## Ce que fait ce projet

Publie automatiquement un post LinkedIn chaque jour à 9h UTC.

1. Récupère la première idée "Ready" dans la DB Notion (`src/notionClient.js`)
2. Génère le texte du post via Claude Sonnet + l'image via Gemini en parallèle
3. Upload l'image sur LinkedIn puis publie le post (`src/linkedinPost.js`)
4. Met à jour l'idée dans Notion : statut → "Posted", date de publication

## Structure

```
tone.md               → style et ton de l'auteur, lu à chaque run
src/main.js           → orchestrateur principal
src/notionClient.js   → lecture/écriture Notion API
src/generatePost.js   → génération texte via Claude API
src/generateImage.js  → génération image via Gemini API
src/linkedinPost.js   → upload image + publication LinkedIn API
src/setupAuth.js      → OAuth LinkedIn one-time (local uniquement)
.github/workflows/daily_post.yml → cron GitHub Actions
```

## DB Notion

Propriétés attendues sur la base de données :

| Propriété | Type | Valeurs |
|-----------|------|---------|
| `Name` | Title | nom de l'idée |
| `Content` | Text | idée brute (si vide, utilise Name) |
| `Status` | Select | `Draft` / `Ready` / `Posted` |
| `Published At` | Date | rempli automatiquement |

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude Sonnet pour la génération de texte |
| `GOOGLE_API_KEY` | Gemini pour la génération d'image (billing requis) |
| `LINKEDIN_ACCESS_TOKEN` | Expire ~60 jours — voir renouvellement ci-dessous |
| `LINKEDIN_PERSON_ID` | ID fixe du profil LinkedIn |
| `NOTION_API_KEY` | Secret de l'intégration Notion |
| `NOTION_DATABASE_ID` | ID de la DB (32 chars dans l'URL Notion) |

## Commandes utiles

```bash
# Tester en local (nécessite un .env)
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
- **Notion fallback** : si `Content` est vide, le `Name` de la page est utilisé comme idée.
- Le statut Notion est mis à jour **après** publication réussie. Si le workflow échoue avant, l'idée reste "Ready" et sera retraitée au prochain run.
