const LINKEDIN_API_BASE = "https://api.linkedin.com";

async function registerImageUpload(accessToken, personId) {
  const body = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: `urn:li:person:${personId}`,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        },
      ],
    },
  };

  const response = await fetch(
    `${LINKEDIN_API_BASE}/v2/assets?action=registerUpload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to register image upload (${response.status}): ${error}`
    );
  }

  const data = await response.json();
  const uploadUrl =
    data.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  const asset = data.value.asset;
  return { uploadUrl, asset };
}

async function uploadImageBinary(uploadUrl, imageBuffer, accessToken) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "image/png",
    },
    body: imageBuffer,
  });

  // LinkedIn returns 201 on success for binary uploads
  if (!response.ok && response.status !== 201) {
    const error = await response.text();
    throw new Error(`Failed to upload image binary (${response.status}): ${error}`);
  }
}

export async function publishPost(text, imageBuffer) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;
  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN is not set");
  if (!personId) throw new Error("LINKEDIN_PERSON_ID is not set");

  let media;
  if (imageBuffer) {
    console.log("Uploading image to LinkedIn...");
    const { uploadUrl, asset } = await registerImageUpload(accessToken, personId);
    await uploadImageBinary(uploadUrl, imageBuffer, accessToken);
    media = [{ status: "READY", media: asset }];
  }

  const shareContent = {
    shareCommentary: { text },
    shareMediaCategory: imageBuffer ? "IMAGE" : "NONE",
    ...(media && { media }),
  };

  const body = {
    author: `urn:li:person:${personId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": shareContent,
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
