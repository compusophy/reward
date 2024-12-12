import type { Metadata } from "next";
import Demo from "~/components/Demo";

export const metadata: Metadata = {
  title: "reward.wtf | dev",
  description: "reward dev page",
};

export default function DevPage() {
  return <Demo title="dev" />;
} 