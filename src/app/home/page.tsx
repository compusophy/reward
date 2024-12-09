import type { Metadata } from "next";
import Demo from "~/components/Demo";

export const metadata: Metadata = {
  title: "reward.wtf | home",
  description: "home page",
};

export default function HomePage() {
  return <Demo title="home" />;
}
