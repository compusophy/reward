"use client";

import { useEffect, useCallback, useState } from "react";
import sdk, { type FrameContext } from "@farcaster/frame-sdk";
import {
  useAccount,
  useDisconnect,
  useConnect,
} from "wagmi";
import { config } from "~/components/providers/WagmiProvider";
import Image from 'next/image';

const imageConfig = {
  unoptimized: true,
  loader: ({ src }: { src: string }) => src,
};

interface DemoProps {
  title?: string;
}

export default function Demo({ title }: DemoProps): JSX.Element {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext>();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const balance = "10M"; // This should come from your actual balance logic
  const [leverage, setLeverage] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'long' | 'short' | null>(null);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const toggleProfileDropdown = useCallback(() => {
    setIsProfileDropdownOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const load = async () => {
      setContext(await sdk.context);
      sdk.actions.ready();
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        setEthPrice(data.ethereum.usd);
      } catch (error) {
        console.error('Failed to fetch ETH price:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEthPrice();
    const interval = setInterval(fetchEthPrice, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isSDKLoaded) {
    return (
      <div className="w-full min-h-screen bg-black text-white lowercase font-mono flex items-center justify-center">
        {/* Loading state */}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-black text-white lowercase font-mono">
      <span style={{ display: 'none' }}>{title}</span>
      <div className="flex justify-between items-center h-[72px] px-4 border-b border-zinc-800">
        <div className="flex items-center">
          <Image
            src="/freecast-logo.png"
            alt="Freecast Logo"
            width={40}
            height={40}
            className="rounded-full bg-black active:opacity-80"
            {...imageConfig}
          />
        </div>
        
        <div className="relative flex items-center">
          {context?.user?.pfpUrl && (
            <>
              <button
                onClick={toggleProfileDropdown}
                className="rounded-full bg-black flex items-center"
              >
                <Image
                  src={context.user.pfpUrl}
                  alt="Profile"
                  width={40}
                  height={40}
                  className="rounded-full"
                  {...imageConfig}
                />
              </button>
              
              {isProfileDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 min-w-[140px] bg-black rounded-lg shadow-lg py-3 flex flex-col gap-3">
                  {context?.user?.username && (
                    <div className="px-4 text-sm text-gray-300 text-center">
                      @{context.user.username.toLowerCase()}
                    </div>
                  )}
                  {address && (
                    <div className="px-4 text-sm text-gray-300 text-center">
                      {`${address.slice(0, 6)}...${address.slice(-4)}`.toLowerCase()}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (isConnected) {
                        disconnect();
                      } else {
                        connect({ connector: config.connectors[0] });
                      }
                      setIsProfileDropdownOpen(false);
                    }}
                    className={`mx-3 px-4 py-1.5 text-sm rounded-md border transition-colors ${
                      isConnected 
                        ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' 
                        : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
                    }`}
                  >
                    {isConnected ? 'disconnect' : 'connect'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center justify-center w-full">
        {/* Trading Buttons */}
        <div className="flex flex-col items-center w-full h-[72px]">
          <div className="flex justify-center gap-4 h-full items-center">
            <button 
              onClick={() => setSelectedPosition('long')}
              className={`min-w-[100px] flex items-center justify-center gap-2 px-4 py-1.5 rounded-md border border-zinc-800 text-gray-400 transition-colors font-mono lowercase ${
                selectedPosition === 'long' 
                  ? 'bg-zinc-800' 
                  : 'hover:bg-zinc-800/50'
              }`}
            >
              <span className="flex items-center">
                <svg height="9.856" viewBox="0 0 15.704 9.856" width="15.704" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="m529-488.59v5.67l-2.113-2.109-5.326 5.319-2.924-2.921-3.9 3.9-1.444-1.448 5.341-5.341 2.924 2.924 3.882-3.882-2.113-2.109z" 
                    fill="currentColor" 
                    transform="translate(-513.3 488.59)"
                  />
                </svg>
              </span>
              long
            </button>
            
            <button 
              onClick={() => setSelectedPosition('short')}
              className={`min-w-[100px] flex items-center justify-center gap-2 px-4 py-1.5 rounded-md border border-zinc-800 text-gray-400 transition-colors font-mono lowercase ${
                selectedPosition === 'short' 
                  ? 'bg-zinc-800' 
                  : 'hover:bg-zinc-800/50'
              }`}
            >
              <span className="flex items-center" style={{ transform: 'scale(-1, 1) rotate(180deg)' }}>
                <svg height="9.856" viewBox="0 0 15.704 9.856" width="15.704" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="m529-488.59v5.67l-2.113-2.109-5.326 5.319-2.924-2.921-3.9 3.9-1.444-1.448 5.341-5.341 2.924 2.924 3.882-3.882-2.113-2.109z" 
                    fill="currentColor" 
                    transform="translate(-513.3 488.59)"
                  />
                </svg>
              </span>
              short
            </button>
          </div>
          <div className="w-full h-px bg-zinc-800" />
        </div>

        {/* Amount Input */}
        <div className="flex flex-col items-center w-full h-[72px]">
          <div className="flex justify-center h-full items-center">
            <div className="relative flex items-center w-[200px]">
              <input
                type="number"
                inputMode="numeric"
                step="1"
                pattern="\d*"
                placeholder="0"
                className="w-full px-4 py-1.5 rounded-md border border-zinc-800 bg-transparent text-gray-400 font-mono lowercase focus:outline-none focus:border-zinc-700 text-left"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
              />
              <span className="absolute right-3 text-gray-400 pointer-events-none">
                $reward
              </span>
            </div>
          </div>
          <div className="w-full h-px bg-zinc-800" />
        </div>

        {/* Leverage Selection */}
        <div className="flex flex-col items-center w-full h-[72px]">
          <div className="flex justify-center gap-4 h-full items-center">
            {[1, 10, 100].map((value) => (
              <button
                key={value}
                onClick={() => setLeverage(value)}
                className={`px-4 py-1.5 rounded-md border border-zinc-800 text-gray-400 transition-colors font-mono lowercase ${
                  leverage === value 
                    ? 'bg-zinc-800' 
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                {value}x
              </button>
            ))}
          </div>
          <div className="w-full h-px bg-zinc-800" />
        </div>

        {/* Place Order Button */}
        <div className="flex flex-col items-center w-full h-[72px]">
          <div className="flex justify-center h-full items-center">
            <button
              className="px-4 py-1.5 rounded-md border border-zinc-800 text-gray-400 font-mono lowercase bg-zinc-800/30 min-w-[200px]"
            >
              place order
            </button>
          </div>
          <div className="w-full h-px bg-zinc-800" />
        </div>

        {/* Balance and Price Display */}
        <div className="flex flex-col justify-center h-[72px] w-full text-gray-400 text-center">
          <div>balance: {balance} $reward</div>
          <div>{isLoading ? 'loading...' : `$${ethPrice?.toLocaleString()}`}</div>
        </div>
      </div>
    </div>
  );
}

