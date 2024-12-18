/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import sdk, {
  FrameNotificationDetails,
  type FrameContext,
  type FrameLocationContext,
} from "@farcaster/frame-sdk";
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
  requestOpenPosition, 
  requestClosePosition,
  getUserOrders,
  Order,
  db,
  ref,
  subscribeToUserOrders
} from "~/lib/firebase";
import { onValue } from "firebase/database";
import { Button } from "~/components/ui/Button";

const imageConfig = {
  unoptimized: true,
  loader: ({ src }: { src: string }) => src,
};

interface DemoProps {
  title?: string;
}

const STORAGE_KEY = 'frame_notification_details';

const saveNotificationDetails = (details: FrameNotificationDetails) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(details));
  } catch (e) {
    console.error('Failed to save notification details:', e);
  }
};

const loadNotificationDetails = (): FrameNotificationDetails | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Failed to load notification details:', e);
    return null;
  }
};

export default function Demo({ title }: DemoProps): JSX.Element {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<FrameContext>();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
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
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isClosingOrder, setIsClosingOrder] = useState<string | null>(null);
  const [serverPrice, setServerPrice] = useState<number | null>(null);
  const [notificationDetails, setNotificationDetails] = useState<FrameNotificationDetails | null>(null);
  const [sendNotificationResult, setSendNotificationResult] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [addFrameResult, setAddFrameResult] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  const addFrame = useCallback(async () => {
    try {
      setAddFrameResult("");
      setNotificationDetails(null);

      const result = await sdk.actions.addFrame();

      if (result.added) {
        if (result.notificationDetails) {
          saveNotificationDetails(result.notificationDetails);
          setNotificationDetails(result.notificationDetails);
          setIsSubscribed(true);
          setAddFrameResult(
            `✓ Frame added! Notifications enabled with token: ${result.notificationDetails.token.slice(0,8)}...`
          );
        } else {
          setAddFrameResult("✓ Frame added, but notifications not enabled");
        }
      } else {
        setAddFrameResult(result.reason === 'invalid_domain_manifest' 
          ? "Error: Invalid domain manifest"
          : result.reason === 'rejected_by_user'
          ? "Frame add request was rejected"
          : `Not added: ${result.reason}`);
      }
    } catch (error) {
      setAddFrameResult(`Error: ${error}`);
    }
  }, []);

  const sendNotification = useCallback(async () => {
    if (!notificationDetails) return;
    setSendNotificationResult("");

    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: notificationDetails.token,
          url: notificationDetails.url,
          targetUrl: window.location.href,
          title: "Test Notification",
          body: "This is a test notification from the Frame demo"
        }),
      });

      if (response.status === 200) {
        const data = await response.json();
        if (data.result.invalidTokens.length) {
          setIsSubscribed(false);
          setSendNotificationResult("Token is no longer valid - please resubscribe");
        } else if (data.result.rateLimitedTokens.length) {
          setSendNotificationResult("Rate limited - please try again later");
        } else {
          setSendNotificationResult("Notification sent successfully!");
        }
        return;
      }

      setSendNotificationResult(`Error: ${await response.text()}`);
    } catch (error) {
      setSendNotificationResult(`Error: ${error}`);
    }
  }, [notificationDetails]);

  useEffect(() => {
    const serverPriceRef = ref(db, 'serverPrice');
    return onValue(serverPriceRef, (snapshot) => {
      if (snapshot.exists()) {
        setServerPrice(snapshot.val().price);
      }
    });
  }, []);

  const placeOrderHandler = async () => {
    if (!isAllSelected() || !context?.user?.fid || isPlacingOrder || !serverPrice) return;

    try {
      setIsPlacingOrder(true);
      
      const success = await requestOpenPosition(
        context.user.fid,
        selectedPosition!,
        leverage!,
        inputAmount!
      );

      if (success) {
        // Reset form immediately
        resetForm();
        
        // Refresh data in background
        Promise.all([
          getUserOrders(context.user.fid).then(orders => {
            setUserOrders(orders);
            setHasOpenPosition(orders.length > 0);
          }),
          // User balance will update automatically via onValue listener
        ]);
      }
    } finally {
      setIsPlacingOrder(false);
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
      
      // Add this check for notification clicks
      if (frameContext?.location?.type === 'notification') {
        const notificationContext = frameContext.location as FrameLocationContext;
        console.log('Notification clicked:', notificationContext);
      }
      
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
    if (!selectedPosition || !leverage || !serverPrice) return null;
    
    if (selectedPosition === 'long') {
      return serverPrice * (1 - 1/leverage);
    } else {
      return serverPrice * (1 + 1/leverage);
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
  const [currentView, setCurrentView] = useState<'trade' | 'leaderboard' | 'info' | 'dev'>('trade');

  // Modify the router.push calls to use setState instead
  const navigateTo = (view: 'trade' | 'leaderboard' | 'info' | 'dev') => {
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
    } else if (path === '/dev') {
      // Redirect non-authorized users
      if (context?.user?.fid !== 350911) {
        window.history.pushState({}, '', '/info');
        setCurrentView('info');
      } else {
        setCurrentView('dev');
      }
    } else if (path === '/trade' || path === '/') {
      setCurrentView('trade');
      // If we're at the root URL (/), update it to /trade
      if (path === '/') {
        window.history.pushState({}, '', '/trade');
      }
    }
  }, [context?.user?.fid]);

  // Add effect to fetch stats when viewing info page
  useEffect(() => {
    if (currentView === 'info') {
      getGlobalStats().then(setStats);
    }
  }, [currentView]);

  const infoContent = (
    <div className="flex flex-col items-center w-full max-w-[500px] mx-auto px-4 gap-5 pt-5">
      <div className="flex flex-col gap-5 w-full">
        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">total_users:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.totalUsers.toLocaleString()}</span>
        </div>

        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">total_volume:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.totalVolume.toLocaleString()}✵</span>
        </div>

        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">total_transactions:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.totalTransactions.toLocaleString()}</span>
        </div>

        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">vault_fees:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.vault.fees.toLocaleString()}✵</span>
        </div>

        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">vault_debt:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.vault.debt.toLocaleString()}✵</span>
        </div>

        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">vault_deposits:</span>
          <span className="text-zinc-400 font-mono text-sm">{stats.vault.deposits.toLocaleString()}✵</span>
        </div>

        {/* Dev button - only visible to FID 350911 */}
        {context?.user?.fid === 350911 && (
          <button
            onClick={() => navigateTo('dev')}
            className="w-full h-[40px] flex items-center justify-center px-4 rounded-md border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 transition-colors font-mono text-sm"
          >
            dev mode
          </button>
        )}
      </div>
    </div>
  );

  const leaderboardContent = (
    <div className="flex flex-col items-center w-full max-w-[500px] mx-auto px-4 gap-5 pt-5">
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
          ...
        </div>
      )}
    </div>
  );

  const tradeContent = (
    <div className="flex flex-col items-center w-full h-full">
      {/* Main trading content - Starts after header, grows from top */}
      <div className="flex flex-col items-center w-full gap-5 pt-5">
        {/* ETH Asset Selection */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <div className="w-full">
              <button
                onClick={() => setSelectedAsset('ETH')}
                disabled={hasOpenPosition}
                className={`w-full h-[40px] px-4 rounded-md border border-zinc-800 transition-colors font-mono text-sm lowercase ${
                  hasOpenPosition 
                    ? 'opacity-20 cursor-not-allowed bg-transparent text-zinc-400/20'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
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
                disabled={hasOpenPosition}
                className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-l-md border border-zinc-800 transition-colors font-mono text-sm lowercase ${
                  hasOpenPosition 
                    ? 'opacity-20 cursor-not-allowed text-zinc-400/20'
                    : selectedPosition === 'long' 
                      ? 'bg-zinc-800 text-zinc-400' 
                      : 'hover:bg-zinc-800/50 text-zinc-400'
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
                disabled={hasOpenPosition}
                className={`w-full h-[40px] flex items-center justify-center gap-2 rounded-r-md border-t border-r border-b border-zinc-800 text-zinc-400 transition-colors font-mono text-sm lowercase ${
                  hasOpenPosition 
                    ? 'opacity-20 cursor-not-allowed text-zinc-400/20'
                    : selectedPosition === 'short' 
                      ? 'bg-zinc-800 text-zinc-400' 
                      : 'hover:bg-zinc-800/50 text-zinc-400'
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
                onKeyDown={(e) => {
                  if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                    e.preventDefault();
                  }
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="opacity-0 absolute inset-0 w-full h-full"
              />
              {/* Display element */}
              <div className={`
                w-full h-[40px] px-4 rounded-md border border-zinc-800 
                font-mono text-sm lowercase focus:outline-none 
                focus:border-zinc-700 text-left pr-10
                transition-colors flex items-center
                ${hasOpenPosition ? 'opacity-20 cursor-not-allowed text-zinc-400/20' : 'text-zinc-400'}
                ${!isInputFocused && inputAmount ? 'bg-zinc-800' : 'bg-transparent'}
              `}>
                {inputAmount ? inputAmount.toLocaleString() : '0'}
              </div>
              <span className={`absolute right-3 inset-y-0 flex items-center pointer-events-none text-sm ${
                hasOpenPosition ? 'text-zinc-400/20' : 'text-zinc-400'
              }`}>
                ✵
              </span>
            </div>
          </div>
        </div>

        {/* Leverage Selection */}
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <div className="w-full flex">
              {[10, 100, 1000].map((value, index) => (
                <button
                  key={value}
                  onClick={() => setLeverage(value)}
                  disabled={hasOpenPosition}
                  className={`
                    w-full h-[40px] px-1 sm:px-2 border-t border-b border-zinc-800 
                    ${index === 0 ? 'rounded-l-md border-l' : ''}
                    ${index === 3 ? 'rounded-r-md border-r' : 'border-r'}
                    font-mono text-sm lowercase transition-colors
                    ${hasOpenPosition 
                      ? 'opacity-20 cursor-not-allowed text-zinc-400/20'
                      : leverage === value 
                        ? 'bg-zinc-800 text-zinc-400' 
                        : 'hover:bg-zinc-800/50 text-zinc-400'
                    }
                  `}
                >
                  {value.toLocaleString()}x
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
                <span className={`font-mono text-sm ${hasOpenPosition ? 'text-zinc-500/20' : 'text-zinc-500'}`}>
                  entry price:
                </span>
                <span className={hasOpenPosition ? 'text-zinc-400/20' : 'text-zinc-400'}>
                  {hasOpenPosition ? '---' : serverPrice ? `$${Math.round(serverPrice).toLocaleString()}` : '---'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`font-mono text-sm ${hasOpenPosition ? 'text-zinc-500/20' : 'text-zinc-500'}`}>
                  liq. price:
                </span>
                <span className={hasOpenPosition ? 'text-zinc-400/20' : 'text-zinc-400'}>
                  {hasOpenPosition ? '---' : (
                    selectedPosition && leverage 
                      ? `$${Math.round(calculateLiquidationPrice() || 0).toLocaleString()}`
                      : '---'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={`font-mono text-sm ${hasOpenPosition ? 'text-zinc-500/20' : 'text-zinc-500'}`}>
                  network fee:
                </span>
                <span className={hasOpenPosition ? 'text-zinc-400/20' : 'text-zinc-400'}>
                  {hasOpenPosition ? '---' : (
                    inputAmount 
                      ? `${Math.max(0, Math.ceil(inputAmount * 0.01)).toLocaleString()}✵`
                      : '---'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Place Order Button */}
        <div className="flex flex-col items-center w-full mb-5">
          <div className="flex items-center justify-center w-full max-w-[500px] px-4">
            <div className="w-full">
              <button
                disabled={!isAllSelected() || isPlacingOrder}
                onClick={placeOrderHandler}
                className={`
                  w-full h-[40px] px-4 rounded-md border
                  font-mono text-sm lowercase transition-all
                  ${isAllSelected() && !hasOpenPosition && !isPlacingOrder
                    ? 'border-green-500/50 text-green-400 hover:bg-green-500/10 cursor-pointer'
                    : 'border-green-500/10 text-green-400/20 cursor-not-allowed'
                  }
                `}
              >
                {isPlacingOrder 
                  ? '⟳ opening...' 
                  : '✓ open position'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Open Orders - Fixed above footer */}
      <div className={`fixed bottom-[80px] left-0 right-0 bg-black ${userOrders.length > 0 ? 'border-t border-zinc-800' : ''}`}>
        <div className="flex items-center justify-center w-full max-w-[500px] mx-auto px-4">
          <div className="w-full flex flex-col gap-5 py-5">
            {userOrders.map((order) => {
              const markPrice = serverPrice || 0;
              const pnlPercent = order.position === 'long'
                ? ((markPrice - order.entryPrice) / order.entryPrice) * 100 * order.leverage
                : ((order.entryPrice - markPrice) / order.entryPrice) * 100 * order.leverage;

              const roundedPnlPercent = pnlPercent > 0 
                ? Math.ceil(pnlPercent)
                : Math.floor(pnlPercent);

              const profitTokens = Math.ceil((order.amount * roundedPnlPercent) / 100);
              const currentSize = order.amount + profitTokens;

              return (
                <div key={order.id} className="flex flex-col">
                  <div className="flex flex-col gap-2">
                    <div className="flex w-full gap-5">
                      <div className="flex flex-col gap-2 w-1/2">
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            type:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            eth {order.position} {order.leverage.toLocaleString()}x
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            collateral:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            {order.amount.toLocaleString()}✵
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            position:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            {Math.max(0, currentSize).toLocaleString()}✵
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            profit:
                          </span>
                          <span className={`font-mono text-sm ${
                            roundedPnlPercent > 0 ? 'text-green-400' : roundedPnlPercent < 0 ? 'text-red-400' : 'text-zinc-400'
                          }`}>
                            {roundedPnlPercent > 0 
                              ? '+' 
                              : roundedPnlPercent < 0 
                                ? '-'
                                : ''
                            }{Math.abs(profitTokens).toLocaleString()}✵
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 w-1/2">
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            entry:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            ${Math.round(order.entryPrice).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            liq.:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            ${Math.round(order.liquidationPrice).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            mark:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            ${serverPrice ? Math.round(serverPrice).toLocaleString() : '---'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span className="text-zinc-500 font-mono text-sm">
                            network fee:
                          </span>
                          <span className="text-zinc-400 font-mono text-sm">
                            {order.pendingClose ? '...' : (
                              profitTokens > 0 
                                ? `${Math.ceil(profitTokens * 0.01).toLocaleString()}✵`
                                : '0✵'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => closeOrderHandler(order.id)}
                      disabled={isClosingOrder === order.id || order.pendingClose}
                      className={`
                        w-full h-[40px] px-4 rounded-md border 
                        ${order.pendingClose 
                          ? 'border-yellow-500/50 text-yellow-400 cursor-not-allowed'
                          : isClosingOrder === order.id 
                            ? 'opacity-50 cursor-not-allowed'
                            : 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                        } 
                        transition-colors font-mono text-sm
                        mt-[12px]
                      `}
                    >
                      {order.pendingClose 
                        ? '⟳ closing...'
                        : isClosingOrder === order.id 
                          ? '...' 
                          : '× close position'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // Add the dev content section
  const devContent = (
    <div className="flex flex-col items-center w-full max-w-[500px] mx-auto px-4 gap-5 pt-5">
      <div className="flex flex-col gap-5 w-full">
        <div className="w-full h-[40px] flex items-center justify-between px-4 rounded-md border border-zinc-800 bg-black">
          <span className="text-zinc-500 font-mono text-sm">dev_mode:</span>
          <span className="text-purple-400 font-mono text-sm">active</span>
        </div>

        {/* Notification Controls */}
        <div className="w-full flex flex-col items-center">
          {isSubscribed ? (
            <div className="text-sm text-green-500 w-full">
              ✓ Subscribed to notifications
            </div>
          ) : (
            <Button 
              onClick={addFrame}
              className="bg-green-600 hover:bg-green-700 w-full"
            >
              Subscribe to Notifications
            </Button>
          )}
          {addFrameResult && (
            <div className="text-sm text-center mt-2">
              {addFrameResult}
            </div>
          )}
          {notificationDetails && (
            <div className="text-center mt-4 w-full">
              <Button 
                onClick={sendNotification}
                className="bg-blue-600 hover:bg-blue-700 w-full"
              >
                Test Send Notification
              </Button>
              {sendNotificationResult && (
                <div className="text-sm mt-2">
                  {sendNotificationResult}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Update the renderContent function to include dev view
  const renderContent = () => {
    // Add FID check for dev view
    if (currentView === 'dev') {
      if (context?.user?.fid !== 350911) {
        navigateTo('info');
        return infoContent;
      }
      return devContent;
    }

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
      // Initial fetch
      getUserOrders(context.user.fid).then(orders => {
        setUserOrders(orders);
        setHasOpenPosition(orders.length > 0);
      });

      // Subscribe to real-time updates
      const unsubscribe = subscribeToUserOrders(context.user.fid, (orders) => {
        setUserOrders(orders);
        setHasOpenPosition(orders.length > 0);
      });

      return () => unsubscribe();
    }
  }, [context?.user?.fid]);

  // Add closeOrderHandler
  const closeOrderHandler = async (orderId: string) => {
    if (!context?.user?.fid || isClosingOrder === orderId) return;
    
    try {
      setIsClosingOrder(orderId);
      
      const success = await requestClosePosition(context.user.fid, orderId);
      
      if (success) {
        // Don't remove order immediately - wait for server to process
        // Just update UI to show pending state
        setUserOrders(prev => prev.map(order => 
          order.id === orderId 
            ? { ...order, pendingClose: true }
            : order
        ));
      }
    } finally {
      setIsClosingOrder(null);
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

  useEffect(() => {
    const savedDetails = loadNotificationDetails();
    if (savedDetails) {
      setNotificationDetails(savedDetails);
      setIsSubscribed(true);
    }

    const checkFrameStatus = async () => {
      try {
        const result = await sdk.actions.addFrame();
        if (result.added && result.notificationDetails) {
          saveNotificationDetails(result.notificationDetails);
          setNotificationDetails(result.notificationDetails);
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Error checking frame status:', error);
      }
    };

    checkFrameStatus();
  }, [context]);

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
      <header className="fixed top-0 left-0 right-0 z-50 bg-black">
        <div className="flex flex-col">
          <div className="relative flex justify-between h-[80px] w-full max-w-[500px] mx-auto px-4">
            <div className="flex items-center">
              <button 
                className="flex items-center justify-center h-[40px] w-[40px] rounded-md border border-zinc-800 transition-colors bg-black hover:bg-zinc-800/50 active:opacity-80"
              >
                <Image
                  src="/icon-transparent.png"
                  alt="Reward Logo"
                  width={20}
                  height={20}
                  {...imageConfig}
                />
              </button>
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
        </div>
      </header>

      {/* Main content - Scrollable area */}
      <main className="flex-1 flex flex-col mt-[81px] mb-[81px] min-h-[calc(100dvh-162px)] overflow-y-auto">
        <div className="w-full h-full">
          {renderContent()}
        </div>
      </main>

      {/* Footer - Fixed at bottom */}
      <footer className="fixed bottom-0 left-0 right-0 z-[50] bg-black">
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
