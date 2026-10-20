import { useEffect, useState } from "react";

import { api } from "../api";

type Result = { username: string; status: "available" | "taken" | "error" };

export default function useUsernameAvailability(
  username: string,
  currentUsername: string | null
) {
  const [result, setResult] = useState<Result | null>(null);
  const current = username !== "" && username === currentUsername;
  const valid =
    username.length >= 4 &&
    username.length <= 40 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username);
  useEffect(() => {
    if (!valid || current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api<{ username: string; available: boolean }>(
        `/speaker/username-availability?username=${encodeURIComponent(username)}`,
        { signal: controller.signal }
      )
        .then((value) => {
          if (!controller.signal.aborted)
            setResult({
              username,
              status: value.available ? "available" : "taken",
            });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setResult({ username, status: "error" });
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [username, valid, current]);
  const reset = () => setResult(null);
  if (username === "") return { status: "idle", message: "", reset } as const;
  if (current)
    return {
      status: "current",
      message: "This is your current username.",
      reset,
    } as const;
  if (username.length < 4)
    return {
      status: "invalid",
      message: "Use at least 4 characters.",
      reset,
    } as const;
  if (!valid)
    return {
      status: "invalid",
      message:
        "Use 4–40 lowercase letters or numbers, separated by single dashes.",
      reset,
    } as const;
  if (result?.username !== username)
    return {
      status: "checking",
      message: "Checking username…",
      reset,
    } as const;
  if (result.status === "available")
    return {
      status: "available",
      message: "This username is available.",
      reset,
    } as const;
  if (result.status === "taken")
    return {
      status: "taken",
      message: "This username is already taken.",
      reset,
    } as const;
  return {
    status: "error",
    message:
      "Could not check availability. You can still try saving; availability will be checked then.",
    reset,
  } as const;
}
