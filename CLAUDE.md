# CLAUDE.md

## Ce que fait ce projet

Publie automatiquement un post LinkedIn chaque jour à 9h UTC.

1. Récupère la première idée "Ready" dans la DB Notion (`src/notionClient.js`)
2. Selon le **Post Type**, génère le contenu (texte Claude + image Gemini, ou carousel PDF)
3. Publie sur LinkedIn via l'API REST
4. Sauvegarde les assets générés (images/PDFs) dans ce repo GitHub
5. Met à jour la page Notion : statut → "Posted", contenu dans le toggle "📝 Generated Post"

## Structure des fichiers

```
tone.md                          → style et ton de l'auteur, lu à chaque run
src/main.js                      → orchestrateur principal
src/notionClient.js              → lecture/écriture Notion API
src/generatePost.js              → génération texte via Claude API (Text, Text+Image, Quizz)
src/generateImage.js             → génération image via Gemini API
src/generateCarousel.js          → génération carousel (Claude JSON → pdf-lib PDF)
src/linkedinPost.js              → upload image/PDF + publication LinkedIn API
src/githubStorage.js             → upload images/PDFs vers ce repo GitHub (Contents API)
src/setupAuth.js                 → OAuth LinkedIn one-time (local uniquement)
generated-images/                → images PNG générées (public via raw.githubusercontent.com)
generated-carousels/             → PDFs carousel générés
.github/workflows/daily_post.yml → cron GitHub Actions + workflow_dispatch
```

## DB Notion

Propriétés attendues sur la base de données :

| Propriété | Type | Valeurs |
|-----------|------|---------|
| `Name` | Title | nom de l'idée |
| `Post Type` | Select | `Text` / `Text+Image` / `Quizz` / `Carousel` |
| `Status` | Select | `Draft` / `Ready` / `Review` / `Posted` |
| `Published At` | Date | rempli automatiquement à la publication |

Le **corps de la page** (body blocks) est utilisé comme contenu de l'idée. Le post généré est écrit dans un toggle **📝 Generated Post** ajouté à la fin de la page.

## Flux selon le Post Type

```
Carousel   → generateCarousel() → PDF via pdf-lib → uploadPDFToGitHub()
                                                   → publishCarousel() (LinkedIn DOCUMENT)
                                                   → Notion toggle (caption + lien PDF)

Text+Image → generatePost() + generateImage() en parallèle
           → uploadImageToGitHub() → publishPost(imageBuffer)
           → Notion toggle (post + image)

Text/Quizz → generatePost() seul → publishPost() → Notion toggle (post)
```

## Mode dry-run

`DRY_RUN=true` → génère tout mais ne publie pas sur LinkedIn. Statut → "Review".

Quand l'idée repasse en "Ready" depuis "Review" : le toggle existant est relu et le contenu déjà généré est réutilisé (pas de double génération).

## Assets GitHub

- Images : `generated-images/{timestamp}-{slug}.png`
- PDFs : `generated-carousels/{timestamp}-{slug}.pdf`
- URL publique : `https://raw.githubusercontent.com/JRB-y/linkedin-automation/main/{path}`
- Repo doit être **public** pour que les URLs soient accessibles par Notion et LinkedIn

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Claude Sonnet pour texte + carousel |
| `GOOGLE_API_KEY` | Gemini 2.5 flash pour images (billing requis) |
| `LINKEDIN_ACCESS_TOKEN` | Expire ~60 jours — voir renouvellement |
| `LINKEDIN_PERSON_ID` | ID fixe du profil LinkedIn |
| `NOTION_API_KEY` | Secret de l'intégration Notion |
| `NOTION_DATABASE_ID` | ID de la DB (32 chars dans l'URL Notion) |
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub Actions (contents: write) |

## Commandes utiles

```bash
# Tester en local (nécessite un .env à la racine)
node src/main.js
DRY_RUN=true node src/main.js

# Déclencher le workflow manuellement
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation -f dry_run=true
gh run watch --repo JRB-y/linkedin-automation

# Voir les logs du dernier run
gh run view --repo JRB-y/linkedin-automation --log | tail -50

# Renouveler le LinkedIn access token (~tous les 60 jours)
node src/setupAuth.js
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
```

## Points d'attention

- **LinkedIn access token** expire dans ~60 jours. Relancer `setupAuth.js` avant expiration.
- **pdf-lib / WinAnsi** : les fonts standard (Helvetica) ne supportent pas les caractères Unicode > 0xFF. La fonction `sanitize()` dans `generateCarousel.js` nettoie le texte avant écriture PDF.
- **Notion toggle** : `writePostToggle()` ajoute toujours un nouveau toggle. Si une idée est repassée en Ready plusieurs fois, plusieurs toggles peuvent s'accumuler — seul le premier est relu au prochain run.
- Le statut Notion est mis à jour **après** publication réussie. Si le workflow échoue avant, l'idée reste "Ready" et sera retraitée au prochain run.
