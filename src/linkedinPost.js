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

async function registerDocumentUpload(accessToken, personId) {
  // New LinkedIn REST API (2023+) — replaces deprecated /v2/assets for documents
  const response = await fetch(
    `${LINKEDIN_API_BASE}/rest/documents?action=initializeUpload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": "202306",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: `urn:li:person:${personId}`,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to register document upload (${response.status}): ${error}`);
  }

  const data = await response.json();
  return {
    uploadUrl: data.value.uploadUrl,
    document: data.value.document, // urn:li:document:...
  };
}

export async function publishCarousel(caption, pdfBuffer, title) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;
  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN is not set");
  if (!personId) throw new Error("LINKEDIN_PERSON_ID is not set");

  console.log("Uploading PDF to LinkedIn...");
  const { uploadUrl, document } = await registerDocumentUpload(accessToken, personId);

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    body: pdfBuffer,
  });

  if (!uploadResponse.ok && uploadResponse.status !== 201) {
    const error = await uploadResponse.text();
    throw new Error(`Failed to upload PDF (${uploadResponse.status}): ${error}`);
  }

  // Use newer /rest/posts API (required when using /rest/documents)
  const body = {
    author: `urn:li:person:${personId}`,
    commentary: caption,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      document: {
        altText: title,
        id: document,
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch(`${LINKEDIN_API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202306",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to publish carousel (${response.status}): ${error}`);
  }

  // /rest/posts returns the post URN in the x-restli-id header (no JSON body)
  return response.headers.get("x-restli-id") ?? "unknown";
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
