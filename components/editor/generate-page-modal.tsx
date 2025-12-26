"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";
import { validateFileForUpload, generateFilePreview } from "@/lib/file-utils";
import { COMIC_STYLES } from "@/lib/constants";

interface GeneratePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: {
    prompt: string;
    characterFiles?: File[];
    characterUrls?: string[];
  }) => void;
  pageNumber: number;
}

export function GeneratePageModal({
  isOpen,
  onClose,
  onGenerate,
  pageNumber,
}: GeneratePageModalProps) {
  const [prompt, setPrompt] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPrompt("");
      setUploadedFiles([]);
      setPreviews([]);
      setShowPreview(null);
      setIsGenerating(false);
    }
  }, [isOpen]);

  // Keyboard shortcut for form submission
  useKeyboardShortcut(() => {
    if (isOpen && !isGenerating && prompt.trim()) {
      handleGenerate();
    }
  }, { disabled: !isOpen || isGenerating });

  const handleFiles = async (newFiles: FileList | null) => {
    if (!newFiles) return;

    const filesArray = Array.from(newFiles);

    const validationResults = filesArray.map((file) => ({
      file,
      validation: validateFileForUpload(file, true),
    }));

    validationResults.forEach(({ validation }) => {
      if (!validation.valid && validation.error) {
        toast({
          title: "Invalid file",
          description: validation.error,
          variant: "destructive",
          duration: 4000,
        });
      }
    });

    const validFiles = validationResults
      .filter(({ validation }) => validation.valid)
      .map(({ file }) => file);

    if (validFiles.length === 0) return;

    const totalFiles = [...uploadedFiles, ...validFiles].slice(0, 2);
    setUploadedFiles(totalFiles);

    const newPreviews = await Promise.all(
      totalFiles.map((file) => generateFilePreview(file))
    );
    setPreviews(newPreviews);
  };

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    setPreviews(newPreviews);
    setShowPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);

    const fileDataUrls = await Promise.all(
      uploadedFiles.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            const [header, base64Data] = base64.split(",");
            // Send just the base64 data without the data URL prefix
            resolve(base64Data);
          };
          reader.readAsDataURL(file);
        });
      })
    );

    onGenerate({
      prompt,
      characterFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      characterUrls: fileDataUrls,
    });
  };



  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="border border-border/50 rounded-lg bg-background max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl text-white font-heading">
              Generate Page {pageNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Prompt Input */}
            <div className="relative glass-panel p-1 rounded-xl group focus-within:border-indigo/30 transition-colors">
              <div className="bg-background/80 rounded-lg p-4 border border-border/50">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] uppercase text-muted-foreground tracking-[0.02em] font-medium">
                    Prompt
                  </label>
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Continue the story... Describe what happens next."
                  disabled={isGenerating}
                  className="w-full bg-transparent border-none text-sm text-white placeholder-muted-foreground/50 focus:ring-0 focus:outline-none resize-none h-20 leading-relaxed tracking-tight"
                />

                <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                  {/* Character Upload */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {previews.length > 0 ? (
                        <div className="flex items-center gap-2">
                          {previews.map((preview, index) => (
                            <div key={index} className="relative group/thumb">
                              <button
                                onClick={() => setShowPreview(index)}
                                className="w-8 h-8 rounded-md overflow-hidden border border-border/50 hover:border-indigo/50 transition-colors"
                              >
                                <img
                                  src={preview || "/placeholder.svg"}
                                  alt={`New character ${index + 1}`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeFile(index)
                                }}
                                disabled={isGenerating}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity disabled:opacity-50"
                              >
                                <X className="w-2.5 h-2.5 text-white" />
                              </button>
                            </div>
                          ))}
                          {uploadedFiles.length < 2 && (
                            <button
                              onClick={() => !isGenerating && fileInputRef.current?.click()}
                              disabled={isGenerating}
                              className="w-8 h-8 rounded-md border border-dashed border-border/50 hover:border-indigo/50 flex items-center justify-center text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Upload className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => !isGenerating && fileInputRef.current?.click()}
                          disabled={isGenerating}
                          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Add new characters (optional)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground/70">
              Automatically references previous pages and existing characters from your story.
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="w-full gap-2 bg-white hover:bg-neutral-200 text-black tracking-tight"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating page...</span>
                </>
              ) : (
                `Generate Page ${pageNumber}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Character Preview Modal */}
      {showPreview !== null && previews[showPreview] && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-100 flex items-center justify-center p-4"
          onClick={() => setShowPreview(null)}
        >
          <div className="relative max-w-sm max-h-[80vh] glass-panel p-4 rounded-xl z-101">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 hover:bg-white/10 z-102"
              onClick={() => setShowPreview(null)}
            >
              <X className="w-4 h-4" />
            </Button>
            <img
              src={previews[showPreview] || "/placeholder.svg"}
              alt="Character preview"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
