import { withAuth } from "next-auth/middleware"

export default withAuth(
    function middleware(req) {
        // callbacks
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: '/login',
        },
    }
)

export const config = { matcher: ["/settings"] }
