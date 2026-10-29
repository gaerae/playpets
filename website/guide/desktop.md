---
description: Send your friends out onto the desktop, and keep them around from the tray after you close the window
---

# Desktop mode

Send your friends out of the yard window and they live on your desktop instead. You can still see them while you work in other apps.

<Shot name="desktop" caption="Desktop mode. A friend lives on top of other windows and shows the coding agent's status in a speech bubble." />

## Turning it on and off <Since v="0.1.0" />

1. Open **Friends & settings → Window & desktop**.
2. Turn on **Show on desktop**.
3. If you like, also turn on **Stroll on desktop**, right below it. It works only while desktop mode is on.

Both switches show their current state, and the menu stays open while you adjust them. Turn off **Show on desktop** and your friends come back to the yard.

- Desktop mode is unavailable when you have no friends.
- The tray icon's menu has the same items, so you can turn it on and off without opening the yard window.

## Things to do on the desktop <Since v="0.1.0" />

| Action | How |
|---|---|
| Pat | Left-click a friend once |
| Move | Drag a friend and drop them. Another monitor works too |
| Chat | Point at a friend: its name shows below it with a speech mark. Click the name and the yard window opens on that friend's chat. A right-click does the same |
| Eye contact | Move the mouse over a resting friend's face, and their eyes follow it. Only v2 pets with 16-direction gaze artwork can do this |

A double-click does nothing, so no window opens by accident while you move a friend. The first time you turn desktop mode on, a notice tells you how to chat.

Names stay hidden until you point at a friend, so your friends blend in with your desk. The [coding agent](./agents.md)'s status and what a friend says float in a speech bubble above their head. A long line ends with "…" after three lines.

## Friends on every monitor <Since v="0.1.0" />

With several monitors, a friend can be on any of them. Drag one to another monitor and it stays there. If your monitors use different scaling, the mouse position is matched to each monitor's scale.

## Stroll on desktop <Since v="0.1.0" />

With **Stroll on desktop** on, your friends slowly wander around the desktop. They face the way they walk and stop to rest now and then, but they don't wander while you drag them. Turn it off and they stay where you left them.

## On top of other apps' full screen <Since v="0.1.0" />

| System | Friends float on top of |
|---|---|
| macOS | Everything, even another app in full screen. The desktop window becomes a special panel that also shows in full-screen spaces |
| Windows, Linux | Normal windows |
| Linux, Wayland session | Not guaranteed. Wayland gives apps no way to stay on top or know where the mouse is, so friends can end up behind other windows and don't follow the mouse. Clicking and dragging friends there hasn't been tested yet |
| Linux, X11 session | Normal windows, with mouse following |

## Still there after you close the window <Since v="0.1.0" />

- The yard has no title bar or window buttons on any OS.
  - Move: drag the narrow transparent area along its top edge.
  - Resize: drag an edge or corner, down to 300 × 210.

Closing the window only hides it. Use **Friends & settings → Close window** or the system close shortcut, and your desktop friends and agent hooks keep running.

On macOS the Dock icon goes away too, so no unresponsive icon is left in the Dock. It comes back when you open the yard again. On Windows and Linux the yard leaves the taskbar and stays only in the tray.

## Opening it again

Click the tray icon in the menu bar (macOS) or taskbar (Windows, Linux) and choose **Open the yard**. Clicking a friend's name on the desktop, or right-clicking the friend, opens the yard window too.

## Quitting for good

- Any of these quits at once, without asking:
  - **Friends & settings → Quit PlayPets**
  - **Quit PlayPets** in the tray menu
  - <kbd>⌘</kbd> <kbd>Q</kbd> on macOS
- In a small window, the corner button and a right-click on empty scenery lead to Friends & settings.

Conversations aren't saved when you quit, and your friends on the desktop go too. PlayPets remembers each friend's name, personality and size for next time, and whether desktop mode was on.
