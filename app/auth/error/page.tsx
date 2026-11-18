import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Authentication Error</h1>
        <p className="text-muted-foreground">
          Something went wrong during sign in. Please try again.
        </p>
        <Button render={<Link href="/auth/signin" />}>Back to Sign In</Button>
      </div>
    </div>
  );
}
