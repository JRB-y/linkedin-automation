import Anthropic from "@anthropic-ai/sdk";

async function fetchArticleText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; linkedin-automation)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FORMAT_INSTRUCTIONS = {
  Text: `
==========================
FORMAT
==========================

Post texte uniquement. Pas d'image associée.
Retourne uniquement le post. Pas de titre. Pas d'explication.
Maximum 1300 caractères.
`,
  "Text+Image": `
==========================
FORMAT
==========================

Retourne uniquement le post. Pas de titre. Pas d'explication.
Maximum 1300 caractères.
`,
  Quizz: `
==========================
FORMAT
==========================

Structure obligatoire :
[Question courte et engageante]

A) ...
B) ...
C) ...
D) ...

[Une phrase qui invite à répondre en commentaire, sans donner la réponse]

Retourne uniquement le post. Pas de titre. Pas d'explication.
Maximum 1300 caractères.
`,
};

export async function generatePost(idea, tone, postType = "Text+Image") {
  const formatInstructions = FORMAT_INSTRUCTIONS[postType] ?? FORMAT_INSTRUCTIONS["Text+Image"];

  // If a source URL is present in the idea, fetch the article text
  const urlMatch = idea.match(/https?:\/\/\S+/);
  let articleSection = "";
  if (urlMatch) {
    try {
      const articleText = await fetchArticleText(urlMatch[0]);
      articleSection = `
==========================
ARTICLE SOURCE
==========================

${articleText}

`;
      console.log(`[generatePost] Article fetched: ${urlMatch[0]}`);
    } catch (err) {
      console.warn(`[generatePost] Could not fetch article (${err.message}) — continuing without it`);
    }
  }

  const prompt = `
Tu écris à la première personne.

Tu n'es PAS un copywriter.
Tu n'es PAS un expert LinkedIn.
Tu écris comme un développeur senior qui partage une réflexion ou une expérience.

Le lecteur ne doit jamais avoir l'impression qu'un modèle d'IA a écrit ce texte.

==========================
TON PERSONNEL
==========================

${tone}

==========================
IDÉE
==========================

${idea}
${articleSection}
==========================
PROCESSUS
==========================

Avant d'écrire :

1. Identifie l'idée principale.
2. Trouve ce qui est réellement intéressant.
3. Supprime tout ce qui ressemble à une phrase marketing.
4. Garde uniquement les idées qui pourraient être dites naturellement à un collègue.
5. Si une phrase semble écrite par une IA, réécris-la.

==========================
RÈGLES
==========================

- Une seule idée principale.
- Pas de storytelling inventé.
- Pas de conseils génériques.
- Pas de phrases creuses.
- Pas de jargon LinkedIn.
- Pas de vocabulaire marketing.
- Pas d'exagération.
- Pas de listes inutiles.
- Pas de répétition.
- Varie le rythme des phrases.
- Certaines phrases peuvent être très courtes.
- Le texte doit être agréable à lire à voix haute.
- On doit sentir une vraie personne derrière le clavier.

==========================
INTERDIT
==========================

Ne jamais écrire :

"Dans un monde où..."

"La clé du succès..."

"Game changer"

"Incroyable"

"Révolutionnaire"

"Voici X conseils"

"Personne ne parle de..."

"Tu fais sûrement cette erreur"

"Laissez-moi vous raconter"

"Je vais vous révéler"

"Grâce à l'IA..."

"Le futur est..."

==========================
OBJECTIF
==========================

À la fin de la lecture, le lecteur doit penser :

"Je n'avais pas vu les choses comme ça."

Pas :

"Encore un post LinkedIn."

${formatInstructions}
`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    temperature: 0.9,
    messages: [
      { role: "user", content: prompt },
    ],
  });

  return message.content[0].text.trim();
}
