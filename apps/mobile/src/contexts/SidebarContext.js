import { createContext, useContext } from "react";

export const SidebarContext = createContext({
  openSidebar: () => {},
  closeSidebar: () => {},
  profile: null,
});

export function useSidebar() {
  return useContext(SidebarContext);
}
