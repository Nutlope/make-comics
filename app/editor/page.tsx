"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { EditorToolbar } from "@/components/editor/editor-toolbar"
import { PageSidebar } from "@/components/editor/page-sidebar"
import { ComicCanvas } from "@/components/editor/comic-canvas"
import { ApiKeyModal } from "@/components/api-key-modal"
import { PageInfoSheet } from "@/components/editor/page-info-sheet"
import { GeneratePageModal } from "@/components/editor/generate-page-modal"

interface PageData {
  id: number
  title: string
  image: string
  prompt: string
  characterUploads?: string[]
  style: string
}

const DEMO_PAGES: PageData[] = [
  {
    id: 1,
    title: "Redwing: Guardian of NYC",
    image: "/comic-book-superhero-action-scene-noir-style-dark-.jpg",
    prompt:
      "A superhero named Redwing protects NYC from the shadows. Tonight, a new villain threatens the city with stolen tech...",
    style: "Noir",
  },
]

export default function EditorPage() {
  const [pages, setPages] = useState<PageData[]>(DEMO_PAGES)
  const [currentPage, setCurrentPage] = useState(0)
  const [showApiModal, setShowApiModal] = useState(false)
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [loadingPageId, setLoadingPageId] = useState<number | null>(null)
  const [lastCharacterFiles, setLastCharacterFiles] = useState<File[]>([])
  const [lastCharacterUploads, setLastCharacterUploads] = useState<string[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const firstPageData = sessionStorage.getItem("firstPageData")
    if (firstPageData) {
      const data = JSON.parse(firstPageData)
      setPages([
        {
          ...pages[0],
          prompt: data.prompt,
          style: data.style,
          image: data.imageUrl || pages[0].image,
          characterUploads: data.characterUploads,
        },
      ])

      if (data.characterUploads && data.characterUploads.length > 0) {
        setLastCharacterUploads(data.characterUploads)
      }

      sessionStorage.removeItem("firstPageData")
    }

    toast({
      title: "Comic generated successfully",
      description: "Your comic page is ready to view",
      duration: 4000,
    })
  }, [toast])

  const handleAddPage = () => {
    const storedKey = localStorage.getItem("together_api_key")
    if (!storedKey && pages.length >= 1) {
      setShowApiModal(true)
      return
    }
    setShowGenerateModal(true)
  }

  const handleContinueStory = () => {
    const storedKey = localStorage.getItem("together_api_key")
    if (!storedKey) {
      setShowApiModal(true)
      return
    }
    setShowGenerateModal(true)
  }

  const handleApiKeyClick = () => {
    setShowApiModal(true)
  }

  const handleApiKeySubmit = (key: string) => {
    localStorage.setItem("together_api_key", key)
    setShowApiModal(false)
    const wasGenerating = showGenerateModal
    if (wasGenerating) {
      setShowGenerateModal(true)
    }

    toast({
      title: "API key saved",
      description: "Your Together API key has been saved successfully",
      duration: 3000,
    })
  }

  const handleGeneratePage = async (data: {
    prompt: string
    style: string
    characterFiles?: File[]
    isContinuation?: boolean
  }) => {
    setShowGenerateModal(false)

    const newPageId = pages.length + 1

    let characterUploads: string[] = []
    if (data.characterFiles && data.characterFiles.length > 0) {
      characterUploads = await Promise.all(data.characterFiles.map((file) => fileToBase64(file)))
      setLastCharacterUploads(characterUploads)
    }

    const newPage: PageData = {
      id: newPageId,
      title: pages[0].title,
      image: "",
      prompt: data.prompt,
      characterUploads: characterUploads.length > 0 ? characterUploads : undefined,
      style: data.style,
    }

    setPages([...pages, newPage])
    setCurrentPage(pages.length)
    setLoadingPageId(newPageId)
    setLastCharacterFiles(data.characterFiles || [])

    try {
      const apiKey = localStorage.getItem("together_api_key")
      if (!apiKey) {
        throw new Error("API key not found")
      }

      const previousPage = pages[pages.length - 1]

      const response = await fetch("/api/generate-comic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: data.prompt,
          apiKey: apiKey,
          style: data.style,
          isContinuation: data.isContinuation,
          previousContext: data.isContinuation ? previousPage?.prompt : undefined,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate image")
      }

      const result = await response.json()

      setPages((prevPages) =>
        prevPages.map((page) =>
          page.id === newPageId
            ? {
                ...page,
                image: result.imageUrl,
              }
            : page,
        ),
      )

      toast({
        title: "Page generated successfully",
        description: `Page ${newPageId} is ready`,
        duration: 4000,
      })
    } catch (error) {
      console.error("Error generating page:", error)
      toast({
        title: "Generation failed",
        description: "Failed to generate comic page. Please try again.",
        variant: "destructive",
        duration: 4000,
      })

      setPages((prevPages) => prevPages.filter((page) => page.id !== newPageId))
      setCurrentPage(Math.max(0, pages.length - 1))
    } finally {
      setLoadingPageId(null)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <EditorToolbar
        title={pages[0]?.title || "Untitled Comic"}
        onContinueStory={handleContinueStory}
        onInfoClick={() => setShowInfoSheet(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <PageSidebar
          pages={pages}
          currentPage={currentPage}
          onPageSelect={setCurrentPage}
          onAddPage={handleAddPage}
          loadingPageId={loadingPageId}
          onApiKeyClick={handleApiKeyClick}
        />
        <ComicCanvas page={pages[currentPage]} />
      </div>

      <ApiKeyModal isOpen={showApiModal} onClose={() => setShowApiModal(false)} onSubmit={handleApiKeySubmit} />
      <GeneratePageModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onGenerate={handleGeneratePage}
        pageNumber={pages.length + 1}
        previousCharacters={lastCharacterFiles}
        previousPagePrompt={pages[pages.length - 1]?.prompt}
        previousPageStyle={pages[pages.length - 1]?.style?.toLowerCase()}
      />
      <PageInfoSheet isOpen={showInfoSheet} onClose={() => setShowInfoSheet(false)} page={pages[currentPage]} />
    </div>
  )
}
