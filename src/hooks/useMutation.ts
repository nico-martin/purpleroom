import { useState } from "react";

export default function useMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      onSuccess?.(result);
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
