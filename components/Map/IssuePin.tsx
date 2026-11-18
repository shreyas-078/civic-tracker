import type { IssueStatus } from "@/types";

interface Props {
  status: IssueStatus;
  isPersonal?: boolean;
  dimmed?: boolean;
}

export const STATUS_COLORS: Record<IssueStatus, string> = {
  REPORTED: "#ef4444",
  VERIFIED: "#f59e0b",
  ASSIGNED: "#8b5cf6",
  RESOLVED: "#22c55e",
  CLOSED: "#6b7280",
};

export function IssuePin({ status, isPersonal, dimmed }: Props) {
  const color = isPersonal ? "#ec4899" : STATUS_COLORS[status];
  const opacity = dimmed ? 0.35 : 1;
  const shouldPulse = status === "REPORTED" && !dimmed;

  return (
    <div
      className="relative cursor-pointer hover:scale-110 transition-transform"
      style={{ opacity }}
    >
      {/* Pulse ring for REPORTED */}
      {shouldPulse && (
        <div
          className="absolute inset-0 rounded-full pin-ripple"
          style={{ backgroundColor: color }}
        />
      )}

      {/* Pin body */}
      <svg
        width="24"
        height="32"
        viewBox="0 0 24 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 0C5.373 0 0 5.373 0 12c0 9 12 20 12 20s12-11 12-20C24 5.373 18.627 0 12 0z"
          fill={color}
        />
        <circle cx="12" cy="12" r="5" fill="white" fillOpacity="0.9" />
      </svg>

      {/* Personal bounty dot */}
      {isPersonal && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400 border border-white text-[6px] flex items-center justify-center font-bold">
          ₹
        </span>
      )}
    </div>
  );
}
