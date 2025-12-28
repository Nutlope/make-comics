"use client";

import {
  ArrowLeft,
  RefreshCw,
  Share,
  Plus,
  Info,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";

interface EditorToolbarProps {
  title: string;
  onContinueStory?: () => void;
  onDownloadPDF?: () => void;
  isGeneratingPDF?: boolean;
  isOwner?: boolean;
  onTitleUpdate?: (newTitle: string) => void;
}

export function EditorToolbar({
  title,
  onContinueStory,
  onDownloadPDF,
  isGeneratingPDF = false,
  isOwner = true,
  onTitleUpdate,
}: EditorToolbarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditingTitle(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleClick = () => {
    if (isOwner && onTitleUpdate) {
      setIsEditingTitle(true);
    }
  };

  const handleTitleSave = async () => {
    const newTitle = editingTitle.trim();
    if (newTitle && newTitle !== title) {
      try {
        const response = await fetch(
          `/api/stories/${window.location.pathname.split("/").pop()}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ title: newTitle }),
          }
        );

        if (!response.ok) {
          throw new Error("Failed to update title");
        }

        onTitleUpdate?.(newTitle);
        toast({
          title: "Title updated",
          description: "Story title has been updated successfully.",
          duration: 2000,
        });
      } catch (error) {
        console.error("Error updating title:", error);
        toast({
          title: "Failed to update title",
          description: "Could not update the story title.",
          variant: "destructive",
          duration: 3000,
        });
        setEditingTitle(title); // Reset to original
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditingTitle(title);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      handleTitleCancel();
    }
  };

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

        {isEditingTitle ? (
          <input
            ref={inputRef}
            type="text"
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleKeyDown}
            className="text-sm sm:text-base text-white font-normal tracking-[-0.02em] bg-transparent border-none outline-none truncate min-w-0 flex-1"
            style={{ width: `${editingTitle.length}ch` }}
          />
        ) : (
          <h1
            className={`text-sm sm:text-base text-white font-display font-normal tracking-[-0.02em] truncate ${
              isOwner && onTitleUpdate
                ? "cursor-pointer hover:text-gray-300"
                : ""
            }`}
            onClick={handleTitleClick}
          >
            {title}
          </h1>
        )}
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

        {onDownloadPDF && (
          <Button
            variant="ghost"
            className="hover:bg-secondary text-muted-foreground hover:text-white gap-1.5 sm:gap-2 text-xs h-8 sm:h-9 px-2 sm:px-3"
            onClick={onDownloadPDF}
            disabled={isGeneratingPDF}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
          </Button>
        )}

        {isOwner && onContinueStory && (
          <Button
            onClick={onContinueStory}
            className="relative gap-1.5 sm:gap-2 text-xs bg-white hover:bg-neutral-200 text-black h-8 sm:h-9 px-3 sm:px-4"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">
              Continue story{" "}
              <span className="text-gray-500 text-[10px]">(C)</span>
            </span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>
    </header>
  );
}
