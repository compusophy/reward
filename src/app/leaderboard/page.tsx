import type { Metadata } from "next";
import Demo from "~/components/Demo";

export const metadata: Metadata = {
  title: "reward.wtf | leaderboard",
  description: "leaderboard page",
};

export default function LeaderboardPage() {
  return <Demo title="leaderboard" />;
} 