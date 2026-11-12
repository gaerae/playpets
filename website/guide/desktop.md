---
description: Send your friends out onto the desktop, and keep them around from the tray after you close the window
---

# Desktop mode

Send your friends out of the yard window and they live on your desktop, on top of the apps you work in.

::: tip At a glance
| To | Do this | More |
|---|---|---|
| Send one friend out | Right-click it in the yard → **Show on desktop** | [Turning it on and off](#turning-it-on-and-off) |
| Send everything out | **Friends & settings → Window & desktop → Show on desktop** | [Turning it on and off](#turning-it-on-and-off) |
| Let friends wander | **Stroll on desktop**, right below it | [Stroll on desktop](#stroll-on-desktop) |
| Put a gift, flower or tree on your desk | Right-click it in the yard → **Show on desktop** | [Gifts](#gifts-on-the-desktop), [flowers and trees](#flowers-and-trees-on-the-desktop) |
| Chat with a friend | Point at it, then click its name | [Things to do](#things-to-do-on-the-desktop) |
| Bring something back | Right-click it → **Take off the desktop** | [Things to do](#things-to-do-on-the-desktop) |
| Hide the window, keep friends out | **Friends & settings → Close window** | [Close, reopen, quit](#close-reopen-and-quit) |
:::

<Shot name="desktop" caption="Desktop mode. A friend lives on top of other windows and shows the coding agent's status in a speech bubble." />

## Turning it on and off <Since v="0.1.0" /> {#turning-it-on-and-off}

One friend: right-click it in the yard and choose **Show on desktop**. A check mark shows it's out; choose it again to bring it back. Each friend goes out on its own and stays in the yard too.

Every friend at once:

1. Open **Friends & settings → Window & desktop**.
2. Turn on **Show on desktop**.
3. If you like, turn on **Stroll on desktop** right below it. It works only while something is out on the desktop.

- Both switches show their current state, and the menu stays open while you change them.
- Turning off **Show on desktop** brings everything back to the yard: friends, gifts, flowers and trees.
- Desktop mode is unavailable with no friends.
- The tray icon's menu has the same items, so you don't need to open the yard window.

## Things to do on the desktop <Since v="0.1.0" /> {#things-to-do-on-the-desktop}

| Action | How |
|---|---|
| Pat | Left-click a friend once |
| Move | Drag a friend and drop it, onto another monitor too |
| Chat | Point at a friend: its name shows below it with a speech mark. Click the name and the yard opens on that friend's chat |
| Menu | Right-click a friend for **Talk to** or **Take off the desktop**. A gift, a flower and a tree have **Take off the desktop** |
| Eye contact | Move the mouse over a resting friend's face and its eyes follow. Only v2 pets with 16-direction gaze artwork can do this |

- A double-click does nothing, so no window opens by accident while you move a friend.
- The first time you send something out, a notice tells you how to chat and how to bring it back.
- Names stay hidden until you point at a friend, so friends blend in with your desk.
- The [coding agent](./agents.md)'s status and what a friend says float in a speech bubble above its head. A long line ends with "…" after three lines.

## Gifts on the desktop <Since v="1.5.0" /> {#gifts-on-the-desktop}

Right-click a gift in the yard, such as the bench or a flowerpot, and choose **Show on desktop**. It stays in the yard too.

- Drag it to move it, onto another monitor too. It stays where you leave it.
- Friends strolling on the desktop walk over to a gift now and then, stand beside it and say something about it.
- Putting a gift away in the yard takes it off the desktop too. A gift that came before can be set out again from the album ([Gifts](./play.md#gifts)).
- The snowman and the Christmas gifts are on the desktop only while the yard shows them ([Seasonal events](./play.md#seasonal-events)). The snowman keeps its scarf, hat and nose and the tree its ornaments.
- On [Christmas night](./play.md#christmas-night) the tree on the desktop grows along with the one in the yard.

## Flowers and trees on the desktop <Since v="1.6.1" /> {#flowers-and-trees-on-the-desktop}

Right-click a flower or a tree you planted and choose **Show on desktop**. It stays in the yard as well.

- It grows on the desktop as in the yard: send out a sprout and it flowers on your desk.
- A grown tree wears the season the yard shows.
- A tree from another place stays out whichever place the yard shows.
- Drag it to move it, like a gift. Friends strolling on the desktop walk over to it now and then.
- Pull it up or remove it in the yard and it leaves the desktop too.

## Stroll on desktop <Since v="0.1.0" /> {#stroll-on-desktop}

- With **Stroll on desktop** on, friends slowly wander the desktop, face the way they walk and stop to rest now and then.
- They don't wander while you drag them.
- Turn it off and they stay where you left them.

## Friends on every monitor <Since v="0.1.0" />

- With several monitors, a friend can be on any of them: drag it there and it stays.
- With different scaling per monitor, the mouse position is matched to each monitor's scale.

## On top of other apps' full screen <Since v="0.1.0" />

| System | Friends float on top of |
|---|---|
| macOS | Everything, even another app in full screen. The desktop window becomes a special panel that also shows in full-screen spaces |
| Windows, Linux | Normal windows |
| Linux, Wayland session | Not guaranteed. Wayland gives apps no way to stay on top or know where the mouse is, so friends can end up behind other windows and don't follow the mouse. Clicking and dragging friends there hasn't been tested yet |
| Linux, X11 session | Normal windows, with mouse following |

## Close, reopen and quit <Since v="0.1.0" /> {#close-reopen-and-quit}

| To | How | What happens |
|---|---|---|
| Hide the window | **Friends & settings → Close window**, or the system close shortcut | The yard hides in the tray; desktop friends and agent hooks keep running. On macOS the Dock icon goes too, so no unresponsive icon is left, and comes back when you open the yard. On Windows and Linux the yard leaves the taskbar |
| Open it again | The tray icon in the menu bar (macOS) or taskbar (Windows, Linux) → **Open the yard**; or click a friend's name on the desktop, or **Talk to** in its menu | The yard window opens |
| Quit | **Friends & settings → Quit PlayPets**, **Quit PlayPets** in the tray menu, or <kbd>⌘</kbd> <kbd>Q</kbd> on macOS | PlayPets quits at once, without asking. Conversations aren't saved and desktop friends go too |

- The yard has no title bar or window buttons on any system. Drag the narrow transparent strip along its top to move it, or an edge or corner to resize it, down to 300 × 210.
- In a small window, the corner button and a right-click on empty scenery lead to Friends & settings.
- After quitting, PlayPets remembers each friend's name, personality and size, and which friends, gifts, flowers and trees were out on the desktop.
