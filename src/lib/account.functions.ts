import { createServerFn } from "@tanstack/react-start";
import { DEMO_BLOCKED_MESSAGE } from "@/lib/demo";

// Demo build — accounts cannot be deleted.
export const deleteAccount = createServerFn({ method: "POST" }).handler(async () => {
  throw new Error(DEMO_BLOCKED_MESSAGE);
});