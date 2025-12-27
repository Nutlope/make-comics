"use client";

import { ArrowLeft, RefreshCw, Share, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface EditorToolbarProps {
  title: string;
  onContinueStory?: () => void;
  isOwner?: boolean;
}

export function EditorToolbar({
  title,
  onContinueStory,
  isOwner = true,
}: EditorToolbarProps) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-3 sm:px-4">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (isOwner ? router.push("/stories") : router.push("/"))}
          className="hover:bg-secondary text-muted-foreground hover:text-white shrink-0"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </Button>

        <h1 className="text-sm sm:text-base text-white font-normal tracking-[-0.02em] truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Button
          variant="ghost"
          className="hover:bg-secondary text-muted-foreground hover:text-white gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3 hidden md:flex"
          onClick={async () => {
            const url = window.location.href;
            try {
              await navigator.clipboard.writeText(url);
              toast({
                title: "Link copied!",
                description: "Story URL has been copied to your clipboard.",
                duration: 2000,
              });
            } catch (err) {
              console.error("Failed to copy URL:", err);
              toast({
                title: "Failed to copy",
                description: "Could not copy the URL to clipboard.",
                variant: "destructive",
                duration: 3000,
              });
            }
          }}
        >
          <Share className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Share</span>
        </Button>

         {isOwner && onContinueStory && (
           <Button
             onClick={onContinueStory}
             className="relative gap-1.5 sm:gap-2 text-xs bg-white hover:bg-neutral-200 text-black h-8 sm:h-9 px-3 sm:px-4"
           >
             <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
             <span className="hidden sm:inline">Continue story <span className="text-gray-500 text-[10px]">(C)</span></span>
             <span className="sm:hidden">Add</span>
           </Button>
         )}
      </div>
    </header>
  );
}
