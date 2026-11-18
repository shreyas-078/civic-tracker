export default function Loading() {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <div className="absolute inset-0 h-10 w-10 rounded-full bg-primary/10 blur-xl animate-pulse" />
            </div>
        </div>
    );
}
