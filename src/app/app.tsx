"use client";

import dynamic from "next/dynamic";

const Demo = dynamic(() => import("~/components/Demo"), {
  ssr: false,
});

interface AppProps {
  title?: string;
}

export default function App({ title }: AppProps) {
  return <Demo title={title} />;
}
