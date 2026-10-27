---
description: How to send friends out onto the desktop and keep them around from the tray after closing the window
---

# Desktop mode

- Send your friends out of the yard window to live on the desktop.
- They stay visible while you work in other apps.

<Shot name="desktop" caption="Desktop mode. A friend lives on top of other windows and shows the coding agent's status in a speech bubble." />

## Turning it on and off <Since v="0.1.0" />

1. Open **Friends & settings → Window & desktop**.
2. Turn on **Show on desktop**.
3. Optional: turn on **Stroll on desktop**, right after it. Available only while desktop mode is on.

- Both switches show their current state. The menu stays open while you adjust them.
- Turn off **Show on desktop** to bring your friends back.
- With no friends, desktop mode is unavailable.
- The tray icon's menu has the same items: turn it on and off without opening the yard window.

## Things to do on the desktop <Since v="0.1.0" />

| Action | How |
|---|---|
| Pat | Left-click a friend once |
| Move | Drag a friend and drop them. Another monitor works too |
| Chat | Point at a friend: its name shows below it with a speech mark. Click the name and the yard window opens on that friend's chat. A right-click does the same |
| Eye contact | Move the mouse over a resting friend's face; their eyes follow it. Only v2 pets with 16-direction gaze artwork can do this |

- A double-click does nothing, so no window opens by accident while you move a friend.
- The first time desktop mode turns on, a notice says how to chat.
- Names stay hidden until you point at a friend, so friends blend in with your desk.
- The [coding agent](./agents.md)'s status and what the friend says float in a speech bubble above their head. A long line ends with "…" after three lines.

## Friends on every monitor <Since v="0.1.0" />

- With several monitors, a friend can be on any of them.
- Drag a friend to another monitor and they stay there.
- Monitors with different scaling: the mouse position is matched to each monitor's scale.

## Stroll on desktop <Since v="0.1.0" />

- **Stroll on desktop** on: friends slowly wander around the desktop.
  - They face the way they walk and stop to rest now and then.
  - They do not wander while you drag them.
- Off: they stay where you left them.

## On top of other apps' full screen <Since v="0.1.0" />

| System | Friends float on top of |
|---|---|
| macOS | Everything, even another app in full screen. The desktop window becomes a special panel that also shows in full-screen spaces |
| Windows, Linux | Normal windows |
| Linux, Wayland session | Not guaranteed. Wayland gives apps no way to stay on top or know where the mouse is, so friends can end up behind other windows and do not follow the mouse |
| Linux, X11 session | Normal windows, with mouse following |

## Still there after you close the window <Since v="0.1.0" />

- The yard has no title bar or window buttons on any OS.
  - Move: drag the narrow transparent area along its top edge.
  - Resize: drag an edge or corner, down to 300 × 210.
- Hide it: **Friends & settings → Close window**, or the system close shortcut. Desktop friends and agent hooks keep running.

- On macOS, closing the window also removes the Dock icon, so no unresponsive icon is left in the Dock. Open the yard again and the Dock icon comes back.
- On Windows and Linux, it disappears from the taskbar and stays only in the tray.

## Opening it again

- Click the tray icon in the menu bar (macOS) or taskbar (Windows, Linux) and choose **Open the yard**.
- Clicking a friend's name on the desktop (or right-clicking the friend) also opens the yard window.

## Quitting for good

- Any of these quits at once, without asking:
  - **Friends & settings → Quit PlayPets**
  - **Quit PlayPets** in the tray menu
  - <kbd>⌘</kbd> <kbd>Q</kbd> on macOS
- In a small window, the corner button and a right-click on empty scenery lead to Friends & settings.
- On quit: conversations are not saved, and friends on the desktop go too.
- Remembered for next time: each friend's name, personality and size, and whether desktop mode was on.
