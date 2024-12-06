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
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-black">
      
        <div tw="flex items-center">
          <h1 tw="text-6xl text-white font-mono lowercase">reward.wtf</h1>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
