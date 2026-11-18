/**
 * In-memory moderation settings.
 * State persists for the lifetime of the Next.js server process.
 * Resets to the environment variable default on server restart.
 * Designed for demo-safe toggling via the admin panel.
 */

let _imageModerationEnabled: boolean =
    process.env.IMAGE_MODERATION_ENABLED !== "false";

export const ModerationSettings = {
    isImageModerationEnabled(): boolean {
        return _imageModerationEnabled;
    },
    setImageModerationEnabled(enabled: boolean): void {
        _imageModerationEnabled = enabled;
        console.log(
            `[moderation] Image moderation ${enabled ? "ENABLED" : "DISABLED"}`,
        );
    },
    getAll() {
        return {
            imageModerationEnabled: _imageModerationEnabled,
        };
    },
};
