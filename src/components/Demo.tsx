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
import Link from "next/link";
import { 
  recordVisitor, 
  getLeaderboard, 
  UserData, 
  getGlobalStats, 
  placeOrder, 
  getUserOrders,
  Order,
  closeOrder,
  db,
  ref 
} from "~/lib/firebase";
import { onValue } from "firebase/database";

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
  const ethPrice = 3500; // Hardcoded price
  const [leverage, setLeverage] = useState<number | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<'long' | 'short' | null>(null);
  const [selectedAsset, setSelectedAsset] = useState('ETH')
  const [inputAmount, setInputAmount] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [leaderboardData, setLeaderboardData] = useState<UserData[]>([]);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalVolume: number;
    totalTransactions: number;
    vault: {
      fees: number;
      debt: number;
      deposits: number;
    };
  }>({
    totalUsers: 0,
    totalVolume: 0,
    totalTransactions: 0,
    vault: {
      fees: 0,
      debt: 0,
      deposits: 0
    }
  });
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [hasOpenPosition, setHasOpenPosition] = useState(false);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const placeOrderHandler = async () => {
    if (!isAllSelected() || !context?.user?.fid) return;

    const success = await placeOrder(
      context.user.fid,
      selectedPosition!,
      leverage!,
      inputAmount!,
      ethPrice
    );

    if (success) {
      // Refresh user's balance from server
      const newBalance = await recordVisitor(
        context.user.fid,
        context.user.username,
        context.user.pfpUrl,
        address
      );
      setUserBalance(newBalance);
      
      // Refresh orders
      getUserOrders(context.user.fid).then(setUserOrders);

      // Reset form
      resetForm();
    }
  };

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

  // Modify the SDK load effect to use the local function
  useEffect(() => {
    const load = async () => {
      const frameContext = await sdk.context;
      
      const contextWithFallback = frameContext ?? {
        user: {
          fid: 1,
          username: 'farcaster',
          pfpUrl: 'https://i.imgur.com/I2rEbPF.png'
        }
      };
      
      setContext(contextWithFallback);
      
      // Use connected wallet address or fallback
      const userAddress = address || '0x000000000000000000000000000000000000dEaD';
      
      const balance = await recordVisitor(
        contextWithFallback.user.fid,
        contextWithFallback.user.username,
        contextWithFallback.user.pfpUrl,
        userAddress
      );
      
      setUserBalance(balance);
      
      sdk.actions.ready();
    };
    
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded, address]);

  const isAllSelected = () => {
    return selectedPosition !== null && 
           leverage !== null && 
           selectedAsset !== null && 
           inputAmount !== null && 
           inputAmount > 0 &&
           !hasOpenPosition;
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
  const [currentView, setCurrentView] = useState<'trade' | 'leaderboard' | 'info'>('trade');

  // Modify the router.push calls to use setState instead
  const navigateTo = (view: 'trade' | 'leaderboard' | 'info') => {
    setCurrentView(view);
    // Always use the view name in URL
    window.history.pushState({}, '', `/${view}`);
    // Update document title
    document.title = `reward.wtf | ${view}`;
  };

  // Update the initial route handling to properly handle /trade
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/leaderboard') {
      setCurrentView('leaderboard');
    } else if (path === '/info') {
      setCurrentView('info');
    } else if (path === '/trade' || path === '/') {
      setCurrentView('trade');
      // If we're at the root URL (/), update it to /trade
      if (path === '/') {
        window.history.pushState({}, '', '/trade');
      }
    }
  }, []);

  // Add effect to fetch stats when viewing info page
  useEffect(() => {
    if (currentView === 'info') {
      getGlobalStats().then(setStats);
    }
  }, [currentView]);

  const infoContent = (
    <div className="flex flex-col items-center w-full max-w-[500px] mx-auto px-4 gap-5">
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">total users:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.totalUsers}</span>
      </div>
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">total transactions:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.totalTransactions}</span>
      </div>
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">total volume:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.totalVolume.toLocaleString()}✵</span>
      </div>
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">vault fees:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.vault.fees.toLocaleString()}✵</span>
      </div>
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">vault debt:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.vault.debt.toLocaleString()}✵</span>
      </div>
      <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
        <span className="text-zinc-400 font-mono text-sm">vault deposits:</span>
        <span className="text-zinc-400 font-mono text-sm">{stats.vault.deposits.toLocaleString()}✵</span>
      </div>
    </div>
  );

  const leaderboardContent = (
    <div className="flex flex-col items-center w-full max-w-[500px] mx-auto px-4 gap-5">
      {leaderboardData.map((user, index) => (
        <div 
          key={user.fid}
          className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800"
        >
          <div className="flex items-center gap-3">
            <span className="text-zinc-400 font-mono text-sm">#{index + 1}</span>
            <Image
              src={user.pfpUrl}
              alt={user.username}
              width={20}
              height={20}
              className="rounded-full"
              {...imageConfig}
            />
            <span className="text-zinc-400 font-mono text-sm">
              @{user.username.toLowerCase()}
            </span>
          </div>
          <span className="text-zinc-400 font-mono text-sm">
            {user.balance.toLocaleString()}✵
          </span>
        </div>
      ))}
      {leaderboardData.length === 0 && (
        <div className="h-[40px] flex items-center text-zinc-400 font-mono text-sm">
          no users yet
        </div>
      )}
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
              className="w-full h-[40px] px-4 rounded-md border border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase bg-zinc-800"
            >
              ⟠ eth
            </button>
          </div>
        </div>
      </div>

      {/* Trading Buttons (Long/Short) */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="w-full grid grid-cols-2">
            <button 
              onClick={() => setSelectedPosition('long')}
              className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-l-md border border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase ${
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
              className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-r-md border-t border-r border-b border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase ${
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
          <div className="w-full relative">
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
                text-zinc-400 font-mono text-sm lowercase focus:outline-none 
                focus:border-zinc-700 text-left pr-10
                [appearance:textfield] 
                [&::-webkit-outer-spin-button]:appearance-none 
                [&::-webkit-inner-spin-button]:appearance-none
                transition-colors
                ${!isInputFocused && inputAmount ? 'bg-zinc-800' : 'bg-transparent'}
              `}
              onKeyDown={(e) => {
                if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                  e.preventDefault();
                }
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
            />
            <span className="absolute right-3 inset-y-0 flex items-center text-zinc-400 pointer-events-none text-sm">
              ✵
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
                  text-zinc-400 transition-colors font-mono text-sm lowercase
                  ${leverage === value ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}
                `}
              >
                {value}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Order Summary (Entry/Liq Price) */}
      <div className="flex flex-col items-center w-full">
        <div className="flex items-center justify-center w-full max-w-[500px] px-4">
          <div className="flex flex-col gap-2 font-mono text-sm w-full">
            <div className="flex justify-between">
              <span className="text-zinc-400 font-mono text-sm">entry price:</span>
              <span className="text-zinc-400">${ethPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 font-mono text-sm">liq. price:</span>
              <span className="text-zinc-400">{
                selectedPosition && leverage 
                  ? `$${Math.round(calculateLiquidationPrice() || 0).toLocaleString()}`
                  : '---'
              }</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400 font-mono text-sm">fee:</span>
              <span className="text-zinc-400">{
                inputAmount 
                  ? `${Math.max(0, Math.ceil(inputAmount * 0.01))}✵`
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
              onClick={placeOrderHandler}
              className={`
                w-full h-[40px] px-4 rounded-md border
                font-mono text-sm lowercase transition-all
                ${isAllSelected() && !hasOpenPosition 
                  ? 'border-green-500/50 text-green-400 hover:bg-green-500/10 cursor-pointer'
                  : 'border-green-500/10 text-green-400/20 cursor-not-allowed'
                }
              `}
            >
              ✓ place order
            </button>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-zinc-800" />

      {/* Open Orders */}
      <div className="flex items-center justify-center w-full max-w-[500px] px-4">
        <div className="w-full flex flex-col gap-5">
          {userOrders.map((order) => {
            const markPrice = ethPrice;
            const pnlPercent = order.position === 'long'
              ? ((markPrice - order.entryPrice) / order.entryPrice) * 100 * order.leverage
              : ((order.entryPrice - markPrice) / order.entryPrice) * 100 * order.leverage;

            return (
              <div key={order.id} className="w-full flex flex-col gap-5">
                {/* Main Info - Two Column Layout with 20px Gap */}
                <div className="flex w-full gap-5">
                  {/* Left Column - Position Details */}
                  <div className="flex flex-col gap-2 w-1/2">
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        type:
                      </span>
                      <span className="text-zinc-400 font-mono text-sm">
                        eth {order.position} {order.leverage}x
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        size:
                      </span>
                      <span className="text-zinc-400 font-mono text-sm">
                        {order.amount.toLocaleString()}✵
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        profit:
                      </span>
                      <span className={`font-mono text-sm ${
                        pnlPercent > 0 ? 'text-green-400' : pnlPercent < 0 ? 'text-red-400' : 'text-zinc-400'
                      }`}>
                        {pnlPercent > 0 ? '+' : ''}{Math.round(Math.abs(pnlPercent))}%
                      </span>
                    </div>
                  </div>

                  {/* Right Column - Prices */}
                  <div className="flex flex-col gap-2 w-1/2">
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        entry:
                      </span>
                      <span className="text-zinc-400 font-mono text-sm">
                        ${order.entryPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        liq:
                      </span>
                      <span className="text-zinc-400 font-mono text-sm">
                        ${Math.round(order.liquidationPrice).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-400 font-mono text-sm">
                        mark:
                      </span>
                      <span className="text-zinc-400 font-mono text-sm">
                        ${markPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => closeOrderHandler(order.id)}
                  className="w-full h-[40px] px-4 rounded-md border border-red-500/50 text-red-400 hover:bg-red-500/10 transition-colors font-mono text-sm"
                >
                  × close position
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // Main content conditional rendering
  const renderContent = () => {
    if (currentView === 'info') {
      return infoContent;
    }

    if (currentView === 'leaderboard') {
      return leaderboardContent;
    }

    return tradeContent;
  };

  // Add this effect to fetch leaderboard data
  useEffect(() => {
    if (currentView === 'leaderboard') {
      getLeaderboard().then(setLeaderboardData);
    }
  }, [currentView]);

  // Add effect to fetch orders when context changes
  useEffect(() => {
    if (context?.user?.fid) {
      getUserOrders(context.user.fid).then(orders => {
        setUserOrders(orders);
        setHasOpenPosition(orders.length > 0);
      });
    }
  }, [context?.user?.fid]);

  // Add closeOrderHandler
  const closeOrderHandler = async (orderId: string) => {
    if (!context?.user?.fid) return;
    
    const success = await closeOrder(context.user.fid, orderId);
    
    if (success) {
      // Refresh orders list and update hasOpenPosition
      getUserOrders(context.user.fid).then(orders => {
        setUserOrders(orders);
        setHasOpenPosition(orders.length > 0);
      });
      // Reset form when position is closed
      resetForm();
    }
  };

  // Add this effect to listen for balance changes
  useEffect(() => {
    if (context?.user?.fid) {
      const userRef = ref(db, `users/${context.user.fid}`);
      
      const unsubscribe = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          setUserBalance(userData.balance);
        }
      });

      // Cleanup subscription
      return () => unsubscribe();
    }
  }, [context?.user?.fid]);

  // Add form reset when changing pages
  useEffect(() => {
    // Reset form whenever view changes
    resetForm();
  }, [currentView]);

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
              href="/info" 
              onClick={(e) => {
                e.preventDefault();
                navigateTo('info');
              }}
              className={`flex items-center justify-center h-[40px] w-[40px] rounded-md border border-zinc-800 transition-colors
                ${currentView === 'info'
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
            <span className="text-zinc-400 font-mono text-sm">
              {userBalance.toLocaleString()}✵
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
                    className="rounded-full"
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
              className={`h-[40px] flex items-center justify-center gap-2 rounded-l-md border border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase
                ${currentView === 'leaderboard' 
                  ? "bg-zinc-800"
                  : "bg-black hover:bg-zinc-900"
                }`}
            >
              ≡ leaderboard
            </button>
            
            <button 
              onClick={() => navigateTo('trade')}
              className={`h-[40px] flex items-center justify-center gap-2 rounded-r-md border-t border-r border-b border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase
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
        <div className="w-full h-[40px] flex items-center justify-center text-sm text-zinc-400 rounded-md border border-zinc-800 hover:bg-zinc-800/50 transition-colors">
          @{context.user.username.toLowerCase()}
        </div>
      </div>
    )}
    {address && (
      <div className="mx-5">
        <div className="w-full h-[40px] flex items-center justify-center text-sm text-zinc-400 rounded-md border border-zinc-800 hover:bg-zinc-800/50 transition-colors">
          {`${address.slice(0, 6)}...${address.slice(-4)}`.toLowerCase()}
        </div>
      </div>
    )}
    <div className="mx-5">
      <button
        onClick={async () => {
          if (isConnected) {
            onDisconnect();
          } else {
            try {
              await onConnect();
            } catch (err) {
              console.log('Wallet connection failed or was rejected:', err);
            }
          }
        }}
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

