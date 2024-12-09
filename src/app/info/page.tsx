import type { Metadata } from "next";
import Demo from "~/components/Demo";

export const metadata: Metadata = {
  title: "reward.wtf | info",
  description: "reward info page",
};

export default function HomePage() {
  return <Demo title="info" />;
}
