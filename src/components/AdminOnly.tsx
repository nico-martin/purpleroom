import type { ReactNode } from "react";

import useSession from "../hooks/useSession";
import { Notice } from "../theme";

export default function AdminOnly({ children }: { children: ReactNode }) {
  return useSession().user.role === "admin" ? (
    children
  ) : (
    <Notice tone="error">
      Only admins can manage the catalog and accounts.
    </Notice>
  );
}
