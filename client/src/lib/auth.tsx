"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchFromApi } from './api';

export interface User {
	id: string;
	email: string;
	name: string;
	picture?: string;
	is_active: boolean;
}

interface AuthContextType {
	user: User | null;
	loading: boolean;
	error: string | null;
	autoLogin: () => Promise<void>;
	logout: (allDevices?: boolean) => Promise<void>;
}

const AUTH_STORAGE_KEY = 'auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(() => {
		// Initialize from localStorage if in browser environment
		if (typeof window !== 'undefined') {
			const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
			return storedUser ? JSON.parse(storedUser) : null;
		}
		return null;
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Sync user state with localStorage whenever it changes
	useEffect(() => {
		if (user) {
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
		} else {
			localStorage.removeItem(AUTH_STORAGE_KEY);
		}
	}, [user]);

	// Check if user is logged in
	useEffect(() => {
		async function checkAuth() {
			try {
				const response = await fetchFromApi('/api/auth/me');
				if (response.success && response.user) {
					setUser(response.user);
				} else {
					// 如果没有用户，自动创建一个临时用户
					await autoLogin();
				}
			} catch (err) {
				console.error('Auth check failed:', err);
				setError('Failed to check authentication status');
				// 如果认证检查失败，尝试自动登录
				try {
					await autoLogin();
				} catch (autoLoginErr) {
					console.error('Auto login also failed:', autoLoginErr);
				}
			} finally {
				setLoading(false);
			}
		}

		checkAuth();
	}, []);

	// 自动登录功能
	const autoLogin = async () => {
		try {
			setLoading(true);
			setError(null);
			
			// 调用自动登录API
			const response = await fetchFromApi('/api/auth/auto-login', {
				method: 'POST',
			});
			
			if (response.success && response.user) {
				setUser(response.user);
			} else {
				setError('Auto login failed');
			}
		} catch (err) {
			console.error('Auto login failed:', err);
			setError('Failed to auto login');
		} finally {
			setLoading(false);
		}
	};

	// Logout user
	const logout = async (allDevices = false) => {
		try {
			setLoading(true);
			await fetchFromApi(`/api/auth/logout?all_devices=${allDevices}`);
			setUser(null);
		} catch (err) {
			console.error('Logout failed:', err);
			setError('Failed to logout');
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthContext.Provider value={{ user, loading, error, autoLogin, logout }}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
