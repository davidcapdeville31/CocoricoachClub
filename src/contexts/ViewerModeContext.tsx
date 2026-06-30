import { createContext, useContext, ReactNode } from "react";
import { usePublicAccess } from "@/contexts/PublicAccessContext";
import { useCurrentUserIdentity } from "@/hooks/useCurrentUserIdentity";

interface ViewerModeContextType {
  isViewer: boolean;
  isLoading: boolean;
}

const ViewerModeContext = createContext<ViewerModeContextType>({
  isViewer: false,
  isLoading: true,
});

interface ViewerModeProviderProps {
  children: ReactNode;
  clubId?: string;
  categoryId?: string;
}

export function ViewerModeProvider({ children, clubId, categoryId }: ViewerModeProviderProps) {
  const { isPublicAccess } = usePublicAccess();
  const identity = useCurrentUserIdentity();

  const clubMemberRole = identity.getClubRole(clubId);
  const categoryMemberRole = identity.getCategoryRole(categoryId);

  // User is in viewer mode if:
  // 1. They're accessing via public token (always read-only)
  // 2. They have "viewer" role on the club
  // 3. They have "viewer" role on the category
  const isViewer =
    isPublicAccess ||
    clubMemberRole === "viewer" ||
    categoryMemberRole === "viewer";

  return (
    <ViewerModeContext.Provider value={{ isViewer, isLoading: identity.isLoading && !isPublicAccess }}>
      {children}
    </ViewerModeContext.Provider>
  );
}

export function useViewerModeContext() {
  return useContext(ViewerModeContext);
}
