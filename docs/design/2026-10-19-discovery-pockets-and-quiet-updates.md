# Discovery pockets and quiet updates

This follows [friend-led discovery](2026-10-19-friend-led-discovery.md). The yard remains a quiet companion beside work. A short play action should not require opening a large settings panel.

## Updates

GitHub installations check 20 seconds after startup and every six hours after a successful check. Failed automatic checks retry quietly after five minutes, fifteen minutes and one hour, then use the six-hour interval. Checks do not overlap downloads or each other. Finding the same version again does not repeat its notification. Store installations remain package-managed; development and E2E builds do not poll.

The quiet update entry opens Settings → About. That section owns the version, release notes, download progress, retry and explicit install/restart action. Automatic checks never open it or steal focus. Closing Settings leaves a download running. OS installers may still show their own permission prompts.

## Discovery and planting

New flower seeds and tree saplings come only from digging. Existing seeds, planted flowers, trees and album entries remain intact. A saved `garden.saplings` map holds counts by species; planting consumes one only after validating the location, species, capacity and available stock. Moving a tree costs nothing; removing one does not mint a new sapling.

The proposed balance is 30% empty ground, 25% flower seed, 20% tree sapling, 20% common keepsake and 5% uncommon keepsake. Tree species are selected from the catalog. A full pocket keeps the rolled outcome as a full-pocket result rather than rerolling a rarer reward. Existing tile replay, cooldown and persistence protections remain.

Six tree species and twelve keepsakes add variety. Six trees may grow in one scene, with 24 across all scenes, while placement excludes water, furniture and other roots. The tree chooser shows species names and owned counts; unavailable species explain that digging finds their saplings. An empty pocket offers digging rather than an unexplained disabled tool.

## Direct manipulation and feedback

A furniture drag preserves the point where it was grabbed, follows pointer movement immediately, and saves once on release. No backend round-trip belongs in pointer movement. A cancelled or failed move restores the saved position, and keyboard movement remains available. Native window dragging and HTML image dragging must not intercept a prop drag.

Digging uses a standing character pose with a separate shovel, soil opening and brief dirt particles. It never uses the coding/working sprite. The hole closes after the action; reduced motion uses a still soil mark and clear outcome. Cancelling before arrival does not award anything, while an already committed discovery is never duplicated.

## Navigation

Place and atmosphere, Play, and Menu remain the three wide-window entrances. Play exposes short actions; planting choices carry pocket counts. Settings and window management stay in Menu. A small resting window shows only scenery and friends; deliberate friend interaction opens a shallow play surface. Opening one surface closes a competing surface and cancellation returns to the yard.


## Screen density and feedback

Ordinary mouse controls use a 36-pixel height and readable 13-pixel labels. Settings caps its width at 720 pixels with a 128-pixel section index; smaller windows use the section chooser. Friend identity, Invite rows and chat keep their hierarchy without large reserved empty blocks.

The main menu keeps Place and atmosphere, Play, Friends, Invite and Settings immediately available. Window and desktop actions, including closing and quitting, share one disclosure. Import stays beside the Invite title rather than inside its optional search filters. Compact overlays temporarily replace the quiet update chip, restoring it when the scenery is visible again.

Editing dialogs keep headings and actions available while their bodies scroll. Inline failures and unsaved-change explanations reveal themselves without stealing focus. General messages join an open modal before its action row rather than covering the buttons or falling behind the backdrop. Startup warnings, game instructions and discoveries share one bounded flow outside the interactive yard; transient messages use the lower edge. The feedback lane prevents simultaneous events from claiming the same coordinates.
