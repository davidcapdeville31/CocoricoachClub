import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePublicAccess } from "@/contexts/PublicAccessContext";

interface PublicDataState {
  category: any | null;
  players: any[];
  matches: any[];
  sessions: any[];
  todaySessions: any[];
  injuries: any[];
  wellness: any[];
  awcr: any[];
  attendance: any[];
  programs: any[];
  matchLineups: any[];
  overview: {
    totalPlayers: number;
    totalSessions: number;
    activeInjuries: number;
    categoryName: string;
    clubName: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  isPublicMode: boolean;
}

interface PublicDataContextType extends PublicDataState {
  refetch: () => void;
}

const defaultState: PublicDataState = {
  category: null,
  players: [],
  matches: [],
  sessions: [],
  todaySessions: [],
  injuries: [],
  wellness: [],
  awcr: [],
  attendance: [],
  programs: [],
  matchLineups: [],
  overview: null,
  isLoading: false,
  error: null,
  isPublicMode: false,
};

const PublicDataContext = createContext<PublicDataContextType>({
  ...defaultState,
  refetch: () => {},
});

interface PublicDataProviderProps {
  children: ReactNode;
  categoryId: string;
}

export function PublicDataProvider({ children, categoryId }: PublicDataProviderProps) {
  const { isPublicAccess, token } = usePublicAccess();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-all-data", categoryId, token],
    queryFn: async () => {
      if (!isPublicAccess || !token) {
        return null;
      }

      console.log("Fetching public data for category:", categoryId);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-data?token=${token}&type=all`,
        {
          headers: {
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      
      if (!result.success) {
        console.error("Public data fetch failed:", result.error);
        throw new Error(result.error || "Failed to fetch data");
      }

      console.log("Public data loaded:", Object.keys(result.data));
      return result.data;
    },
    enabled: isPublicAccess && !!token && !!categoryId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const contextValue: PublicDataContextType = {
    category: data?.category || null,
    players: data?.players || [],
    matches: data?.matches || [],
    sessions: data?.sessions || [],
    todaySessions: data?.todaySessions || [],
    injuries: data?.injuries || [],
    wellness: data?.wellness || [],
    awcr: data?.awcr || [],
    attendance: data?.attendance || [],
    programs: data?.programs || [],
    matchLineups: data?.matchLineups || [],
    overview: data?.overview || null,
    isLoading,
    error: error?.message || null,
    isPublicMode: isPublicAccess,
    refetch,
  };

  return (
    <PublicDataContext.Provider value={contextValue}>
      {children}
    </PublicDataContext.Provider>
  );
}

export function usePublicDataContext() {
  return useContext(PublicDataContext);
}

/**
 * Hook to check if we're in public mode and should use public data
 */
export function useIsPublicMode() {
  const { isPublicMode } = usePublicDataContext();
  return isPublicMode;
}
