// logout.ts
import { client } from "../db/denopost_conn.ts";  // PostgreSQL connection file

export async function handleLogout(req: Request): Promise<Response> {
    try {
        // Get the cookie string and log it for debugging
        const cookieString = req.headers.get("cookie") || "";
                
        // Improved session token extraction
        let sessionToken = null;
        try {
            // Try direct regex extraction
            const tokenMatch = cookieString.match(/session_token=([^;]+)/);
            if (tokenMatch && tokenMatch[1]) {
                sessionToken = tokenMatch[1];
                                
                // Check if token needs URL decoding
                try {
                    const decodedToken = decodeURIComponent(sessionToken);
                    if (decodedToken !== sessionToken) {
                                                sessionToken = decodedToken;
                    }
                } catch (e) {
                    // Decoding failed, keep original token
                }
                
                // Check if token is a JSON string
                if (sessionToken.startsWith('{') || sessionToken.startsWith('[') || 
                    sessionToken.startsWith('"') || sessionToken.includes('":"')) {
                    try {
                        const jsonToken = JSON.parse(sessionToken);
                                                
                        // If token is object with token property
                        if (jsonToken && typeof jsonToken === 'object') {
                            if (jsonToken.token) {
                                                                sessionToken = jsonToken.token;
                            } else if (jsonToken.access_token) {
                                                                sessionToken = jsonToken.access_token;
                            } else {
                                // Check for first UUID-like property
                                for (const key in jsonToken) {
                                    const value = jsonToken[key];
                                    if (typeof value === 'string' && 
                                        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
                                                                                sessionToken = value;
                                        break;
                                    }
                                }
                            }
                        } else if (typeof jsonToken === 'string') {
                                                        sessionToken = jsonToken;
                        }
                    } catch (e) {
                                            }
                }
            } else {
                                
                // Parse all cookies
                const cookies = cookieString.split(';').reduce((acc, cookie) => {
                    const [key, value] = cookie.trim().split('=');
                    if (key && value) acc[key] = value;
                    return acc;
                }, {} as Record<string, string>);
                
                // Try various cookie names
                const possibleCookieNames = ['session_token', 'auth_token', 'token', 'accessToken', 'auth', 'session'];
                for (const name of possibleCookieNames) {
                    if (cookies[name]) {
                        sessionToken = cookies[name];
                                                break;
                    }
                }
            }
        } catch (cookieError) {
        }

        // Create a timestamp for cache-busting
        const timestamp = Date.now();
        const redirectUrl = `/index.html?loggedOut=true&t=${timestamp}`;
        
                
        // Security headers to prevent caching and back navigation
        const securityHeaders: Record<string, string> = {
            "Location": redirectUrl,
            "Set-Cookie": "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "no-referrer",
            "Clear-Site-Data": "\"cache\", \"cookies\", \"storage\"",
            "Content-Type": "text/html; charset=utf-8"
        };

        // Also clear other possible cookies
        const cookiesToClear = ['auth_token', 'accessToken', 'token', 'auth', 'session'];
        for (const cookieName of cookiesToClear) {
            securityHeaders[`Set-Cookie`] += `, ${cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`;
        }

        // If we don't have a token, just redirect to login
        if (!sessionToken) {
                        return new Response(null, {
                status: 302,
                headers: securityHeaders
            });
        }

        // Log the session token for debugging (partially masked)
        
        // Also try to extract a token from localStorage via client-side script
        
        try {
            // Try to delete the token from the databases
            const tokenString = String(sessionToken);
                        
            // Try with a LIKE query to find the token even if it's part of a JSON string
            try {
                const tokenLikeResult = await client.queryObject(`
                    DELETE FROM sessions 
                    WHERE token LIKE $1 OR token LIKE $2 OR token LIKE $3 OR token = $4
                    RETURNING token
                `, [`%${tokenString}%`, `%"token":"${tokenString}"%`, `%"access_token":"${tokenString}"%`, tokenString]);
                
                if (tokenLikeResult?.rows?.length > 0) {
                                    } else {
                                        
                    // Try exact match query as fallback
                    const exactMatchResult = await client.queryObject(`
                        DELETE FROM sessions WHERE token = $1 RETURNING token
                    `, [tokenString]);
                    
                    if (exactMatchResult?.rows?.length > 0) {
                                            } else {
                                            }
                }
            } catch (sessionsError) {
            }
            
            // Also try to delete from tokens table if it exists
            try {
                const tokensLikeResult = await client.queryObject(`
                    DELETE FROM tokens 
                    WHERE token LIKE $1 OR token LIKE $2 OR token LIKE $3 OR token = $4
                    RETURNING token
                `, [`%${tokenString}%`, `%"token":"${tokenString}"%`, `%"access_token":"${tokenString}"%`, tokenString]);
                
                if (tokensLikeResult?.rows?.length > 0) {
                                    } else {
                                        
                    // Try exact match query as fallback
                    const exactMatchResult = await client.queryObject(`
                        DELETE FROM tokens WHERE token = $1 RETURNING token
                    `, [tokenString]);
                    
                    if (exactMatchResult?.rows?.length > 0) {
                                            } else {
                                            }
                }
            } catch (tokensError) {
                            }
        } catch (dbError) {
        }

        // Create response with cleared cookie and redirect
                return new Response(null, {
            status: 302,
            headers: securityHeaders
        });
    } catch (error) {
        // Create error redirect URL with timestamp
        const timestamp = Date.now();
        const errorRedirectUrl = `/index.html?loggedOut=true&error=true&t=${timestamp}`;
                
        // Even if there's an error, try to redirect to index with proper headers
        return new Response(null, {
            status: 302,
            headers: {
                "Location": errorRedirectUrl,
                "Set-Cookie": "session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, auth_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, accessToken=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, auth=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict, session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict",
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
                "X-XSS-Protection": "1; mode=block",
                "Referrer-Policy": "no-referrer",
                "Clear-Site-Data": "\"cache\", \"cookies\", \"storage\"",
                "Content-Type": "text/html; charset=utf-8"
            }
        });
    }
} 
