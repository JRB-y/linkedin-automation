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
  // /v2/assets with feedshare-document — serviceRelationships removed (deprecated field)
  const response = await fetch(
    `${LINKEDIN_API_BASE}/v2/assets?action=registerUpload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-document"],
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
  const uploadUrl =
    data.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  return { uploadUrl, asset: data.value.asset };
}

export async function publishCarousel(caption, pdfBuffer, title) {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personId = process.env.LINKEDIN_PERSON_ID;
  if (!accessToken) throw new Error("LINKEDIN_ACCESS_TOKEN is not set");
  if (!personId) throw new Error("LINKEDIN_PERSON_ID is not set");

  console.log("Uploading PDF to LinkedIn...");
  const { uploadUrl, asset } = await registerDocumentUpload(accessToken, personId);

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

  const body = {
    author: `urn:li:person:${personId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: caption },
        shareMediaCategory: "DOCUMENT",
        media: [{ status: "READY", media: asset, title: { text: title } }],
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
    throw new Error(`Failed to publish carousel (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.id;
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
