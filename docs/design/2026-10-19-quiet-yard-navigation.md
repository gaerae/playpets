# Quiet yard navigation and updates

## Intent

PlayPets is a place to leave open, with short breaks for atmosphere changes and play. Frequent actions belong near the yard. Friend management, app preferences and window controls should not compete with them. Keep the existing plain ES modules, Tauri backend, artwork and game rules.

## Entry points

- The wide-window dock has Place & atmosphere, Play and Menu. Small windows keep the dock hidden and retain keyboard access and right-click access.
- Play opens a dedicated activity panel: picnic, group conversation, planting, fishing when the place supports it, collection and the existing games. Games keep their current rules and active-game stop action. No activity lives behind a general “More” disclosure. Without friends, show an Invite action instead of an empty panel.
- Menu groups destinations into Yard (place and play), Friends (individual chat, friend management and invite), and App (settings). Window and desktop controls have their own labeled disclosure. Closing the window and quitting the app stay clearly distinct.
- Right-clicking empty scenery opens a short action menu, not the full settings/tool surface. It offers Place & atmosphere, Play, Friends, Always on top, and Menu. These delegate to the same existing action handlers. Right-clicking a friend, editable field or interactive object keeps its own behavior.

## Interaction contract

Only one yard panel or menu opens at a time. Opening a destination dismisses its opener; Back returns to the menu and Close restores focus to the visible opener, or the yard in a small window. Escape closes the nearest surface before it can leave fullscreen. Arrow keys move through the right-click menu; Home and End reach its boundaries. Menu rows stay within the viewport after opening or resizing, and long content scrolls inside the panel with its header reachable.

The Always on top row uses a checked menu action. Its keyboard navigation includes checkbox menu items. The context menu scrolls at the minimum window size rather than dropping destinations.

Keep 44-pixel action targets in activity panels, a consistent spacing scale and existing semantic surface/radius tokens. Pointer menus can use the established compact desktop-menu row height. Do not remove keyboard focus indicators. Test 300 × 210, 460 × 320 and 1180 × 850, all four locales, light/dark and reduced motion. Do not add a component framework for these controls.

## Updates

The current updater already downloads in the app. Replace the blocking HTML modal with a non-modal update panel over the same yard. An available update remains an explicit choice. Show the target version, release-notes link and an Install and restart action before starting. Once chosen, the existing backend downloads, checks the signature, installs and restarts; do not silently restart without that initial action.

The person can collapse the panel while downloading and keep using the yard. A small persistent progress indicator remains reachable even when the dock is hidden. Reopening shows the same download rather than starting another. Errors remain visible with Retry; collapsing does not discard them. Unknown download sizes use indeterminate progress. Restart success appears once in the usual notice area only when the running version matches the requested version.

Explicitly opening update details dismisses ordinary yard popovers without discarding the underlying task. Progress and error events never open the panel or move focus. Opening another task collapses update details, retaining the progress indicator.

Store-managed installs keep their separate update channel and never invoke a GitHub installer. Real OS installer hand-off remains subject to platform restrictions; changing the panel cannot remove those requirements.

## Release boundary

Local package and Rust versions are already 1.0.0; the published GitHub release is still 0.2.0. Rebuild installers and Store packages after these visible changes. Refresh affected instructions and captures in all four languages, run the repository checks and real-app scenarios, then integrate and release through the repository's PR and CI process. Do not publish an older uploaded Store package as the revised app. Store rating interpretation and final IARC consent are separate prerequisites, not reasons to invent answers.

## Follow-up: a quiet companion during work

The primary small-window use is a companion beside work. The resting view is scenery and friends. Hover does not open controls. Short, deliberate visits to play take priority over chat, invitations and app administration.

At compact sizes, Play opens a shallow action strip instead of the wide activity panel. A friend's name or context action leads to the same strip with that friend selected. Choosing an action closes it; choosing a game replaces its action row and offers Back in the same place. A running game offers Stop through the same entrance. Clicking elsewhere or pressing Escape returns to scenery. Do not add daily-task counts, collection reminders, reward loops, persistent progress bars for play or automatic focus changes to this view.

Management destinations remain explicitly available through Menu and keyboard shortcuts. They do not appear merely because a friend was pressed. The wide window retains the full Play destination. Window size does not change stored friends, game rules or collection data.

This is a companion with optional play, not a small dashboard. New discovery effects and collection feedback should be brief, tied to an explicit action, and leave the scene without demanding another click.

## Follow-up: spacing and boundaries

Control surfaces use an 8-pixel outer inset, with 4-pixel spacing between adjacent actions and 8-pixel spacing between groups. A header and a change of functional group can have a single separator. Individual action rows remain unboxed until hover, focus or selection. Keep the resting scenery free of panel outlines.

The compact pointer menu fits all five actions at 300 by 210, including its outer margin. Compact pointer rows are 36 pixels high; the play strip keeps 44-pixel action targets. Do not reduce text or target sizes merely to hide an overflow problem. Wide menus, the scene chooser and management sheets share the tighter insets without changing their scroll ownership.

## Follow-up: the pointer menu over a chat

- The pointer menu is not a destination. It opens over a chat and leaves it open.
- Choosing a destination from it closes the chat as before. Esc or a press away goes back to the chat.
- The app starts on the resting view. The open panel is kept for a reload only, not for the next start.
