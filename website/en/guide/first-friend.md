---
description: How to pick a pet in the Invite tab and make it a friend, then pat it and give it treats in the yard
---

# Invite your first friend

When you first open the app, the yard is empty and says "Invite your first friend". Open the **Invite** tab at the top right.

## Three starter pets <Since v="0.1.0" />

On first start the Invite tab has **PlayPets starter pets**: Tabby, Smoky and Mochi. They are Codex-format pets drawn from the mascot, so you invite them, send them to the desktop and give them an AI exactly like any other pet. Their files sit under `builtin/` in the data folder.

## Three steps to start <Since v="0.1.0" />

On first start a card in the middle of the yard shows three steps: invite a friend, give a friend an AI, give an agent a friend. Each step is ticked when done and the card moves to the corner; it disappears when all three are done, or earlier with **Hide this**.

## The Invite tab <Since v="0.1.0" />

<Shot name="invite" caption="The Invite tab groups cards by where the pets are." />

The Invite tab splits the cards into three groups, depending on where the pet file lives.

| Group | Where the pets come from |
|---|---|
| Codex pet folder | Codex pets in `~/.codex/pets`. They show up automatically |
| Pets imported from an address | Community pets you got with **Import a pet**. Saved in `pets/` in the data folder |
| Pets picked from this computer | Pets in a folder you picked yourself. Not copied; the app reads that folder as it is |

The first two groups have an **Open folder** button that opens the folder in Explorer or Finder. If there are no cards at all, start with [Import a pet](./import.md).

The **Shape** chips above the shelf (All · People · Animals · Other) narrow it to human-shaped pets, handy when picking a partner or a senior. They follow the pet file's `kind`.

## Inviting a friend <Since v="0.1.0" />

1. Click a card. The `+` on the right of the card means "Invite to the yard".
2. The friend appears in the yard and waves. The panel switches to the Friend tab.
3. Click the same pet again and it becomes "Invite one more". From the second friend on, a number is added after the name so you can tell them apart.

The yard holds up to 12 friends.

## Friend settings <Since v="0.1.0" />

Click **Friend settings** in the Friend tab to change the name, personality, relationship, what it calls you, and size.

- **Name**: shown on the name tag in the yard and in the chat. Up to 24 characters.
- **Personality**: your friend answers in this personality when you chat. At first the pet file's introduction is used as the personality; edit it or add to it and save to change that. Click **Add the pet file's introduction** to bring the original introduction back. Up to 400 characters. If no AI is connected, the personality is not used yet.
- **Size**: five steps, Tiny, Small, Medium, Large and Huge. Slide it and the yard changes right away.

The friend ID is shown at the bottom of the window. You use it to point at a specific friend in [Coding agent hooks](./agents.md).

To send a friend away from the yard, click **Send away**. Your conversation so far goes with them, but the pet stays in the Invite tab, so you can invite them again any time.

## Things to do in the yard <Since v="0.1.0" />

The line above the yard says "Click to pat · drag to move · double-click to chat". Here is what you can do with a friend.

| Action | How |
|---|---|
| Pat | Click a friend once. They jump and show a heart |
| Move | Drag a friend and drop them. Their place in the yard is remembered |
| Chat | Double-click a friend. The Friend tab opens on that friend |
| Put down a treat | Click **Treat** in the toolbar, then click where in the yard to put it. All the friends walk over, eat it and say "Yum, thank you!". The treat disappears after 15 seconds |
| Say hi together | Click **Say hi** and the friends wave one after another with a greeting that fits the time of day |

A **name tag** floats above each friend. When you select a friend, the name tag changes to its selected look, and while a coding agent is working, the status is shown next to the name tag.

Left alone, friends slowly wander around the yard and talk to themselves. When it rains they say things like "Got an umbrella?", and at night they get sleepy. Time of day and weather are explained in [The yard and games](./play.md).

## What next

- To talk with your friend, go to [Chat with a friend](./chat.md).
- To put your friend out on the desktop, see [Desktop mode](./desktop.md).
