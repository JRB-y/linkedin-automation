import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generatePost(idea, tone) {
  const message = await client.messages.create({
    model: "claude-opus-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Tu es un expert en personal branding LinkedIn. Tu dois écrire un post LinkedIn à partir d'une idée brute, en respectant scrupuleusement le ton et le style décrits.

## Ton et style à respecter
${tone}

## Idée brute
${idea}

## Instructions
- Écris uniquement le texte du post, sans titre ni commentaire
- Respecte le ton et le style décrits ci-dessus
- Maximum 1300 caractères
- Le post doit être immédiatement publiable tel quel`,
      },
    ],
  });

  return message.content[0].text.trim();
}
