import { useOutletContext } from "react-router-dom";

import type { Me } from "../types";

export interface AppContext extends Me {
  refreshMe: () => void;
}
export default function useSession() {
  return useOutletContext<AppContext>();
}
