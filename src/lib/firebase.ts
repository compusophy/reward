import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, runTransaction, update } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: "reward-a9ce9.firebaseapp.com",
  databaseURL: "https://reward-a9ce9-default-rtdb.firebaseio.com",
  projectId: "reward-a9ce9",
  storageBucket: "reward-a9ce9.firebasestorage.app",
  messagingSenderId: "844093098181",
  appId: "1:844093098181:web:e23810bca3c55657a048ac"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref } from "firebase/database";

export interface UserData {
  fid: number;
  username: string;
  pfpUrl: string;
  address: string;
  balance: number;
}

interface FirebaseUserData {
  username: string;
  pfpUrl: string;
  address: string;
  balance: number;
}

export async function recordVisitor(
  fid: number, 
  username: string | undefined, 
  pfpUrl: string | undefined,
  address: string | undefined
): Promise<number> {
  try {
    // Initialize vault if it doesn't exist
    const vaultRef = ref(db, 'vault');
    const vaultSnapshot = await get(vaultRef);
    if (!vaultSnapshot.exists()) {
      await set(vaultRef, { fees: 0, debt: 0, deposits: 0 });
    }

    const userRef = ref(db, `users/${fid}`);
    const snapshot = await get(userRef);
    
    // Always give new users 1M tokens
    const existingBalance = snapshot.exists() ? (snapshot.val() as FirebaseUserData).balance : 1_000_000;
    
    const userData: FirebaseUserData = {
      username: username || 'anonymous',
      pfpUrl: pfpUrl || 'https://i.imgur.com/I2rEbPF.png',
      address: address || '0x000000000000000000000000000000000000dEaD',
      balance: existingBalance
    };

    await set(userRef, userData);
    return existingBalance;
  } catch (error) {
    console.error('Failed to record user:', error);
    return 1_000_000;
  }
}

export async function getLeaderboard(): Promise<UserData[]> {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const data = snapshot.val() as Record<string, FirebaseUserData>;
    
    return Object.entries(data)
      .map(([fid, userData]) => ({
        fid: parseInt(fid),
        ...userData
      }))
      .sort((a, b) => b.balance - a.balance);
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error);
    return [];
  }
}

export async function getGlobalStats(): Promise<GlobalStats> {
  try {
    // Initialize vault if it doesn't exist
    const vaultRef = ref(db, 'vault');
    const vaultSnapshot = await get(vaultRef);
    if (!vaultSnapshot.exists()) {
      await set(vaultRef, { fees: 0, debt: 0, deposits: 0 });
    }

    // Get total users
    const usersRef = ref(db, 'users');
    const usersSnapshot = await get(usersRef);
    const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;

    // Get stats including total volume
    const statsRef = ref(db, 'stats');
    const statsSnapshot = await get(statsRef);
    const stats = statsSnapshot.exists() 
      ? statsSnapshot.val() 
      : { totalVolume: 0, totalTransactions: 0 };

    // Get vault data
    const vault = vaultSnapshot.exists() 
      ? vaultSnapshot.val() as VaultData 
      : { fees: 0, debt: 0, deposits: 0 };

    return {
      totalUsers,
      totalVolume: stats.totalVolume || 0,
      totalTransactions: stats.totalTransactions || 0,
      vault
    };
  } catch (error) {
    console.error('Failed to fetch global stats:', error);
    return {
      totalUsers: 0,
      totalVolume: 0,
      totalTransactions: 0,
      vault: { fees: 0, debt: 0, deposits: 0 }
    };
  }
}

export interface Order {
  id: string;
  userId: number;
  timestamp: number;
  position: 'long' | 'short';
  leverage: number;
  amount: number;
  entryPrice: number;
  liquidationPrice: number;
  status: 'open' | 'liquidated' | 'closed';
}

