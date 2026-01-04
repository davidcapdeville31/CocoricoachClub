import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const OFFLINE_SESSION_KEY = "rugby-offline-session";
const OFFLINE_USER_KEY = "rugby-offline-user";

// Save session to localStorage for offline access
function saveOfflineSession(session: Session | null, user: User | null) {
  try {
    if (session && user) {
      localStorage.setItem(OFFLINE_SESSION_KEY, JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        token_type: session.token_type,
      }));
      localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify({
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
        app_metadata: user.app_metadata,
      }));
    } else {
      localStorage.removeItem(OFFLINE_SESSION_KEY);
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
  } catch (error) {
    console.error("Error saving offline session:", error);
  }
}

// Load session from localStorage when offline
function loadOfflineSession(): { user: User | null; isOfflineSession: boolean } {
  try {
    const userStr = localStorage.getItem(OFFLINE_USER_KEY);
    if (userStr) {
      const user = JSON.parse(userStr) as User;
      return { user, isOfflineSession: true };
    }
  } catch (error) {
    console.error("Error loading offline session:", error);
  }
  return { user: null, isOfflineSession: false };
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isOfflineSession: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsOfflineSession(false);
        setLoading(false);
        
        // Save session for offline use
        saveOfflineSession(session, session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        setIsOfflineSession(false);
        saveOfflineSession(session, session.user);
      } else if (!navigator.onLine) {
        // If offline and no active session, try to load from localStorage
        const { user: offlineUser, isOfflineSession: isOffline } = loadOfflineSession();
        if (offlineUser) {
          setUser(offlineUser);
          setIsOfflineSession(true);
          console.log("Using offline session for user:", offlineUser.email);
        }
      }
      setLoading(false);
    }).catch((error) => {
      console.error("Error getting session:", error);
      // If error (likely offline), try to load offline session
      if (!navigator.onLine) {
        const { user: offlineUser, isOfflineSession: isOffline } = loadOfflineSession();
        if (offlineUser) {
          setUser(offlineUser);
          setIsOfflineSession(true);
        }
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
    // Clear offline session
    saveOfflineSession(null, null);
    setUser(null);
    setSession(null);
    setIsOfflineSession(false);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isOfflineSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
