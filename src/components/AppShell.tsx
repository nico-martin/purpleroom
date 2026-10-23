import {
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic2,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import type { AppContext } from "../hooks/useSession";
import {
  Avatar,
  Brand,
  Button,
  ColorSchemeControl,
  LoadingState,
  NavItem,
  Notice,
} from "../theme";
import type { Me } from "../types";
import cn from "../utils/classnames";
import AppFooter from "./AppFooter";
import ProfileOnboarding from "./ProfileOnboarding";

interface AppShellProps {
  className?: string;
}
export default function AppShell({ className = "" }: AppShellProps) {
  const { data, error, loading, refresh } = useApi<Me>("/me");
  const [menu, setMenu] = useState(false);
  const { busy, error: logoutError, run } = useMutation();
  const navigate = useNavigate();
  const route = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.pathname]);
  if (loading && !data) return <LoadingState className="min-h-screen" />;
  if (error || !data)
    return (
      <div className="mx-auto max-w-lg p-8">
        <Notice tone="error">{error}</Notice>
        <Button className="mt-4" onClick={refresh}>
          Try again
        </Button>
      </div>
    );
  const links = [
    { to: "/", label: "The room", icon: LayoutDashboard },
    { to: "/conferences", label: "Conferences", icon: CalendarDays },
    { to: "/talks", label: "My talks", icon: Mic2 },
    { to: "/agenda", label: "My agenda", icon: CalendarCheck },
    { to: "/speaker", label: "Speaker toolkit", icon: Sparkles },
    { to: "/crew", label: "The crew", icon: Users },
  ];
  if (data.user.profile_complete === 0)
    return <ProfileOnboarding onSaved={refresh} />;
  return (
    <div className={cn("min-h-screen", className)}>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-60 flex-col overflow-y-auto border-r border-border bg-ground px-5 py-8 transition-transform lg:translate-x-0",
          menu ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Brand className="mb-10 px-1" />
        <p className="mb-3 px-3 font-mono text-xs uppercase tracking-widest text-muted">
          Your backstage pass
        </p>
        <nav
          className="space-y-1"
          aria-label="Main navigation"
          onClick={() => setMenu(false)}
        >
          {links.map(({ to, label, icon: Icon }) => (
            <NavItem
              key={to}
              to={to}
              icon={<Icon size={19} strokeWidth={1.6} />}
              end={to === "/"}
            >
              {label}
            </NavItem>
          ))}
        </nav>
        <div className="mt-9 rounded-2xl border border-border p-4">
          <Sparkles size={20} className="mb-3 text-green" strokeWidth={1.4} />
          <p className="font-heading text-sm font-semibold">
            Better, together.
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Good stages. Honest takes.
            <br />A little help from your friends.
          </p>
          <Link
            to="/crew"
            onClick={() => setMenu(false)}
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-green"
          >
            Find your crew <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="mt-auto space-y-1 pt-8" onClick={() => setMenu(false)}>
          <NavItem
            to="/settings"
            icon={<Settings2 size={18} strokeWidth={1.6} />}
            end
          >
            Settings
          </NavItem>
          <NavItem
            to="/settings/speaker"
            icon={<Mic2 size={18} strokeWidth={1.6} />}
          >
            Speaker settings
          </NavItem>
          {data.user.role === "admin" && (
            <>
              <NavItem to="/admin" icon={<Users size={18} strokeWidth={1.6} />}>
                Manage members
              </NavItem>
              <NavItem
                to="/trash"
                icon={<Trash2 size={18} strokeWidth={1.6} />}
              >
                Recently deleted
              </NavItem>
            </>
          )}
        </div>
        <div className="mt-5 border-t border-border pt-5">
          <Link
            to="/settings"
            className="flex items-center gap-3"
            onClick={() => setMenu(false)}
          >
            <Avatar name={data.user.name} src={data.user.avatar_url} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {data.user.name}
              </span>
              <span className="text-xs text-muted">Part of the crew</span>
            </span>
            <ChevronDown size={14} className="text-muted" />
          </Link>
        </div>
      </aside>
      {menu && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-ink/30 lg:hidden"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="lg:pl-60">
        <div className="flex min-h-20 items-center justify-between border-b border-border px-5 sm:px-10 lg:px-12">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              className="size-11 p-0 lg:hidden"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="hidden text-xs text-muted sm:block">
              {"{ where speakers swap notes }"}
            </span>
            <Brand compact className="sm:hidden" />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-2 text-xs text-muted md:flex">
              <span className="size-1.5 rounded-full bg-green" />
              Just the crew
            </span>
            <ColorSchemeControl compact />
            <Button
              variant="ghost"
              className="size-11 p-0"
              title="Sign out"
              aria-label="Sign out"
              loading={busy}
              onClick={() =>
                run(
                  () => api("/auth/logout", { method: "POST" }),
                  () => navigate("/login")
                )
              }
            >
              {!busy && <LogOut size={17} strokeWidth={1.6} />}
            </Button>
          </div>
        </div>
        <main
          id="main"
          className="mx-auto max-w-screen-2xl px-5 py-9 sm:px-10 sm:py-10 lg:px-12"
        >
          {logoutError && (
            <Notice tone="error" className="mb-5">
              {logoutError}
            </Notice>
          )}
          <div key={route.pathname} className="page-enter">
            <Outlet
              context={{ ...data, refreshMe: refresh } satisfies AppContext}
            />
          </div>
          <AppFooter className="mt-14" showVersion />
        </main>
      </div>
    </div>
  );
}
