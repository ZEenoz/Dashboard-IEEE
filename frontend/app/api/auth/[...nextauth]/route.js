import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { Pool } from "pg"
import bcrypt from "bcryptjs"

// PostgreSQL Configuration (Supports DATABASE_URL or individual vars)
const authPool = process.env.DATABASE_URL 
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        password: process.env.DB_PASSWORD || 'Waterretention1',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'water_monitoring'
    });

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) return null;

                try {
                    // Query user from PostgreSQL users table
                    const result = await authPool.query(
                        'SELECT user_id, username, password_hash, role, is_active FROM users WHERE username = $1 LIMIT 1',
                        [credentials.username]
                    );

                    if (result.rows.length === 0) return null;

                    const user = result.rows[0];

                    // Check account is active
                    if (!user.is_active) return null;

                    // 🟢 Password Verification Logic
                    // Support both bcrypt hashes (for new users) and plain text (for legacy/seed users)
                    let passwordMatch = false;

                    if (user.password_hash.startsWith('$2b$')) {
                        // Bcrypt Hash
                        passwordMatch = bcrypt.compareSync(credentials.password, user.password_hash);
                    } else {
                        // Legacy Plain Text Fallback
                        passwordMatch = credentials.password === user.password_hash;
                    }

                    if (!passwordMatch) return null;

                    return {
                        id: String(user.user_id),
                        name: user.username,
                        email: `${user.username}@dashboard.local`,
                        role: user.role, // 'admin' | 'viewer'
                    };
                } catch (err) {
                    console.error("Auth DB Error:", err.message);
                    return null;
                }
            }
        })
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async jwt({ token, user }) {
            // Persist role into JWT token on first login
            if (user) {
                token.role = user.role;
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            // Expose role and id on the session object
            session.user.role = token.role;
            session.user.id = token.id;
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET || "fallback_secret_dont_use_prod"
})

export { handler as GET, handler as POST }
