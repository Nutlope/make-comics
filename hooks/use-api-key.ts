"use client";

import useLocalStorageState from "use-local-storage-state";

export type ModelMode = "fast" | "pro";

export function useApiKey(): [string | null, (key: string | null) => void] {
  const [apiKey, setApiKey] = useLocalStorageState<string | null>("together_api_key", { defaultValue: null });
  return [apiKey, setApiKey];
}

export function useModelMode(): [ModelMode, (mode: ModelMode) => void] {
  const [modelMode, setModelMode] = useLocalStorageState<ModelMode>("comic_model_mode", { defaultValue: "fast" });
  return [modelMode, setModelMode];
}



