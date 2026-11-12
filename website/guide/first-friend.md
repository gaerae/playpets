---
description: Pick a pet in Invite a friend to make it your friend, then pat it and give it treats in the yard
---

# Invite your first friend

Pick a pet, and it comes into the yard as your friend. Pat it, move it, talk to it and set out treats.

1. Open the app. The empty yard asks **Who would you like to play with?** and shows four moving companions to choose from.
2. Click one. It comes into the yard and waves.

**See other pets** opens **Invite a friend**, which shows every pet on this computer.

::: tip At a glance
| To | Do this | More |
|---|---|---|
| Invite another friend | **Friends & settings → Invite a friend**, then a card's `+` | [Inviting a friend](#inviting-a-friend) |
| Pat it | Click the friend once | [Things to do in the yard](#things-to-do-in-the-yard) |
| Talk to it | Click its name tag | [Talking with friends](./chat.md) |
| Set out a treat | **Play → Garden → Picnic**, then a spot | [Things to do in the yard](#things-to-do-in-the-yard) |
| Change its name, personality or size | **⋯** by its name → **Edit** | [Friend settings](#friend-settings) |
| Bring in more pets | **Import a pet** in Invite a friend | [Importing pets](./import.md) |
:::

## Bundled companions <Since v="0.1.0" />

On first start, Invite a friend shows **PlayPets starter pets**:

| Friend | Who |
|---|---|
| Daisy | The explorer |
| Clover | The kitten gardener, and the app's main mascot |
| Pip | The cheerful puppy |
| Miso | The gentle otter |

- Their cards show these names in every language.
- They use the Codex pet format: invite them, send them to the desktop and give them an AI like any other pet. Their files sit under `builtin/` in the data folder.
- Each can be taken home by itself: the friend gallery on the [home page](../index.md#companions) downloads `playpets-<name>.zip`, seasonal outfits included. PlayPets imports it as a [ZIP file](./import.md#zip-file). Unzipped into the Codex pets folder (`~/.codex/pets`, or `%USERPROFILE%\.codex\pets` on Windows), the friend joins you in ChatGPT and Codex too.
- They change clothes with the selected season, in the yard and in desktop mode; on Auto, the season follows the local calendar. Light clothes in summer, warm clothes in winter, layered everyday outfits in spring and autumn. Faces, accessories and actions stay recognizable whatever they wear.

Built-in friends from earlier versions keep their saved IDs, names, settings and closeness; only their look moves to this cast:

| Earlier friend | Now looks like |
|---|---|
| Aria | Daisy |
| Noah | Pip |
| The original cats | Clover |

Pets you imported are unchanged. Chat lasts only for the session and isn't restored after a restart.

## Companion stories <span id="companion-stories"></span>

These short stories introduce the cast. You can change each friend's personality in Friend settings, and conversations use it only when an AI is connected.

All four share a little sign that they belong together: a white flower with a golden center.

### Daisy, A little further down the path

Daisy follows the paths other people hurry past. A new flower or a whale-shaped cloud is enough to make a day worth remembering. Daisy likes sharing what she discovers, without turning every outing into a race.

### Clover, Something grew today

Clover is the garden's quiet caretaker and PlayPets' main mascot. Clover notices a new leaf before anyone else and saves a sunny patch for a friend. Clover's favorite kind of progress is something small, given time to grow.

### Pip, There is room for one more

Pip is usually the first to wave at someone new. In an indigo denim jacket and ivory shorts, Pip brings energy to a walk or a game, then makes sure nobody is left behind. To Pip, a good afternoon is one everyone can join.

### Miso, A page beside the pond

Miso is a gentle otter in a lavender knit vest who keeps a book nearby. Miso leaves plenty of room for pauses and likes watching the ripples while a thought settles. Company doesn't always need a conversation. Sometimes sitting together is enough.

## Next up <Since v="0.1.0" />

After your first friend arrives, a small **Next up** card in the corner shows what's left:

| Step | Button |
|---|---|
| Connect an AI to a friend | **Connect**. With Claude Code or Codex CLI on this computer, **Connect now** attaches that tool to every friend in one step, with no key ([Chat with a friend](./chat.md#making-a-connection)) |
| Pick a friend to bring news from your coding agent | **Choose** |

- Each step gets a tick when it's done. The card disappears once they all are, or sooner with **Hide this**.
- While the yard has no friends, play tools are hidden. **Friends & settings → Invite a friend** stays available.

## Invite a friend <Since v="0.1.0" />

<Shot name="invite" caption="Invite a friend groups cards by where the pets are." />

Cards come in four groups, by where the pet file lives. An empty group isn't shown.

| Group | Where the pets come from | **Open folder** |
|---|---|---|
| PlayPets starter pets | Four pets bundled with the app, unpacked in `builtin/` in the data folder | Yes |
| Codex pet folder | Codex pets in `~/.codex/pets`. They show up automatically | Yes |
| Pets imported from an address or ZIP | Pets you got with **Import a pet**, from a community page or a ZIP file. Copied into `pets/` in the data folder | Yes |
| Pets picked from this computer | Pets in a folder you picked yourself. Not copied; the app reads that folder as it is | No; each card shows its folder name |

- **Open folder** opens the folder in Explorer or Finder.
- **Type** chips above the shelf (All, People, Animals, Other) follow the pet file's `kind`. Narrow the shelf to human-shaped pets when you're picking a partner or a mentor.
- **Search pets** narrows the same shelf by name or creator, together with the type filter. **Show all** clears both.
- No cards at all? Start with [Import a pet](./import.md).

## Inviting a friend <Since v="0.1.0" />

1. Click a card (the `+` on its right). A card for a friend already in the yard says **Invite one more**.
2. The friend appears in the yard and waves, and the Friend panel opens on that friend.
3. Click the same pet again for **Invite one more**. From the second friend on, a number follows the name so you can tell them apart.

The yard holds up to 12 friends.

## Friend settings <Since v="0.1.0" />

In the Friend panel, choose **Edit** (the pencil) in the **⋯** menu by the friend's name, or click the relationship chip beside the name.

| Setting | What it does |
|---|---|
| **Name** | Shown on the name tag in the yard and in the chat. Up to 24 characters |
| **Personality** | Your friend answers in this personality when you chat. Up to 400 characters. Starts as the pet file's introduction; edit or add to it, then save. **Add the pet file's introduction** brings the original back. Not used until an AI is connected |
| **Relationship** | Friend, Partner, Dependable mentor or Playful younger sibling. Changes how your friend talks to you and asks about your day ([Chat with a friend](./chat.md#setting-a-relationship)) |
| **What it calls you** | Your friend calls you this. Up to 24 characters |
| **Size** | Five steps: Tiny, Small, Medium, Large, Huge. The yard changes as you slide |

- The friend ID is at the bottom of the window. Use it to point at a specific friend in [Coding agent hooks](./agents.md).
- **Send away**, in the **⋯** menu or in Friend settings, takes a friend out of the yard after a red confirmation. The pet stays in Invite a friend, so you can invite it again any time, but your conversation and the closeness you built are cleared.

## Things to do in the yard <Since v="0.1.0" />

| Action | How |
|---|---|
| Pat | Click a friend once. It jumps and shows a heart |
| Move | Drag a friend and drop it. Its place in the yard is remembered |
| Chat | Click the friend's name tag. Under the pointer it shows a speech mark, and its tooltip says **Talk to** and the friend's name. The Friend panel opens on that friend, and the conversation fits inside the window at every size. The first friend you invite explains how to chat |
| Friend menu | Right-click a friend: **Talk to**, **Play with** and **Ask … to dig** for that friend |
| Put down a treat | **Play → Garden → Picnic**, then choose a spot. From the keyboard, press it again to set it beside the selected friend. A picnic blanket with sandwiches, fruit and snacks appears, and friends gather around it. It clears after 15 seconds if not everyone arrives, or six seconds after the last friend eats |

- Each friend has a name tag underneath. It switches to the selected look when you select that friend, and while a coding agent works, a state dot shows in the tag, beside the name.
- Left alone, friends slowly wander the yard and talk to themselves. When it rains they say things like "Got an umbrella?", and at night they get sleepy. Time of day and weather are in [The yard and games](./play.md#weather).

## What next

- Talk with your friend: [Chat with a friend](./chat.md).
- Put your friend out on the desktop: [Desktop mode](./desktop.md).
