"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const imageConfig = {
  unoptimized: true,
  loader: ({ src }: { src: string }) => src,
};

export default function Home() {
  const router = useRouter();

  return (
    <div className="w-full min-h-screen bg-black text-white lowercase font-mono flex flex-col">
      {/* Header */}
      <div className="flex flex-col">
        <div className="relative flex justify-between h-[80px] w-full max-w-[500px] mx-auto px-4">
          <div className="flex items-center">
            <Link href="/home" className="flex items-center">
              <Image
                src="/icon-negated.png"
                alt="Freecast Logo"
                width={40}
                height={40}
                className="rounded-full bg-black border border-zinc-800 hover:bg-zinc-800/50 transition-colors active:opacity-80"
                {...imageConfig}
              />
            </Link>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button 
              onClick={() => router.push("/")}
              className="h-[40px] px-4 rounded-md border border-zinc-800 text-gray-400 bg-black hover:bg-zinc-900 transition-colors font-mono text-sm lowercase"
            >
              trade
            </button>
          </div>

          <div className="flex items-center w-[40px]" /> {/* Spacer for alignment */}
        </div>
        <div className="w-full h-px bg-zinc-800" />
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center flex-1">
        <span className="text-gray-400 font-mono">home</span>
      </div>

      {/* Footer */}
      <div className="w-full">
        <div className="w-full h-px bg-zinc-800" />
        <div className="flex justify-center items-center h-[80px] w-full max-w-[500px] px-4 mx-auto">
          <button 
            className="h-[40px] px-4 rounded-md border border-zinc-800 text-gray-400 bg-black hover:bg-zinc-900 transition-colors font-mono text-sm lowercase"
            onClick={() => router.push("/leaderboard")}
          >
            leaderboard
          </button>
        </div>
      </div>
    </div>
  );
}
