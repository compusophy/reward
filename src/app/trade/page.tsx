import type { Metadata } from "next";
import Demo from "~/components/Demo";

export const metadata: Metadata = {
  title: "reward.wtf | trade",
  description: "trade page",
};

export default function TradePage() {
  return <Demo title="trade" />;
} 