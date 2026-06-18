# LinkedIn Automation

Publie automatiquement sur LinkedIn chaque jour à 9h UTC à partir d'idées rédigées dans Notion.

## Comment ça marche

1. Tu crées une page dans la DB Notion et tu passes le statut à **Ready**
2. GitHub Actions tourne chaque matin, génère le contenu via Claude, publie sur LinkedIn
3. Le post généré et les assets sont sauvegardés dans le toggle **📝 Generated Post** de la page Notion
4. Le statut passe automatiquement à **Posted**

## Types de posts

| Type | Description |
|------|-------------|
| `Text` | Post texte seul |
| `Text+Image` | Post texte + image générée par Gemini |
| `Quizz` | Post format question à choix multiples |
| `Carousel` | PDF multi-slides généré et publié comme document LinkedIn |

## Dry-run

Génère le contenu **sans publier** sur LinkedIn. Le statut passe à **Review** pour relecture.

```bash
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation -f dry_run=true
gh run watch --repo JRB-y/linkedin-automation
```

Après relecture, repasse le statut à **Ready** → le prochain run republiera en réutilisant le contenu déjà généré.

## Déclencher manuellement (publication réelle)

```bash
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation
gh run watch --repo JRB-y/linkedin-automation
```

## Setup initial (one-time)

### 1. Prérequis

- LinkedIn Developer App avec le produit "Share on LinkedIn"
- Redirect URI : `http://localhost:8000/callback`
- Intégration Notion avec accès en lecture/écriture sur ta DB
- Billing Google activé (pour la génération d'images Gemini)

### 2. Obtenir le LinkedIn access token

Crée un fichier `.env` à la racine :

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

```bash
npm install
node src/setupAuth.js
```

Ouvre le lien dans le navigateur, autorise l'app. Le terminal affiche `LINKEDIN_ACCESS_TOKEN` et `LINKEDIN_PERSON_ID`.

### 3. Configurer les secrets GitHub

```bash
gh secret set ANTHROPIC_API_KEY --repo JRB-y/linkedin-automation
gh secret set GOOGLE_API_KEY --repo JRB-y/linkedin-automation
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
gh secret set LINKEDIN_PERSON_ID --repo JRB-y/linkedin-automation
gh secret set NOTION_API_KEY --repo JRB-y/linkedin-automation
gh secret set NOTION_DATABASE_ID --repo JRB-y/linkedin-automation
gh secret set GITHUB_REPOSITORY_NAME --repo JRB-y/linkedin-automation  # ex: JRB-y/linkedin-automation
```

## Renouveler l'access token (~tous les 60 jours)

```bash
node src/setupAuth.js
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
```

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (génération texte + carousel) |
| `GOOGLE_API_KEY` | Clé API Google/Gemini (génération image, billing requis) |
| `LINKEDIN_ACCESS_TOKEN` | Token LinkedIn (expire ~60j) |
| `LINKEDIN_PERSON_ID` | ID fixe du profil LinkedIn |
| `NOTION_API_KEY` | Secret de l'intégration Notion |
| `NOTION_DATABASE_ID` | ID de la DB (32 chars dans l'URL Notion) |
| `GITHUB_TOKEN` | Fourni automatiquement par GitHub Actions |
