import { eventPayloadSchema } from "@farcaster/frame-sdk";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const requestJson = await request.json();

  let data;
  try {
    const payloadData = JSON.parse(
      Buffer.from(requestJson.payload, "base64url").toString("utf-8")
    );
    const payload = eventPayloadSchema.safeParse(payloadData);

    if (payload.success === false) {
      return Response.json(
        { success: false, errors: payload.error.errors },
        { status: 400 }
      );
    }

    data = payload.data;
  } catch {
    return Response.json({ success: false }, { status: 500 });
  }

  const fid = requestJson.fid;

  // Just log events, don't try to store them
  switch (data.event) {
    case "frame_added":
      console.log(
        data.notificationDetails
          ? `Got frame_added event for fid ${fid} with notification token ${data.notificationDetails.token} and url ${data.notificationDetails.url}`
          : `Got frame_added event for fid ${fid} with no notification details`
      );
      break;
    case "frame_removed":
      console.log(`Got frame_removed event for fid ${fid}`);
      break;
    case "notifications_enabled":
      console.log(
        `Got notifications_enabled event for fid ${fid} with token ${
          data.notificationDetails.token
        } and url ${data.notificationDetails.url}`
      );
      break;
    case "notifications_disabled":
      console.log(`Got notifications_disabled event for fid ${fid}`);
      break;
  }

  return Response.json({ success: true });
}
