import { Link } from "react-router-dom";

import logoDark from "../../../visuals/logo/purpleroom-logo-dark.svg";
import logo from "../../../visuals/logo/purpleroom-logo.svg";
import mark from "../../../visuals/logo/purpleroom-mark-small.svg";
import cn from "../../utils/classnames";

interface BrandProps {
  className?: string;
  compact?: boolean;
}
export default function Brand({ className = "", compact = false }: BrandProps) {
  return (
    <Link
      to="/"
      aria-label="purpleroom home"
      className={cn("inline-flex max-w-full shrink-0 items-center", className)}
    >
      {compact ? (
        <img src={mark} alt="" width={64} height={64} className="size-10" />
      ) : (
        <>
          <img
            src={logo}
            alt=""
            width={338.1}
            height={64}
            className="h-auto w-48 max-w-full dark:hidden"
          />
          <img
            src={logoDark}
            alt=""
            width={338.1}
            height={64}
            className="hidden h-auto w-48 max-w-full dark:block"
          />
        </>
      )}
    </Link>
  );
}
