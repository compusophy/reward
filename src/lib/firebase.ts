import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

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

// Types
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
  pendingClose?: boolean;
}

interface VaultData {
  fees: number;
  debt: number;
  deposits: number;
  credit: number;
}

type GlobalStats = {
  totalUsers: number;
  totalVolume: number;
  totalTransactions: number;
  vault: VaultData;
};

// READ Operations
export async function getUserOrders(userId: number): Promise<Order[]> {
  try {
    const ordersRef = ref(db, 'orders');
    const snapshot = await get(ordersRef);
    
    if (!snapshot.exists()) return [];
    
    return Object.values(snapshot.val() as Record<string, Order>)
      .filter(order => order.userId === userId && order.status === 'open')
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to fetch user orders:', error);
    return [];
  }
}

export async function getLeaderboard(): Promise<UserData[]> {
  try {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    
    if (!snapshot.exists()) return [];
    
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
    const [usersSnapshot, statsSnapshot, vaultSnapshot] = await Promise.all([
      get(ref(db, 'users')),
      get(ref(db, 'stats')),
      get(ref(db, 'vault'))
    ]);

    const totalUsers = usersSnapshot.exists() ? Object.keys(usersSnapshot.val()).length : 0;
    const stats = statsSnapshot.exists() 
      ? statsSnapshot.val() 
      : { totalVolume: 0, totalTransactions: 0 };
    const vault = vaultSnapshot.exists() 
      ? vaultSnapshot.val() 
      : { fees: 0, debt: 0, deposits: 0, credit: 0 };

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
      vault: { fees: 0, debt: 0, deposits: 0, credit: 0 }
    };
  }
}

// Basic WRITE Operations
export async function recordVisitor(
  fid: number, 
  username: string | undefined, 
  pfpUrl: string | undefined,
  address: string | undefined
): Promise<number> {
  try {
    const userRef = ref(db, `users/${fid}`);
    const snapshot = await get(userRef);
    
    const existingBalance = snapshot.exists() 
      ? (snapshot.val() as FirebaseUserData).balance 
      : !fid || fid === 1 ? 1_000_000 : 1_000_000;
    
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
    return !fid || fid === 1 ? 0 : 1_000_000;
  }
}

// Trading Operations (now just requests to server)
export async function requestOpenPosition(
  fid: number,
  position: 'long' | 'short',
  leverage: number,
  amount: number
): Promise<boolean> {
  try {
    await set(ref(db, `orderRequests/open/${Date.now()}`), {
      userId: fid,
      position,
      leverage,
      amount,
      timestamp: Date.now(),
      status: 'pending'
    });
    return true;
  } catch (error) {
    console.error('Error requesting position open:', error);
    return false;
  }
}

export async function requestClosePosition(
  fid: number, 
  orderId: string
): Promise<boolean> {
  try {
    await set(ref(db, `orderRequests/close/${Date.now()}`), {
      userId: fid,
      orderId,
      timestamp: Date.now(),
      status: 'pending'
    });
    return true;
  } catch (error) {
    console.error('Error requesting position close:', error);
    return false;
  }
}

// Add new function to listen for user's orders
export function subscribeToUserOrders(
  userId: number, 
  callback: (orders: Order[]) => void
): () => void {
  const ordersRef = ref(db, 'orders');
  
  const unsubscribe = onValue(ordersRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    
    const orders = Object.values(snapshot.val() as Record<string, Order>)
      .filter(order => order.userId === userId && order.status === 'open')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    callback(orders);
  });
  
  return unsubscribe;
}
