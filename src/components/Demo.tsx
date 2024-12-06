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
  const ethPrice = 3500; // Hardcoded ETH price
  const balance = "100,000"; // This should come from your actual balance logic
  const [leverage, setLeverage] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'long' | 'short' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState('ETH')
  const [inputAmount, setInputAmount] = useState<number | null>(null);

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

  const isAllSelected = () => {
    return selectedPosition !== null && 
           leverage !== null && 
           selectedAsset !== null && 
           inputAmount !== null && 
           inputAmount > 0;
  };

  const calculateLiquidationPrice = () => {
    if (!selectedPosition || !leverage) return null;
    
    if (selectedPosition === 'long') {
      return ethPrice * (1 - 1/leverage);
    } else {
      return ethPrice * (1 + 1/leverage);
    }
  };

  if (!isSDKLoaded) {
    return (
      <div className="w-full min-h-screen bg-black text-white lowercase font-mono flex items-center justify-center">
        {/* Loading state */}
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-black text-white lowercase font-mono flex flex-col">
      <span style={{ display: 'none' }}>{title}</span>
      
      {/* Header */}
      <div className="flex justify-between items-center h-[60px] px-4 mb-5">
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

      {/* Main content area */}
      <div className="flex flex-col items-center w-full gap-5">
        {/* ETH Asset Selection */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <button
              onClick={() => setSelectedAsset('ETH')}
              className="w-full h-[40px] px-4 rounded-md border border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase bg-zinc-800"
            >
              ⟠ eth
            </button>
          </div>
        </div>

        {/* Trading Buttons */}
        <div className="flex flex-col items-center w-full">
          <div className="grid grid-cols-2 h-full w-full max-w-[500px] px-4">
            <button 
              onClick={() => setSelectedPosition('long')}
              className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-l-md border border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase ${
                selectedPosition === 'long' ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
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
              className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-r-md border-t border-r border-b border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase ${
                selectedPosition === 'short' ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
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
        </div>

        {/* Amount Input */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <div className="relative flex items-center w-full">
              <input
                type="number"
                inputMode="numeric"
                step="1"
                pattern="\d*"
                placeholder="0"
                onChange={(e) => setInputAmount(e.target.value ? Number(e.target.value) : null)}
                className="w-full h-[40px] px-4 rounded-md border border-zinc-800 bg-transparent text-gray-400 font-mono text-sm lowercase focus:outline-none focus:border-zinc-700 text-left"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
              />
              <span className="absolute right-3 text-gray-400 pointer-events-none text-sm">
                $reward
              </span>
            </div>
          </div>
        </div>

        {/* Leverage Selection */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center w-full max-w-[500px] px-4">
            {[2, 5, 10, 50].map((value, index) => (
              <button
                key={value}
                onClick={() => setLeverage(value)}
                className={`
                  w-full h-[40px] px-1 sm:px-2 border-t border-b border-zinc-800 
                  ${index === 0 ? 'rounded-l-md border-l' : ''}
                  ${index === 3 ? 'rounded-r-md border-r' : 'border-r'}
                  text-gray-400 transition-colors font-mono text-sm lowercase
                  ${leverage === value ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}
                `}
              >
                {value}x
              </button>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <div className="flex flex-col gap-2 text-gray-400 font-mono text-sm w-full">
              <div className="flex justify-between">
                <span>entry price:</span>
                <span>${ethPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>liq. price:</span>
                <span>{
                  selectedPosition && leverage 
                    ? `$${Math.round(calculateLiquidationPrice() || 0).toLocaleString()}`
                    : '---'
                }</span>
              </div>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <button
              className={`
                w-full h-[40px] px-4 rounded-md border transition-all duration-150
                font-mono text-sm lowercase
                ${isAllSelected() 
                  ? 'border-zinc-400 text-black bg-white hover:bg-zinc-100 active:scale-[0.98]' 
                  : 'border-zinc-800 text-gray-400 bg-black hover:bg-zinc-900'
                }
                active:border-white focus:outline-none
              `}
            >
              place order
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full mt-5">
        <div className="flex justify-center items-center h-[72px] w-1/2 max-w-[500px] px-4 mx-auto">
          <div className="text-gray-400 font-mono text-sm">
            balance: {balance} $reward
          </div>
        </div>
      </div>
    </div>
  );
}

