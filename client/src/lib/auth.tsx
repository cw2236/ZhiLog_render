"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { fetchFromApi } from './api'; // 注释掉API调用

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
			if (storedUser) {
				try {
					const parsedUser = JSON.parse(storedUser);
					console.log('AuthProvider: Initialized user from localStorage:', parsedUser);
					return parsedUser;
				} catch (error) {
					console.error('AuthProvider: Failed to parse stored user:', error);
					localStorage.removeItem(AUTH_STORAGE_KEY);
				}
			}
		}
		return null;
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Sync user state with localStorage whenever it changes
	useEffect(() => {
		if (user) {
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
			console.log('AuthProvider: User state updated, saved to localStorage:', user);
		} else {
			localStorage.removeItem(AUTH_STORAGE_KEY);
			console.log('AuthProvider: User cleared, removed from localStorage');
		}
	}, [user]);

	// Check if user is logged in
	useEffect(() => {
		async function checkAuth() {
			try {
				console.log('AuthProvider: Checking authentication...');
				
				// 如果localStorage中已有用户数据，直接使用
				const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
				if (storedUser) {
					try {
						const parsedUser = JSON.parse(storedUser);
						console.log('AuthProvider: Using stored user:', parsedUser);
						setUser(parsedUser);
					} catch (error) {
						console.error('AuthProvider: Failed to parse stored user:', error);
						localStorage.removeItem(AUTH_STORAGE_KEY);
					}
				} else {
					// 如果没有存储的用户数据，创建一个模拟用户
					console.log('AuthProvider: No stored user, creating mock user');
					const mockUser: User = {
						id: 'mock-user-id',
						email: 'user@example.com',
						name: 'Test User',
						is_active: true
					};
					setUser(mockUser);
				}
			} catch (err) {
				console.error('Auth check failed:', err);
				setError('Failed to check authentication status');
			} finally {
				setLoading(false);
			}
		}

		checkAuth();
	}, []);

	// 自动登录功能
	const autoLogin = async () => {
		try {
			console.log('AuthProvider: Auto login called');
			setLoading(true);
			setError(null);
			
			// 使用模拟数据而不是调用API
			const mockUser: User = {
				id: 'mock-user-id',
				email: 'user@example.com',
				name: 'Test User',
				is_active: true
			};
			console.log('AuthProvider: Setting mock user:', mockUser);
			setUser(mockUser);
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
			// 模拟logout API调用
			console.log('Mock logout called', { allDevices });
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
