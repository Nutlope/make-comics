"use client";

import { Plus, Loader2, Key, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserButton, SignedIn } from "@clerk/nextjs";

interface PageData {
  id: number;
  title: string;
  image: string;
  prompt: string;
  characterUpload?: string;
  style: string;
}

interface PageSidebarProps {
  pages: PageData[];
  currentPage: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  loadingPageId?: number | null;
  onApiKeyClick?: () => void;
  isOwner?: boolean;
}

export function PageSidebar({
  pages,
  currentPage,
  onPageSelect,
  onAddPage,
  loadingPageId,
  onApiKeyClick,
  isOwner = true,
}: PageSidebarProps) {
  return (
    <aside className="w-20 md:w-24 border-r border-border/50 bg-background/50 flex flex-col items-center py-4 gap-2 justify-between">
      {/* Top section: page thumbnails */}
      <div className="flex flex-col items-center gap-3">
        {pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => onPageSelect(index)}
            disabled={loadingPageId === index}
            className={`
              w-16 h-16 rounded-lg transition-all relative overflow-hidden
              ${
                currentPage === index
                  ? "ring-2 ring-indigo shadow-lg shadow-indigo/20"
                  : "glass-panel glass-panel-hover hover:ring-1 hover:ring-white/20"
              }
              ${loadingPageId === index ? "opacity-50" : ""}
            `}
          >
            {loadingPageId === index ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            ) : (
              <>
                <img
                  src={page.image || "/placeholder.svg"}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div
                  className={`
                  absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight
                  ${
                    currentPage === index
                      ? "bg-indigo text-white"
                      : "bg-black/70 text-white"
                  }
                `}
                >
                  {index + 1}
                </div>
              </>
            )}
          </button>
        ))}

        {isOwner && (
          <button
            onClick={onAddPage}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border/50 hover:border-indigo/50 bg-background/50 hover:bg-background/80 transition-all group flex items-center justify-center"
          >
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-indigo transition-transform group-hover:scale-110" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-3">
        {/* API Key Button */}
        <Button
          onClick={onApiKeyClick}
          variant="ghost"
          size="icon"
          className="w-10 h-10 glass-panel glass-panel-hover text-muted-foreground hover:text-white"
          title="Manage API Key"
        >
          <Key className="w-4 h-4" />
        </Button>

        <SignedIn>
          <div className="w-10 h-10 glass-panel glass-panel-hover rounded-md flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-full h-full rounded-md",
                },
              }}
            />
          </div>
        </SignedIn>
      </div>
    </aside>
  );
}
