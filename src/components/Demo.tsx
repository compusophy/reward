"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, { type FrameContext } from "@farcaster/frame-sdk";
import {
  useAccount,
  useDisconnect,
  useConnect,
} from "wagmi";
import { config } from "~/components/providers/WagmiProvider";
import Image from 'next/image';
import { usePathname } from "next/navigation";
import Link from "next/link";

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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const ethPrice = 3500; // Hardcoded ETH price
  const [leverage, setLeverage] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'long' | 'short' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState('ETH')
  const [inputAmount, setInputAmount] = useState<number | null>(null);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const pathname = usePathname();

  const isHomePage = pathname === "/home";
  const isLeaderboardPage = pathname === "/leaderboard";

  const toggleProfileDropdown = useCallback(() => {
    setIsProfileDropdownOpen((prev) => !prev);
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle clicking outside of dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node) &&
        isProfileDropdownOpen
      ) {
        setIsProfileDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

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

  const resetForm = () => {
    setSelectedPosition(null);
    setLeverage(null);
    setInputAmount(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Add a new state to control the current view
  const [currentView, setCurrentView] = useState<'trade' | 'leaderboard' | 'home'>('trade');

  // Modify the router.push calls to use setState instead
  const navigateTo = (view: 'trade' | 'leaderboard' | 'home') => {
    setCurrentView(view);
    // Update URL without full navigation
    window.history.pushState({}, '', view === 'trade' ? '/' : `/${view}`);
  };

  // Add this effect to handle initial route
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/leaderboard') {
      setCurrentView('leaderboard');
    } else if (path === '/home') {
      setCurrentView('home');
    } else {
      setCurrentView('trade');
    }
  }, []);

  // Pre-load the content for different views
  const homeContent = (
    <div className="flex items-center justify-center flex-1">
      <span className="text-gray-400 font-mono">home</span>
    </div>
  );

  const leaderboardContent = (
    <div className="flex items-center justify-center flex-1">
      <span className="text-gray-400 font-mono">leaderboard</span>
    </div>
  );

  const tradeContent = (
    <div className="flex flex-col items-center w-full gap-5">
      {/* ETH Asset Selection */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="w-full">
            <button
              onClick={() => setSelectedAsset('ETH')}
              className="w-full h-[40px] px-4 rounded-md border border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase bg-zinc-800"
            >
              ⟠ eth
            </button>
          </div>
        </div>
      </div>

      {/* Trading Buttons */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="w-full grid grid-cols-2">
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
      </div>

      {/* Amount Input */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="relative flex items-center w-full">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              pattern="\d*"
              placeholder="0"
              onFocus={(e) => {
                e.target.placeholder = '';
                setIsInputFocused(true);
              }}
              onBlur={(e) => {
                if (!e.target.value) {
                  e.target.placeholder = '0';
                }
                setIsInputFocused(false);
              }}
              onChange={(e) => {
                // Convert to integer and ensure it's positive
                const value = Math.floor(Math.abs(Number(e.target.value)));
                if (e.target.value === '') {
                  setInputAmount(null);
                  e.target.value = '';
                } else {
                  setInputAmount(value);
                  e.target.value = value.toString();
                }
              }}
              className={`
                w-full h-[40px] px-4 rounded-md border border-zinc-800 
                text-gray-400 font-mono text-sm lowercase focus:outline-none 
                focus:border-zinc-700 text-left 
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none
                transition-colors
                ${!isInputFocused && inputAmount ? 'bg-zinc-800' : 'bg-transparent'}
              `}
              onKeyDown={(e) => {
                // Prevent decimal point
                if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                  e.preventDefault();
                }
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
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="w-full flex">
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
          <div className="w-full">
            <button
              disabled={!isAllSelected()}
              onClick={() => {
                // Here you could add API call or other order processing logic
                resetForm();
              }}
              className={`
                w-full h-[40px] px-4 rounded-md border
                font-mono text-sm lowercase transition-all
                ${isAllSelected() 
                  ? 'border-zinc-800 bg-transparent text-gray-400 cursor-pointer hover:bg-zinc-800 active:bg-zinc-800'
                  : 'border-zinc-800/30 bg-transparent text-gray-400/30 cursor-not-allowed'
                }
              `}
            >
              ✓ place order
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Main content conditional rendering
  const renderContent = () => {
    if (isHomePage) {
      return homeContent;
    }

    if (isLeaderboardPage) {
      return leaderboardContent;
    }

    return tradeContent;
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
      
      {/* Header - Fixed at top */}
      <header className="flex flex-col">
        <div className="relative flex justify-between h-[80px] w-full max-w-[500px] mx-auto px-4">
          <div className="flex items-center">
            <Link 
              href="/home" 
              className={`flex items-center justify-center h-[40px] w-[40px] rounded-md border border-zinc-800 transition-colors
                ${isHomePage 
                  ? 'bg-zinc-800' 
                  : 'bg-black hover:bg-zinc-800/50 active:opacity-80'
                }`}
            >
              <Image
                src="/icon-transparent.png"
                alt="Reward Logo"
                width={20}
                height={20}
                {...imageConfig}
              />
            </Link>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <span className="text-gray-400 font-mono text-sm">
              1,000,000 ✵
            </span>
          </div>

          <div className="flex items-center">
            {context?.user?.pfpUrl && (
              <>
                <button
                  ref={buttonRef}
                  onClick={toggleProfileDropdown}
                  className={`flex items-center justify-center h-[40px] w-[40px] rounded-md border border-zinc-800 transition-colors
                    ${isProfileDropdownOpen 
                      ? 'bg-zinc-800' 
                      : 'bg-black hover:bg-zinc-800/50 active:opacity-80'
                    }`}
                >
                  <Image
                    src={context.user.pfpUrl}
                    alt="Profile"
                    width={20}
                    height={20}
                    {...imageConfig}
                  />
                </button>
                
                {isProfileDropdownOpen && (
                  <div ref={dropdownRef}>
                    <ProfileDropdown
                      isConnected={isConnected}
                      context={context}
                      address={address}
                      onDisconnect={() => {
                        disconnect();
                        setIsProfileDropdownOpen(false);
                      }}
                      onConnect={() => {
                        connect({ connector: config.connectors[0] });
                        setIsProfileDropdownOpen(false);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="w-full h-px bg-zinc-800" />
      </header>

      {/* Main - Takes remaining space with padding */}
      <main className="flex-1 flex flex-col">
        <div className="w-full pt-5">
          {renderContent()}
        </div>
      </main>

      {/* Footer - Fixed at bottom */}
      <footer className="w-full">
        <div className="w-full h-px bg-zinc-800" />
        <div className="flex items-center h-[80px] w-full max-w-[500px] px-4 mx-auto">
          <div className="w-full grid grid-cols-2">
            <button 
              onClick={() => navigateTo('leaderboard')}
              className={`h-[40px] flex items-center justify-center gap-2 rounded-l-md border border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase
                ${currentView === 'leaderboard' 
                  ? "bg-zinc-800"
                  : "bg-black hover:bg-zinc-900"
                }`}
            >
              ≡ leaderboard
            </button>
            
            <button 
              onClick={() => navigateTo('trade')}
              className={`h-[40px] flex items-center justify-center gap-2 rounded-r-md border-t border-r border-b border-zinc-800 text-gray-400 transition-colors font-mono text-sm lowercase
                ${currentView === 'trade'
                  ? "bg-zinc-800"
                  : "bg-black hover:bg-zinc-900"
                }`}
            >
              ⇌ trade
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

const ProfileDropdown = ({ 
  isConnected, 
  context, 
  address, 
  onDisconnect, 
  onConnect 
}: { 
  isConnected: boolean;
  context: FrameContext | undefined;
  address: string | undefined;
  onDisconnect: () => void;
  onConnect: () => void;
}) => (
  <div className="absolute right-4 top-[80px] w-[calc(50%-16px)] bg-black rounded-lg border border-zinc-800 shadow-lg py-5 flex flex-col gap-5 z-10">
    {context?.user?.username && (
      <div className="mx-5">
        <div className="w-full h-[40px] flex items-center justify-center text-sm text-gray-300 rounded-md border border-zinc-800 hover:bg-zinc-800/50 transition-colors">
          @{context.user.username.toLowerCase()}
        </div>
      </div>
    )}
    {address && (
      <div className="mx-5">
        <div className="w-full h-[40px] flex items-center justify-center text-sm text-gray-300 rounded-md border border-zinc-800 hover:bg-zinc-800/50 transition-colors">
          {`${address.slice(0, 6)}...${address.slice(-4)}`.toLowerCase()}
        </div>
      </div>
    )}
    <div className="mx-5">
      <button
        onClick={isConnected ? onDisconnect : onConnect}
        className={`w-full h-[40px] flex items-center justify-center text-sm rounded-md border transition-colors ${
          isConnected 
            ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' 
            : 'border-green-500/50 text-green-400 hover:bg-green-500/10'
        }`}
      >
        {isConnected ? 'disconnect' : 'connect'}
      </button>
    </div>
  </div>
);
