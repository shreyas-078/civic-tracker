import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, CheckCircle, Clock } from "lucide-react";

interface Props {
    totalIssues: number;
    totalUsers: number;
    resolvedToday: number;
    avgResolutionDays: number | null;
}

export function AdminStats({
    totalIssues,
    totalUsers,
    resolvedToday,
    avgResolutionDays,
}: Props) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
                <CardContent className="p-4">
                    <MapPin className="h-4 w-4 text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">{totalIssues}</p>
                    <p className="text-xs text-muted-foreground">
                        Total Issues
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <Users className="h-4 w-4 text-muted-foreground mb-2" />
                    <p className="text-2xl font-bold">{totalUsers}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <CheckCircle className="h-4 w-4 text-emerald-400 mb-2" />
                    <p className="text-2xl font-bold text-emerald-400">
                        {resolvedToday}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Resolved Today
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardContent className="p-4">
                    <Clock className="h-4 w-4 text-amber-400 mb-2" />
                    <p className="text-2xl font-bold text-amber-400">
                        {avgResolutionDays != null
                            ? `${avgResolutionDays}d`
                            : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Avg Resolution
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
