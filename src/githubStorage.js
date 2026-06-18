async function uploadToGitHub(buffer, path, commitMessage) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `${commitMessage} [skip ci]`,
        content: buffer.toString("base64"),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload to GitHub (${response.status}): ${error}`);
  }

  return `https://raw.githubusercontent.com/${repo}/main/${path}`;
}

function makeSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
}

export async function uploadImageToGitHub(imageBuffer, ideaTitle) {
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const path = `generated-images/${ts}-${makeSlug(ideaTitle)}.png`;
  return uploadToGitHub(imageBuffer, path, `chore: add image for "${ideaTitle}"`);
}

export async function uploadPDFToGitHub(pdfBuffer, ideaTitle) {
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const path = `generated-carousels/${ts}-${makeSlug(ideaTitle)}.pdf`;
  return uploadToGitHub(pdfBuffer, path, `chore: add carousel PDF for "${ideaTitle}"`);
}
