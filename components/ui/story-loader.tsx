"use client";

import { useState, useEffect } from "react";

const loaderSvgs = ["bang.svg", "oh.svg", "omg.svg"];

interface StoryLoaderProps {
  text?: string;
}

export function StoryLoader({ text = "Loading story..." }: StoryLoaderProps) {
  const [currentSvgIndex, setCurrentSvgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSvgIndex((prev) => (prev + 1) % loaderSvgs.length);
    }, 1200); // Change every 1200ms for slower transition

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-56 h-56 flex items-center justify-center">
        <img
          key={currentSvgIndex} // Force re-render for smooth transition
          src={`/loader/${loaderSvgs[currentSvgIndex]}`}
          alt="Loading..."
          className="w-full h-full object-contain animate-pulse transition-all duration-700 ease-in-out transform"
          style={{ filter: "invert(1)" }}
        />
      </div>
      <div className="text-white text-2xl font-display">{text}</div>
    </div>
  );
}
