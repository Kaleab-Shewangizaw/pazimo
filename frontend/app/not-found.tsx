import Link from "next/link"
import { Button } from "@/components/ui/button"
import { FileQuestion, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4">
        <header className="py-6">
        
        </header>

        <main className="flex-1 flex items-center justify-center min-h-[80vh]">
          <div className="text-center max-w-2xl mx-auto">
            <div className="mb-8">
              <FileQuestion className="h-32 w-32 text-primary/80 mx-auto" />
            </div>

            <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              404
            </h1>

            <h2 className="text-3xl font-semibold mb-6">
              Oops! Page Not Found
            </h2>

            <p className="text-muted-foreground text-lg mb-12 max-w-md mx-auto">
              Don't worry! The page you're looking for might have been moved or doesn't exist. Let's get you back on track.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="outline" className="group">
                <Link href="/" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                  Go Back
                </Link>
              </Button>
              <Button asChild size="lg">
                <Link href="/" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Back to Home
                </Link>
              </Button>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Pazimo. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}