const generateOrderId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Add function to check for open orders
async function hasOpenOrder(userId: number): Promise<boolean> {
  try {
    const userOrdersRef = ref(db, `userOrders/${userId}`);
    const snapshot = await get(userOrdersRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const orders = Object.values(snapshot.val() as Record<string, Order>);
    return orders.some(order => order.status === 'open');
  } catch (error) {
    console.error('Failed to check open orders:', error);
    return false;
  }
}

// Fix the updateTotalVolume function to properly maintain state
async function updateTotalVolume(amount: number): Promise<boolean> {
  try {
    const statsRef = ref(db, 'stats');
    await runTransaction(statsRef, (currentStats) => {
      const current = currentStats || { totalVolume: 0, totalTransactions: 0 };
      return {
        ...current,
        totalVolume: (current.totalVolume || 0) + amount
      };
    });
    return true;
  } catch (error) {
    console.error('Failed to update total volume:', error);
    return false;
  }
}

// Update placeOrder to check for existing open orders
export async function placeOrder(
  fid: number,
  position: 'long' | 'short',
  leverage: number,
  amount: number,
  clientPrice: number
) {
  // Get current server-side price
  const priceSnapshot = await get(ref(db, 'serverPrice'));
  const serverPrice = priceSnapshot.val().price;
  
  // Check if client price is within 0.5% of server price
  const priceDiff = Math.abs(clientPrice - serverPrice) / serverPrice;
  if (priceDiff > 0.005) {
    throw new Error('Price deviation too large');
  }

  try {
    // Check if user already has an open order
    const hasExisting = await hasOpenOrder(fid);
    if (hasExisting) {
      return false;
    }

    const orderId = generateOrderId();
    const timestamp = Date.now();

    const liquidationPrice = position === 'long'
      ? clientPrice * (1 - 1/leverage)
      : clientPrice * (1 + 1/leverage);

    const order: Order = {
      id: orderId,
      userId: fid,
      timestamp,
      position,
      leverage,
      amount,
      entryPrice: clientPrice,
      liquidationPrice,
      status: 'open'
    };

    // Calculate fee
    const fee = Math.ceil(amount * 0.01);
    const totalCost = amount + fee;

    // Get user's current balance
    const userRef = ref(db, `users/${fid}`);
    const userSnapshot = await get(userRef);
    if (!userSnapshot.exists()) return false;

    const userData = userSnapshot.val() as FirebaseUserData;
    if (userData.balance < totalCost) return false;

    // Add fee to vault
    const vaultSuccess = await addFeeToVault(fee);
    if (!vaultSuccess) return false;

    // Update user's balance
    await set(userRef, {
      ...userData,
      balance: userData.balance - totalCost
    });

    // Add order to user's orders
    const userOrderRef = ref(db, `userOrders/${fid}/${orderId}`);
    await set(userOrderRef, order);

    // Add to global orders
    const orderRef = ref(db, `orders/${orderId}`);
    await set(orderRef, order);

    // Add amount to vault deposits
    const depositSuccess = await updateVaultDeposits(amount);
    if (!depositSuccess) return false;

    // Increment total transactions counter
    const statsRef = ref(db, 'stats');
    await runTransaction(statsRef, (currentStats) => {
      if (!currentStats) return { totalTransactions: 1 };
      return {
        ...currentStats,
        totalTransactions: (currentStats.totalTransactions || 0) + 1
      };
    });

    // Add order amount to total volume
    await updateTotalVolume(amount);

    return true;
  } catch (error) {
    console.error('Failed to place order:', error);
    return false;
  }
}

export async function getUserOrders(userId: number): Promise<Order[]> {
  try {
    const userOrdersRef = ref(db, `userOrders/${userId}`);
    const snapshot = await get(userOrdersRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    return Object.values(snapshot.val() as Record<string, Order>)
      .filter(order => order.status === 'open')
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to fetch user orders:', error);
    return [];
  }
}

export const closeOrder = async (
  fid: number, 
  orderId: string,
  networkFee: number
): Promise<boolean> => {
  try {
    const userOrderRef = ref(db, `userOrders/${fid}/${orderId}`);
    const userRef = ref(db, `users/${fid}`);
    const vaultRef = ref(db, 'vault');
    
    // Get current order data and price
    const [orderSnapshot, priceSnapshot, userSnapshot, vaultSnapshot] = await Promise.all([
      get(userOrderRef),
      get(ref(db, 'serverPrice')),
      get(userRef),
      get(vaultRef)
    ]);
    
    if (!orderSnapshot.exists() || !priceSnapshot.exists() || !userSnapshot.exists() || !vaultSnapshot.exists()) {
      console.error('Failed to fetch order, price, user, or vault data');
      return false;
    }
    
    const order = orderSnapshot.val() as Order;
    const currentPrice = priceSnapshot.val().price;
    
    // Calculate PnL
    const pnlPercent = order.position === 'long'
      ? ((currentPrice - order.entryPrice) / order.entryPrice)
      : ((order.entryPrice - currentPrice) / order.entryPrice);
    
    const pnlAmount = order.amount * pnlPercent * order.leverage;
    const returnAmount = Math.ceil(order.amount + pnlAmount);

    // Remove the original position amount from vault deposits
    const depositSuccess = await updateVaultDeposits(-order.amount);
    if (!depositSuccess) return false;

    // Start a transaction to update multiple nodes
    type Updates = {
      [key: string]: string | number | null | { [key: string]: number };
    };
    
    const updates: Updates = {
      [`userOrders/${fid}/${orderId}`]: null,
    };
    
    // Update user balance (now including network fee deduction)
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      updates[`users/${fid}/balance`] = userData.balance + returnAmount - networkFee;
    }
    
    // Update vault with network fee
    if (vaultSnapshot.exists()) {
      const vaultData = vaultSnapshot.val();
      updates['vault'] = {
        ...vaultData,
        fees: (vaultData.fees || 0) + networkFee,
        deposits: Math.max(0, (vaultData.deposits || 0) - order.amount)
      };
    }

    // Increment total transactions counter
    const statsRef = ref(db, 'stats');
    await runTransaction(statsRef, (currentStats) => {
      if (!currentStats) return { totalTransactions: 1 };
      return {
        ...currentStats,
        totalTransactions: (currentStats.totalTransactions || 0) + 1
      };
    });

    // Add closing amount to total volume
    await updateTotalVolume(order.amount);
    
    // Perform all updates atomically
    await update(ref(db), updates);
    
    return true;
  } catch (error) {
    console.error('Error closing order:', error);
    return false;
  }
};

interface VaultData {
  fees: number;     // Collected trading fees
  debt: number;     // Tokens created to pay profits
  deposits: number; // Total value of open positions
}

// Update vault initialization default values
const defaultVault: VaultData = {
  fees: 0,
  debt: 0,
  deposits: 0
};

// Update getVaultBalance
export async function getVaultBalance(): Promise<VaultData> {
  try {
    const vaultRef = ref(db, 'vault');
    const snapshot = await get(vaultRef);
    
    if (!snapshot.exists()) {
      await set(vaultRef, defaultVault);
      return defaultVault;
    }
    
    return snapshot.val() as VaultData;
  } catch (error) {
    console.error('Failed to get vault balance:', error);
    return { ...defaultVault };
  }
}

// Add function to update vault deposits
async function updateVaultDeposits(amount: number): Promise<boolean> {
  try {
    const vaultRef = ref(db, 'vault');
    const snapshot = await get(vaultRef);
    
    const currentVault = snapshot.exists() 
      ? (snapshot.val() as VaultData)
      : { ...defaultVault };
    
    await set(vaultRef, {
      ...currentVault,
      deposits: currentVault.deposits + amount
    });
    return true;
  } catch (error) {
    console.error('Failed to update vault deposits:', error);
    return false;
  }
}

// Update addToVault to specifically handle fees
async function addFeeToVault(amount: number): Promise<boolean> {
  try {
    const vaultRef = ref(db, 'vault');
    const snapshot = await get(vaultRef);
    
    const currentVault = snapshot.exists() 
      ? (snapshot.val() as VaultData)
      : { fees: 0, debt: 0 };
    
    await set(vaultRef, { 
      ...currentVault,
      fees: currentVault.fees + amount 
    });
    return true;
  } catch (error) {
    console.error('Failed to add fee to vault:', error);
    return false;
  }
}
type GlobalStats = {
  totalUsers: number;
  totalVolume: number;
  totalTransactions: number;
  vault: {
    fees: number;
    debt: number;
    deposits: number;
  }
};
