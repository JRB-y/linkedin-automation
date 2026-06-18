const LINKEDIN_API_BASE = "https://api.linkedin.com";

async function getPersonId(accessToken) {
  const response = await fetch(`${LINKEDIN_API_BASE}/v2/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get person ID (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.id;
}

export async function publishPost(text) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN is not set");

  const personId = await getPersonId(accessToken);

  const body = {
    author: `urn:li:person:${personId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch(`${LINKEDIN_API_BASE}/v2/ugcPosts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to publish post (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.id;
}
