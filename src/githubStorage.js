export async function uploadImageToGitHub(imageBuffer, ideaTitle) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  }

  const slug = ideaTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const filename = `${ts}-${slug}.png`;
  const path = `generated-images/${filename}`;

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `chore: add generated image for "${ideaTitle}" [skip ci]`,
        content: imageBuffer.toString("base64"),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload image to GitHub (${response.status}): ${error}`);
  }

  return `https://raw.githubusercontent.com/${repo}/main/${path}`;
}
