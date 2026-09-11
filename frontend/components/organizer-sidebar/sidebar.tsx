"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  User,
  Bell,
  HelpCircle,
  LogOut,
  Wallet,
  X,
  Mail,
  UsersIcon,
  Megaphone,
  ScanLine,
  ClipboardList,
  Banknote,
  Beer,
  ChevronLeft,
  ChevronRight,
  SunMedium,
  MoonStar,
  LaptopMinimal,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { toast } from "sonner";
import { io, type Socket } from "socket.io-client";
import { cn } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "organizer-sidebar-collapsed";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  count?: number;
}


export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, token, logout } = useAuthStore();
  const router = useRouter();

  // Non-eligible organizers must not see Pazimo Capital at all — this check
  // is a UX nicety on top of the real gate, which is the backend's
  // requireCapitalEligible middleware on every capital endpoint.
  const [capitalEligible, setCapitalEligible] = useState(false);
  // Same reasoning as capital above: hidden unless approved, on top of the
  // backend's requireBeverageEligible gate.
  const [beverageEligible, setBeverageEligible] = useState(false);

  // Desktop-only icon rail toggle — mobile always shows full labels since
  // the sidebar there is a temporary overlay, not permanent layout space.
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored === "true") setCollapsedPref(true);

    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  const collapsed = collapsedPref && isDesktop;
  const toggleCollapsed = () => {
    setCollapsedPref((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  };

  // Unread notification count — just a counter on the existing
  // "Notifications" nav item now, not a separate dropdown.
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || user?.role !== "organizer") return;
    const userId = user._id ?? "";
    if (!userId) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/notifications/user/${userId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const fetched = data.data || [];
            setUnreadCount(fetched.filter((n: any) => !n.read).length);
          }
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchUnreadCount();

    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
        auth: { token },
        transports: ["websocket"],
      });

      socketRef.current.emit("joinOrganizerRoom", userId);

      socketRef.current.on("eventStatusUpdated", (data: any) => {
        setUnreadCount((prev) => prev + 1);
        toast.info(`Event "${data.eventTitle}" status changed to ${data.status}.`);
      });

      socketRef.current.on("withdrawalStatusUpdated", (data: any) => {
        setUnreadCount((prev) => prev + 1);
        toast.info(`Your withdrawal of ${data.amount} Birr has been ${data.status}.`);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("eventStatusUpdated");
        socketRef.current.off("withdrawalStatusUpdated");
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [token, user?.role, user?._id]);

  const handleUserClick = () => {
    router.push("/organizer");
  };

  useEffect(() => {
    if (!token || user?.role !== "organizer") return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/capital/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCapitalEligible(data?.data?.eligibility === "eligible"))
      .catch(() => setCapitalEligible(false));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/beverages/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBeverageEligible(data?.data?.eligibility === "eligible"))
      .catch(() => setBeverageEligible(false));
  }, [token, user?.role]);

  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    logout();
    router.push("/sign-in");
    onClose();
  };

  const handleLinkClick = () => {
    onClose();
  };

  const primaryNav: NavItem[] = [
    { href: "/organizer", label: "Dashboard", icon: Home },
    { href: "/organizer/events", label: "Events", icon: CalendarDays },
    { href: "/organizer/rsvp-builder", label: "RSVP", icon: ClipboardList },
    { href: "/organizer/invitations", label: "Invitations", icon: Mail },
    { href: "/organizer/customers", label: "Customers", icon: UsersIcon },
    ...(capitalEligible
      ? [{ href: "/organizer/capital", label: "Pazimo Capital", icon: Banknote, badge: "New" }]
      : []),
    ...(beverageEligible
      ? [
          { href: "/organizer/beverages", label: "Beverage sales", icon: Beer, badge: "New" },
          { href: "/organizer/beverages/withdrawals", label: "Bar withdrawals", icon: Wallet },
        ]
      : []),
    { href: "/organizer/campaign", label: "Campaign", icon: Megaphone },
    { href: "/organizer/qr-scanner", label: "Scan Ticket", icon: ScanLine },
    {
      href: "/organizer/withdrawals",
      // Only worth qualifying when there is a second pool to confuse it
      // with — bar takings are settled on the beverages page.
      label: beverageEligible ? "Ticket withdrawals" : "Withdrawals",
      icon: Wallet,
    },
    { href: "/organizer/account", label: "Account", icon: User },
  ];

  const otherNav: NavItem[] = [
    { href: "/organizer/notifications", label: "Notifications", icon: Bell, count: unreadCount },
    { href: "/organizer/help", label: "Help Center", icon: HelpCircle },
  ];

  const NavIcon = ({ item }: { item: NavItem }) => (
    <span className="relative flex-shrink-0">
      <item.icon className="h-5 w-5" />
      {!!item.count && (
        <span className="absolute -top-1.5 -right-2 min-w-3.5 h-3.5 px-0.5 rounded-full bg-destructive text-white text-[9px] leading-3.5 text-center font-medium">
          {item.count > 99 ? "99+" : item.count}
        </span>
      )}
    </span>
  );

  const NavLink = ({ item }: { item: NavItem }) => {
    const link = (
      <Link
        href={item.href}
        onClick={handleLinkClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive(item.href)
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
        )}
      >
        <NavIcon item={item} />
        {!collapsed && (
          <>
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge && (
              <Badge variant="info" className="text-[10px] uppercase tracking-wide">
                {item.badge}
              </Badge>
            )}
          </>
        )}
      </Link>
    );

    if (!collapsed) return link;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">
          {item.label}
          {item.badge ? ` · ${item.badge}` : ""}
          {item.count ? ` (${item.count})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  };

  const ThemeRow = () => {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const isDark = mounted && (theme === "dark" || (theme === "system" && resolvedTheme === "dark"));
    const toggle = () => setTheme(isDark ? "light" : "dark");
    const Icon = !mounted ? LaptopMinimal : isDark ? SunMedium : MoonStar;
    const label = !mounted ? "Theme" : isDark ? "Light mode" : "Dark mode";

    const button = (
      <button
        onClick={toggle}
        disabled={!mounted}
        className={cn(
          "w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground transition-colors",
          collapsed && "justify-center px-0"
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="flex-1 text-left truncate">{label}</span>}
      </button>
    );

    if (!collapsed) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "bg-sidebar w-full fixed left-3 top-3 bottom-3 z-40 transform transition-[transform,max-width] duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          collapsed ? "max-w-[76px]" : "max-w-[280px]",
          "rounded-2xl shadow-md dark:shadow-none flex-shrink-0",
          "lg:relative lg:left-auto lg:top-auto lg:bottom-auto lg:my-3 lg:ml-3"
        )}
      >
        {/* Collapse toggle — desktop only; mobile closes via the X below */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex absolute top-1/2 -right-3 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-card text-muted-foreground hover:text-foreground shadow-md dark:shadow-none transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex flex-col h-full overflow-hidden rounded-2xl">
          {/* Brand Header */}
          <div className="relative">
            <button
              onClick={onClose}
              className="lg:hidden absolute top-3 right-3 z-10 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>

            <button
              onClick={handleUserClick}
              className={cn(
                "flex items-center gap-3 w-full pt-6 pb-4 text-left",
                collapsed ? "justify-center px-0" : "px-4"
              )}
            >
              <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-sidebar-accent-foreground" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {user?.firstName || "Organizer"}
                  </span>
                  <span className="text-xs text-muted-foreground">Organizer</span>
                </div>
              )}
            </button>
          </div>

          {/* Navigation — primary items centered in the available space,
              secondary items and logout pinned to the bottom. */}
          <nav className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain p-3">
            <div className="flex-1 flex flex-col justify-center space-y-0.5">
              {primaryNav.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>

            <div className="pt-6 mt-2">
              {!collapsed && (
                <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider px-3">
                  Other
                </div>
              )}
              <div className="space-y-0.5">
                {otherNav.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
                <ThemeRow />
              </div>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center rounded-md px-0 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <LogOut className="h-5 w-5 flex-shrink-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Logout</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5 flex-shrink-0" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
    </>
  );
}
