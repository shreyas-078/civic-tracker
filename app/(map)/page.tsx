import { redirect } from "next/navigation";

// Map page moved to app/map/page.tsx — this route group entry is no longer needed.
export default function MapGroupPage() {
  redirect("/map");
}
