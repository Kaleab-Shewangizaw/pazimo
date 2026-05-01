"use client";

import type React from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, User, Menu, X, LogOut, UserCircle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const pathname = usePathname();
  const [searchTerm, setSearchTerm] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [visibleResultsCount, setVisibleResultsCount] = useState(5);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`
        );
        if (!response.ok) throw new Error("Failed to fetch events");
        const data = await response.json();
        const cats = Array.from(
          new Set(
            data.data.map(
              (event: any) => event.category?.name || "Uncategorized"
            )
          )
        ) as string[];
        setCategories(cats);
      } catch (e) {
        setCategories([]);
      }
    }
    fetchCategories();
  }, []);

  // Debounced search effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim() || selectedCategory) {
        handleSearchResults();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedCategory]);

  // Reset visible count when search results change
  useEffect(() => {
    setVisibleResultsCount(5);
  }, [searchResults]);

  const handleSearchResults = async () => {
    if (!searchTerm.trim() && !selectedCategory) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Fetch all published events (backend doesn't support text search parameter)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/public-events`
      );
      
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      let results = data.data || [];
      
      // Filter out private events
      results = results.filter((event: any) => !event.isPrivate && !event.isInvitationEvent);
      
      // Filter by search term (client-side)
      if (searchTerm.trim()) {
        const searchLower = searchTerm.trim().toLowerCase();
        results = results.filter((event: any) =>
          event.name?.toLowerCase().includes(searchLower) ||
          event.title?.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.location?.city?.toLowerCase().includes(searchLower) ||
          event.location?.address?.toLowerCase().includes(searchLower) ||
          event.category?.name?.toLowerCase().includes(searchLower)
        );
      }
      
      // Filter by category
      if (selectedCategory && selectedCategory !== "all") {
        results = results.filter((event: any) => 
          event.category?.name === selectedCategory
        );
      }
      
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/sign-in");
    setMobileMenuOpen(false);
  };

  const handleUserClick = () => {
    setMobileMenuOpen(false);
    if (user?.role === "organizer") {
      router.push("/organizer");
    } else {
      router.push("/my-account");
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = [];
    if (searchTerm.trim())
      params.push(`search=${encodeURIComponent(searchTerm.trim())}`);
    if (selectedCategory && selectedCategory !== "all")
      params.push(`category=${encodeURIComponent(selectedCategory)}`);
    const query = params.length ? `?${params.join("&")}` : "";
    router.push(`/event_explore${query}`);
    setMobileMenuOpen(false);
    setDialogOpen(false);
  };

  const handleEventClick = (eventId: string) => {
    router.push(`/event_detail?id=${eventId}`);
    setDialogOpen(false);
    setSearchTerm("");
    setSelectedCategory("");
    setSearchResults([]);
    setVisibleResultsCount(5);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSelectedCategory("");
    setSearchResults([]);
    setVisibleResultsCount(5);
  };

  const scrollToSection = (id: string, skipPush = false) => {
    setMobileMenuOpen(false);

    const performScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    if (typeof window !== "undefined" && pathname === "/") {
      performScroll();
    } else if (!skipPush) {
      router.push(`/#${id}`);
      setTimeout(performScroll, 300);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace("#", "");
    if (hash) {
      setTimeout(() => scrollToSection(hash, true), 150);
    }
  }, [pathname]);

  const toggleMobileMenu = () => {
    setMobileMenuOpen((prev) => !prev);
  };

  const handleShowMore = () => {
    setVisibleResultsCount(prev => prev + 5);
  };

  return (
    <>
      {/* Fixed header for mobile, normal for desktop */}
      <header
        className={`md:relative fixed! bg-white/40 backdrop-blur-2xl top-0 left-0 right-0 z-50 py-1 md:py-1 px-4 sm:px-8 md:px-16 border-b transition-all duration-300 ease-out
        `}
      >
        <div className="flex items-center justify-between gap-3 md:gap-6">
          {/* Mobile: Logo, Search trigger (dialog), Hamburger */}
          <div className="flex md:hidden items-center justify-between w-full gap-3">
            <Link
              href="/"
              className="flex items-center group flex-shrink-0 transition-all duration-300"
            >
              <img
                src="/logo.png"
                alt="Pazimo"
                className="w-15 h-auto transition-transform duration-200 group-hover:scale-105"
              />
            </Link>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="p-2 text-gray-700 hover:text-[#115db1]"
                onClick={() => {
                  setDialogOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                <Search className="h-5 w-5" />
              </Button>

              <button
                className="p-2 rounded-md text-gray-700 hover:text-[#115db1] focus:outline-none focus:ring-2 focus:ring-[#115db1] transition-colors"
                aria-label="Open menu"
                onClick={toggleMobileMenu}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Desktop: Logo */}
          <Link href="/" className="hidden md:flex items-center group ">
            <img
              src="/logo.png"
              alt="Pazimo"
              className="w-36 lg:w-30 h-auto transition-transform duration-200 group-hover:scale-105"
            />
          </Link>

          {/* Desktop: menu */}
          <div className="hidden md:flex gap-8">
            <button
              type="button"
              onClick={() => scrollToSection("featured")}
              className="text-gray-500 hover:text-black font-normal transition-colors text-sm"
            >
              Featured
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("categories")}
              className="text-gray-500 hover:text-black font-normal transition-colors text-sm"
            >
              Categories
            </button>
            <button
              type="button"
              onClick={() => scrollToSection("trending")}
              className="text-gray-500 hover:text-black font-normal transition-colors text-sm"
            >
              Trending
            </button>
            <Link
              href="/organizer-registration"
              target="_blank"
              className="text-gray-500 hover:text-black font-normal transition-colors text-sm"
            >
              Create Event
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {/* Desktop Search Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex p-2 text-gray-700 hover:text-[#115db1] hover:bg-blue-50 transition-all duration-200"
                  onClick={() => setDialogOpen(true)}
                >
                  <Search className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[800px] p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-2">
                  <DialogTitle className="text-xl font-semibold text-gray-900">
                    Search Events
                  </DialogTitle>
                </DialogHeader>
                
                {/* Search Form */}
                <form onSubmit={handleSearch} className="md:px-6 px-2 pb-4">
                  <div className="flex border  flex-col  gap-4">
                    <div className="w-[180px]">
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategory}
                        >
                          <SelectTrigger className="w-full h-11 border-gray-300 focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107]">
                            <SelectValue placeholder="All Categories" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    <div className="flex flex-1 gap-3">
                      
                      <div className="w-full relative">
                        <Input
                          type="text"
                          className="w-full border border-gray-300 h-11  focus:ring-2 focus:ring-[#FFC107]/20 focus:border-[#FFC107] pr-0"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          autoComplete="off"
                          placeholder="Search by event name, location, or description..."
                          autoFocus
                        />
                        {/* {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )} */}
                      </div>
                      <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] hover:from-[#2a4d7a] hover:to-[#1a2d5a] text-white px-8 h-11"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </Button>
                    </div>
                    </div>
                    
                  </div>
                </form>

                {/* Search Results */}
                <div className="border-t border-gray-100 max-h-[400px] overflow-y-auto">
                  {isSearching ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a]"></div>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div className="divide-y divide-gray-100">
                        {searchResults.slice(0, visibleResultsCount).map((event) => (
                          <button
                            key={event._id || event.id}
                            onClick={() => handleEventClick(event._id || event.id)}
                            className="w-full px-6 py-4 hover:bg-gray-50 transition-colors text-left group"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 group-hover:text-[#1a2d5a] transition-colors">
                                  {event.name || event.title}
                                </h3>
                                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                  {event.description}
                                </p>
                                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                                  <span>{event.category?.name || "Uncategorized"}</span>
                                  <span>•</span>
                                  <span>{new Date(event.date).toLocaleDateString()}</span>
                                  <span>•</span>
                                  <span>
                                    {typeof event.location === 'object' 
                                      ? `${event.location.city || event.location.address || 'Location'}${event.location.country ? ', ' + event.location.country : ''}` 
                                      : event.location}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearSearch}
                          className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear Search
                        </Button>
                        {visibleResultsCount < searchResults.length && (
                          <Button
                            type="button"
                            onClick={handleShowMore}
                            className="flex-1 bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] hover:from-[#2a4d7a] hover:to-[#1a2d5a] text-white"
                          >
                            Show More ({searchResults.length - visibleResultsCount} more)
                          </Button>
                        )}
                      </div>
                    </>
                  ) : searchTerm || selectedCategory ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No events found</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Try adjusting your search or category filter
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleClearSearch}
                        className="mt-4 border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Search
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500">Start typing to search for events</p>
                      <p className="text-sm text-gray-400 mt-1">
                        Search by event name, location, or description
                      </p>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* User Section */}
            {user ? (
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-[#1a2d5a] font-semibold hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 transition-all duration-200 rounded-xl px-4 py-1 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm hidden lg:inline">{user.firstName}</span>
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={handleUserClick} className="cursor-pointer">
                      <UserCircle className="h-4 w-4 mr-2" />
                      My Account
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {/* <Button
                  variant="outline"
                  className="text-[#1a2d5a] border-2 border-[#1a2d5a] hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 hover:border-[#ffc107] transition-all duration-200 rounded-xl font-medium bg-transparent hidden lg:flex"
                  onClick={handleLogout}
                >
                  Log out
                </Button> */}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Button
                  className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-sm hover:from-blue-600 hover:to-blue-500 cursor-pointer text-white border-0 transition-all duration-200  font-medium shadow-lg hover:shadow-xl"
                  onClick={() => router.push("/sign-in")}
                >
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay - slides from the top */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed top-16 left-0 right-0 z-40 px-4"
          >
            <div className="bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-lg rounded-b-2xl p-4 space-y-3">
              <nav className="flex flex-col gap-2 text-sm font-medium text-gray-700">
                <button
                  className="px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-[#115db1] transition-colors text-left"
                  onClick={() => scrollToSection("featured")}
                >
                  Featured
                </button>
                <button
                  className="px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-[#115db1] transition-colors text-left"
                  onClick={() => scrollToSection("categories")}
                >
                  Categories
                </button>
                <button
                  className="px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-[#115db1] transition-colors text-left"
                  onClick={() => scrollToSection("trending")}
                >
                  Trending
                </button>
                <Link
                  href="/organizer-registration"
                  target="_blank"
                  className="px-3 py-2 rounded-lg hover:bg-blue-50 hover:text-[#115db1] transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Create Event
                </Link>
              </nav>

              <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
                {user ? (
                  <>
                    <button
                      className="w-full px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-blue-50 hover:text-[#115db1] transition-colors"
                      onClick={handleUserClick}
                    >
                      My Account
                    </button>
                    <button
                      className="w-full px-3 py-2 rounded-lg text-left text-red-600 hover:bg-red-50 transition-colors"
                      onClick={handleLogout}
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <Button
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-medium"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      router.push("/sign-in");
                    }}
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
      <div className="md:h-12 h-16" />
    </>
  );
};

export default Header;