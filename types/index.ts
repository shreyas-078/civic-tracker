// ─── Enums ────────────────────────────────────────────────────────────────────

export type IssueStatus = "REPORTED" | "VERIFIED" | "ASSIGNED" | "RESOLVED" | "CLOSED";

export type IssueCategory =
  | "ROAD"
  | "WATER"
  | "ELECTRICITY"
  | "SANITATION"
  | "PUBLIC_SPACE"
  | "ENVIRONMENT"
  | "LOST_FOUND"
  | "OTHER";

export type UserRole = "CITIZEN" | "NGO" | "ADMIN";

export type NGOStatus = "PENDING" | "APPROVED" | "BLACKLISTED";

export type VoteType = "UPVOTE" | "DOWNVOTE";

export type NotificationType =
  | "ISSUE_VERIFIED"
  | "ISSUE_ASSIGNED"
  | "ISSUE_RESOLVED"
  | "RESOLUTION_VERIFY_REQUEST"
  | "COMMENT_REPLY"
  | "VOTE_MILESTONE"
  | "BADGE_AWARDED"
  | "NGO_APPLICATION_UPDATE"
  | "DEADLINE_WARNING"
  | "DUPLICATE_DETECTED";

export type BadgeType =
  | "FIRST_REPORT"
  | "TEN_REPORTS"
  | "FIFTY_REPORTS"
  | "VERIFIED_SOLVER"
  | "COMMUNITY_HERO"
  | "SPEEDY_REPORTER"
  | "NGO_PARTNER"
  | "FAST_RESOLVER"
  | "TOP_NGO";

// ─── Geo ──────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ─── Issue Filters ────────────────────────────────────────────────────────────

export interface IssueFilters {
  status?: IssueStatus[];
  category?: IssueCategory[];
  radius?: number;
  center?: GeoPoint;
  personal?: boolean;
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

export interface AIAnalysisResult {
  isDuplicate: boolean;
  duplicateOfId: string | null;
  priorityScore: number; // 1-10
  estimatedResolutionDays: number;
  suggestedCategory: string;
  moderationFlags: string[];
  // Image relevance moderation (only present when images were analyzed)
  imageModerationPassed?: boolean;
  imageModerationReason?: string | null;
}

// ─── Partial API shapes ───────────────────────────────────────────────────────

export interface IssuePinData {
  id: string;
  lat: number;
  lng: number;
  status: IssueStatus;
  category: IssueCategory;
  title: string;
  upvotes: number;
  isPersonal?: boolean;
}

export interface IssueCardData {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  status: IssueStatus;
  lat: number;
  lng: number;
  address?: string | null;
  imageUrls: string[];
  upvotes: number;
  downvotes: number;
  viewCount: number;
  priority: number;
  isPersonal: boolean;
  bounty?: number | null;
  isDuplicate: boolean;
  createdAt: string;
  deadline?: string | null;
  reporterId: string;
  reporter: {
    id: string;
    name?: string | null;
    image?: string | null;
    trustScore: number;
  };
  ngo?: {
    id: string;
    name: string;
  } | null;
  _count: {
    comments: number;
    votes: number;
  };
}

export interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  upvotes: number;
  parentId?: string | null;
  author: {
    id: string;
    name?: string | null;
    image?: string | null;
    trustScore: number;
  };
  replies?: CommentData[];
}

export interface UserProfileData {
  id: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  trustScore: number;
  totalReports: number;
  resolvedCount: number;
  createdAt: string;
  badges: { type: BadgeType; awardedAt: string }[];
  ngo?: {
    id: string;
    name: string;
    status: NGOStatus;
  } | null;
}

export interface NGOData {
  id: string;
  name: string;
  description: string;
  website?: string | null;
  phone?: string | null;
  categories: IssueCategory[];
  status: NGOStatus;
  approvedAt?: string | null;
  resolvedCount: number;
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
}

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  actionUrl?: string | null;
  createdAt: string;
  issue?: {
    id: string;
    title: string;
  } | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name?: string | null;
  image?: string | null;
  score: number;
  totalReports: number;
  resolvedCount: number;
  trustScore: number;
  badges: BadgeType[];
}

// ─── Session extension ────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      trustScore: number;
    };
  }
  interface User {
    role: UserRole;
    trustScore: number;
  }
}
