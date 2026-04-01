import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import { authApi } from '../lib/api';

interface AuthUser {
  _id: string;
  name: string;
  phone?: string;
  walletAddress?: string;
  role: 'member' | 'leader' | 'bank';
  shgId?: string;
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  walletAddress: string | null;
  loading: boolean;
  connectPeraWallet: () => Promise<string>;
  disconnectPeraWallet: () => Promise<void>;
  login: (phone: string, password: string) => Promise<AuthUser>;
  register: (body: { name: string; phone?: string; password: string; role: string; shgId?: string; walletAddress?: string }) => Promise<AuthUser>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const peraWallet = new PeraWalletConnect({
  chainId: Number(import.meta.env.VITE_ALGORAND_CHAIN_ID || 416002) as 416001 | 416002 | 416003 | 4160,
  shouldShowSignTxnToast: false,
});

function persistAuth(data: AuthUser) {
  localStorage.setItem('saheli-token', data.token);
  localStorage.setItem('saheli-user', JSON.stringify(data));
  localStorage.setItem('shg-role', data.role);
  if (data.walletAddress) {
    localStorage.setItem('saheli-wallet-address', data.walletAddress);
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on mount
    const savedToken = localStorage.getItem('saheli-token');
    const savedUser = localStorage.getItem('saheli-user');
    const savedWalletAddress = localStorage.getItem('saheli-wallet-address');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      } catch {
        localStorage.removeItem('saheli-token');
        localStorage.removeItem('saheli-user');
      }
    }
    if (savedWalletAddress) {
      setWalletAddress(savedWalletAddress);
    }

    if (savedToken && savedUser) {
      peraWallet
        .reconnectSession()
        .then((accounts) => {
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            localStorage.setItem('saheli-wallet-address', accounts[0]);
          }
        })
        .catch(() => {
          // Ignore reconnect errors; user can reconnect manually.
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    peraWallet.connector?.on('disconnect', () => {
      setWalletAddress(null);
      localStorage.removeItem('saheli-wallet-address');
    });

    const handleAuthInvalid = () => {
      void peraWallet.disconnect();
      setUser(null);
      setWalletAddress(null);
    };
    window.addEventListener('saheli-auth-invalid', handleAuthInvalid);

    return () => {
      peraWallet.connector?.off('disconnect');
      window.removeEventListener('saheli-auth-invalid', handleAuthInvalid);
    };
  }, []);

  const login = async (phone: string, password: string): Promise<AuthUser> => {
    const data = await authApi.login(phone, password);
    persistAuth(data);
    setUser(data);
    if (data.walletAddress) {
      setWalletAddress(data.walletAddress);
    }
    return data;
  };

  const register = async (body: { name: string; phone?: string; password: string; role: string; shgId?: string; walletAddress?: string }): Promise<AuthUser> => {
    const data = await authApi.register(body);
    persistAuth(data);
    setUser(data);
    if (data.walletAddress) {
      setWalletAddress(data.walletAddress);
    }
    return data;
  };

  const connectPeraWallet = async (): Promise<string> => {
    if (!user) {
      throw new Error('Please sign in first, then connect your Pera wallet.');
    }

    const accounts = await peraWallet.connect();
    if (!accounts.length) {
      throw new Error('No wallet account selected');
    }

    const wallet = accounts[0];
    await authApi.linkWallet(wallet);

    setUser((prev) => (prev ? { ...prev, walletAddress: wallet } : prev));
    const savedUser = localStorage.getItem('saheli-user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        localStorage.setItem('saheli-user', JSON.stringify({ ...parsed, walletAddress: wallet }));
      } catch {
        // Ignore local storage parse failures and only persist wallet separately.
      }
    }

    localStorage.setItem('saheli-wallet-address', wallet);
    setWalletAddress(wallet);
    return wallet;
  };

  const disconnectPeraWallet = async (): Promise<void> => {
    try {
      await peraWallet.disconnect();
    } catch {
      // Ignore disconnect SDK errors and clear local state regardless.
    }

    setWalletAddress(null);
    localStorage.removeItem('saheli-wallet-address');

    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      delete next.walletAddress;
      localStorage.setItem('saheli-user', JSON.stringify(next));
      return next;
    });
  };

  const logout = () => {
    void peraWallet.disconnect();
    localStorage.removeItem('saheli-token');
    localStorage.removeItem('saheli-user');
    localStorage.removeItem('shg-role');
    localStorage.removeItem('saheli-wallet-address');
    setUser(null);
    setWalletAddress(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        walletAddress,
        loading,
        connectPeraWallet,
        disconnectPeraWallet,
        login,
        register,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
