const LINKEDIN_API_BASE = "https://api.linkedin.com";

export async function publishPost(text) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;
  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN is not set");
  if (!personId) throw new Error("LINKEDIN_PERSON_ID is not set");

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
