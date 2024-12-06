import { Metadata } from "next";
import React from 'react';
import App from '../../../app';

const appUrl = process.env.NEXT_PUBLIC_URL;

interface Props {
  params: Promise<{
    name: string;
  }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;

  const frame = {
    version: "next",
    imageUrl: `${appUrl}/frames/hello/${name}/opengraph-image`,
    button: {
      title: "launch app",
      action: {
        type: "launch_frame",
        name: "reward.wtf",
        url: `${appUrl}/frames/hello/${name}/`,
        splashImageUrl: `${appUrl}/splash.png`,
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: `Hello, ${name}`,
    description: `A personalized hello frame for ${name}`,
    openGraph: {
      title: `Hello, ${name}`,
      description: `A personalized hello frame for ${name}`,
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default async function HelloNameFrame({ params }: Props) {
  const { name } = await params;

  return <App title={`Hello, ${name}`} />;
}
