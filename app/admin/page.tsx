import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdminIssuesFeed } from "@/components/Admin/AdminIssuesFeed";
import { AdminNGOQueue } from "@/components/Admin/AdminNGOQueue";
import { AdminFlaggedQueue } from "@/components/Admin/AdminFlaggedQueue";
import { AdminCommentQueue } from "@/components/Admin/AdminCommentQueue";
import { AdminUserList } from "@/components/Admin/AdminUserList";
import { AdminStats } from "@/components/Admin/AdminStats";
import { AdminSettings } from "@/components/Admin/AdminSettings";
import {
    Shield,
    Building2,
    Flag,
    BarChart2,
    MessageSquare,
    Users,
    Settings,
} from "lucide-react";

export default async function AdminPage() {
    const session = await auth();

    if (!session || (session.user as any).role !== "ADMIN") {
        redirect("/");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
        pendingNGOs,
        flaggedIssues,
        flaggedComments,
        totalIssues,
        totalUsers,
        resolvedToday,
        resolvedWithTime,
    ] = await Promise.all([
        prisma.nGO.count({ where: { status: "PENDING" } }),
        prisma.issue.count({ where: { isFlagged: true } }),
        prisma.comment.count({ where: { isFlagged: true, isDeleted: false } }),
        prisma.issue.count(),
        prisma.user.count(),
        prisma.issue.count({
            where: { status: "RESOLVED", resolvedAt: { gte: todayStart } },
        }),
        prisma.issue.findMany({
            where: { status: "RESOLVED", resolvedAt: { not: null } },
            select: { createdAt: true, resolvedAt: true },
            take: 100,
            orderBy: { resolvedAt: "desc" },
        }),
    ]);

    const avgResolutionDays =
        resolvedWithTime.length > 0
            ? Math.round(
                  resolvedWithTime.reduce((sum, i) => {
                      const diff =
                          (i.resolvedAt!.getTime() - i.createdAt.getTime()) /
                          (1000 * 60 * 60 * 24);
                      return sum + diff;
                  }, 0) / resolvedWithTime.length,
              )
            : null;

    return (
        <div className="min-h-screen max-w-4xl mx-auto px-4 py-6 pb-24">
            <div className="flex items-center gap-2.5 mb-6">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg" />
                    <Shield className="h-6 w-6 text-primary relative" />
                </div>
                <h1 className="font-display italic text-2xl font-bold tracking-tight">
                    Admin Dashboard
                </h1>
            </div>

            <AdminStats
                totalIssues={totalIssues}
                totalUsers={totalUsers}
                resolvedToday={resolvedToday}
                avgResolutionDays={avgResolutionDays}
            />

            <Tabs defaultValue="issues" className="mt-8 !flex-col">
                <TabsList className="w-full h-auto overflow-x-auto bg-white/[0.02] border border-white/[0.06] rounded-xl p-1 !flex-row !flex-nowrap">
                    <TabsTrigger
                        value="issues"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <BarChart2 className="h-3.5 w-3.5" />
                        Feed
                    </TabsTrigger>
                    <TabsTrigger
                        value="ngos"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <Building2 className="h-3.5 w-3.5" />
                        NGOs
                        {pendingNGOs > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none"
                            >
                                {pendingNGOs}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="flagged"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <Flag className="h-3.5 w-3.5" />
                        Flagged
                        {flaggedIssues > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none"
                            >
                                {flaggedIssues}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="comments"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Comments
                        {flaggedComments > 0 && (
                            <Badge
                                variant="destructive"
                                className="ml-1 h-4 min-w-4 px-1 text-[10px] leading-none"
                            >
                                {flaggedComments}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger
                        value="users"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <Users className="h-3.5 w-3.5" />
                        Users
                    </TabsTrigger>
                    <TabsTrigger
                        value="settings"
                        className="gap-1.5 data-[active]:bg-primary/15 data-[active]:text-primary data-[active]:border-primary/25 data-[active]:shadow-[0_0_8px_rgba(245,158,11,0.1)]"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="issues" className="mt-6">
                    <AdminIssuesFeed />
                </TabsContent>

                <TabsContent value="ngos" className="mt-6">
                    <AdminNGOQueue />
                </TabsContent>

                <TabsContent value="flagged" className="mt-6">
                    <AdminFlaggedQueue />
                </TabsContent>

                <TabsContent value="comments" className="mt-6">
                    <AdminCommentQueue />
                </TabsContent>

                <TabsContent value="users" className="mt-6">
                    <AdminUserList />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <AdminSettings />
                </TabsContent>
            </Tabs>
        </div>
    );
}
