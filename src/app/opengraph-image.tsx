import { ImageResponse } from "next/og";

export const alt = "reward.wtf";
export const size = {
  width: 600,
  height: 400,
};

export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div tw="h-full w-full flex items-center justify-center bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://reward.wtf/icon-transparent.png"
          alt="reward.wtf"
          width="80"
          height="80"
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
