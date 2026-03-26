"use client";

import { createContext, useContext } from 'react';
import { useSession } from 'next-auth/react';

const AuthContext = createContext({ role: 'guest', isAdmin: false, session: null, status: 'loading' });

/**
 * AuthProvider — wraps next-auth useSession to expose role-based helpers.
 * session.user.role is set by NextAuth from the PostgreSQL users table.
 * role values: 'admin' | 'viewer'
 */
export function AuthProvider({ children }) {
    const { data: session, status } = useSession();

    const role = session?.user?.role || 'guest';
    const isAdmin = role === 'admin';

    return (
        <AuthContext.Provider value={{ role, isAdmin, session, status }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
