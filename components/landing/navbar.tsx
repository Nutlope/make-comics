"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Github, Key, BookOpen, User, Plus } from "lucide-react";
import Link from "next/link";
import { ApiKeyModal } from "@/components/api-key-modal";
import { SignInButton, SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { useApiKey } from "@/hooks/use-api-key";

export function Navbar() {
  const [showApiModal, setShowApiModal] = useState(false);
  const [stars, setStars] = useState<string>("-");

  const { isLoaded } = useAuth();
  const pathname = usePathname();
  const [, setApiKey] = useApiKey();

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
    setShowApiModal(false);
  };

  useEffect(() => {
    async function fetchStars() {
      try {
        const res = await fetch(
          "https://api.github.com/repos/nutlope/make-comics",
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "make-comics-app",
            },
          }
        );
        if (!res.ok) return;
        const data = await res.json();
        setStars(
          typeof data.stargazers_count === "number"
            ? data.stargazers_count.toLocaleString()
            : "-"
        );
      } catch {
        setStars("-");
      }
    }
    fetchStars();
  }, []);

  const isOnStoriesPage = pathname === "/stories";

  if (!isLoaded)
    return <div className="h-14 sm:h-16 w-full  border-b border-border/50" />;

  return (
    <>
      <nav className="w-full h-14 sm:h-16 border-b border-border/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-50 bg-background/80 backdrop-blur-md">
        <Link
          href="/"
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
            <img
              src="/images/makecomics-logo.png"
              alt="MakeComics Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-white font-heading tracking-[0.005em] text-lg sm:text-xl">
            MakeComics
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowApiModal(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer"
          >
            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
              API Key
            </span>
          </button>

          <Link
            href="https://github.com/nutlope/make-comics"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md"
          >
            <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline">
              {stars}
            </span>
          </Link>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer">
                <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
                  Sign In
                </span>
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            {isOnStoriesPage ? (
              <Link href="/">
                <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-white hover:bg-neutral-200 text-black transition-all text-xs rounded-md cursor-pointer font-medium">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-black text-xs sm:text-sm hidden sm:inline tracking-tight">
                    Create New
                  </span>
                </button>
              </Link>
            ) : (
              <Link href="/stories">
                <button className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 glass-panel glass-panel-hover transition-all text-xs rounded-md cursor-pointer">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="text-muted-foreground text-xs sm:text-sm hidden sm:inline tracking-tight">
                    My Stories
                  </span>
                </button>
              </Link>
            )}
          </SignedIn>
        </div>
      </nav>

      <ApiKeyModal
        isOpen={showApiModal}
        onClose={() => setShowApiModal(false)}
        onSubmit={handleApiKeySubmit}
      />
    </>
  );
}
