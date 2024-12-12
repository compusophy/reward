import {
  SendNotificationRequest,
  sendNotificationResponseSchema,
} from "@farcaster/frame-sdk";
import { NextRequest } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  token: z.string(),
  url: z.string(),
  targetUrl: z.string(),
  title: z.string().max(32).optional(),
  body: z.string().max(128).optional(),
});

export async function POST(request: NextRequest) {
  const requestJson = await request.json();
  const requestBody = requestSchema.safeParse(requestJson);

  if (requestBody.success === false) {
    return Response.json(
      { success: false, errors: requestBody.error.errors },
      { status: 400 }
    );
  }

  const response = await fetch(requestBody.data.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notificationId: crypto.randomUUID(),
      title: requestBody.data.title || "Hello from Frames v2!",
      body: requestBody.data.body || "This is a test notification",
      targetUrl: requestBody.data.targetUrl,
      tokens: [requestBody.data.token],
    } satisfies SendNotificationRequest),
  });

  const responseJson = await response.json();

  if (response.status === 200) {
    // Ensure correct response
    const responseBody = sendNotificationResponseSchema.safeParse(responseJson);
    if (responseBody.success === false) {
      return Response.json(
        { success: false, errors: responseBody.error.errors },
        { status: 500 }
      );
    }

    // Return the full response including invalidTokens and rateLimitedTokens
    return Response.json({ success: true, result: responseBody.data.result });
  } else {
    return Response.json(
      { success: false, error: responseJson },
      { status: 500 }
    );
  }
}
