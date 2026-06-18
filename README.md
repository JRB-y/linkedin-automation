# LinkedIn Automation

Publie automatiquement sur LinkedIn chaque jour à 9h UTC à partir de fichiers markdown.

## Comment ça marche

1. Tu déposes un fichier `.md` dans `ideas/` avec ton idée brute
2. GitHub Actions tourne chaque matin, génère un post via Claude, publie sur LinkedIn
3. Le fichier est archivé dans `posted/`

## Ajouter une idée

Crée un fichier dans `ideas/` et écris ton idée en texte libre. Claude se charge de la mise en forme selon le style défini dans `tone.md`.

## Déclencher manuellement

```bash
gh workflow run daily_post.yml --repo JRB-y/linkedin-automation
gh run watch --repo JRB-y/linkedin-automation
```

## Setup initial (one-time)

### 1. Prérequis
- LinkedIn Developer App avec le produit "Share on LinkedIn"
- Redirect URI : `http://localhost:8000/callback`
- Fichier `.env` à la racine :

```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
```

### 2. Obtenir les tokens

```bash
npm install
node src/setupAuth.js
```

Ouvre le lien dans le navigateur, autorise l'app. Le terminal affiche `LINKEDIN_ACCESS_TOKEN` et `LINKEDIN_PERSON_ID`.

### 3. Configurer les secrets GitHub

```bash
gh secret set ANTHROPIC_API_KEY --repo JRB-y/linkedin-automation
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
gh secret set LINKEDIN_PERSON_ID --repo JRB-y/linkedin-automation
```

## Renouveler l'access token (~tous les 60 jours)

```bash
node src/setupAuth.js
gh secret set LINKEDIN_ACCESS_TOKEN --repo JRB-y/linkedin-automation
```

## Secrets GitHub requis

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Clé API Anthropic |
| `LINKEDIN_ACCESS_TOKEN` | Token LinkedIn (expire ~60j) |
| `LINKEDIN_PERSON_ID` | ID de ton profil LinkedIn |
