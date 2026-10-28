---
description: Pick a pet in Invite a friend to make it your friend, then pat it and give it treats in the yard
---

# Invite your first friend

1. Open the app. The empty yard asks **Who would you like to play with?** and shows four moving companions to choose from.
2. Click one. It comes into the yard and waves.

**See other pets** opens **Invite a friend**, which shows every pet on this computer.

## Bundled companions <Since v="0.1.0" />

On first start, Invite a friend shows **PlayPets starter pets**: Daisy the explorer, Clover the kitten gardener, Pip the cheerful puppy and Miso the gentle otter. Clover is the app's main mascot. Their cards show these names in every language.

They use the Codex pet format, so you can invite them, send them to the desktop and give them an AI like any other pet. Their files sit under `builtin/` in the data folder.

The official cast is Daisy, Clover, Pip and Miso. Built-in friends from earlier versions keep their saved IDs, names, settings and closeness, and only their appearance moves to this cast:

| Earlier friend | Now looks like |
|---|---|
| Aria | Daisy |
| Noah | Pip |
| The original cats | Clover |

Pets you imported are unchanged. Chat lasts only for the session and isn't restored after a restart.

Daisy, Clover, Pip and Miso also change clothes with the selected season, both in the yard and in desktop mode. On Auto, the season follows the local calendar. They wear light clothes in summer and warm clothes in winter, and share layered everyday outfits in spring and autumn. Their faces, accessories and actions stay recognizable whatever they wear.

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

- Connect an AI to a friend (**Connect**).
- Pick a friend to bring news from your coding agent (**Choose**).

If Claude Code or Codex CLI is on this computer, the first button is **Connect now**. It attaches that tool to every friend in one step, with no key (see [Chat with a friend](./chat.md#making-a-connection)).

Each step gets a tick when it's done. The card disappears once they all are, or sooner if you click **Hide this**.

While the yard has no friends, play tools are hidden. **Friends & settings → Invite a friend** stays available.

## Invite a friend <Since v="0.1.0" />

<Shot name="invite" caption="Invite a friend groups cards by where the pets are." />

Cards come in four groups, by where the pet file lives. An empty group isn't shown.

| Group | Where the pets come from |
|---|---|
| PlayPets starter pets | Four pets bundled with the app, unpacked in `builtin/` in the data folder |
| Codex pet folder | Codex pets in `~/.codex/pets`. They show up automatically |
| Pets imported from an address or ZIP | Pets you got with **Import a pet**, from a community page or a ZIP file. Copied into `pets/` in the data folder |
| Pets picked from this computer | Pets in a folder you picked yourself. Not copied; the app reads that folder as it is |

- The first three groups have an **Open folder** button that opens the folder in Explorer or Finder.
- Pets picked from this computer show their folder name on each card.
- No cards at all? Start with [Import a pet](./import.md).

The **Type** chips above the shelf (All, People, Animals, Other) follow the pet file's `kind`. Use them to narrow the shelf to human-shaped pets, which is handy when you're picking a partner or a mentor.

**Search pets** works together with the type filter: enter a name or creator to narrow the same shelf. **Show all** clears both the search and the type filter.

## Inviting a friend <Since v="0.1.0" />

1. Click a card (the `+` on its right). A card for a friend already in the yard says **Invite one more**.
2. The friend appears in the yard and waves, and the Friend panel opens on that friend.
3. Click the same pet again and it becomes **Invite one more**. From the second friend on, a number follows the name so you can tell them apart.

The yard holds up to 12 friends.

## Friend settings <Since v="0.1.0" />

To open them, go to the Friend panel and choose **Edit** (the pencil) in the **⋯** menu by the friend's name. The relationship chip beside the name opens them too.

| Setting | What it does |
|---|---|
| **Name** | Shown on the name tag in the yard and in the chat. Up to 24 characters |
| **Personality** | Your friend answers in this personality when you chat. Up to 400 characters. Not used until an AI is connected |
| **Relationship** | Friend, Partner, Dependable mentor or Playful younger sibling. Changes how your friend talks to you and asks about your day |
| **What it calls you** | Your friend calls you this. Up to 24 characters |
| **Size** | Five steps: Tiny, Small, Medium, Large, Huge. The yard changes as you slide |

- **Personality** starts as the pet file's introduction. Edit it or add to it, then save. **Add the pet file's introduction** brings the original back.
- For relationship and what it calls you, see [Chat with a friend](./chat.md#setting-a-relationship).
- The friend ID is at the bottom of the window. Use it to point at a specific friend in [Coding agent hooks](./agents.md).

To send a friend away, choose **Send away** in the **⋯** menu or click **Send away** in Friend settings. A red confirmation asks first. The pet stays in Invite a friend, so you can invite it again any time, but your conversation and the closeness you built are cleared.

## Things to do in the yard <Since v="0.1.0" />

Click a friend to pat it, or drag it to move it. The first friend you invite explains how to chat.

| Action | How |
|---|---|
| Pat | Click a friend once. They jump and show a heart |
| Move | Drag a friend and drop them. Their place in the yard is remembered |
| Chat | Click the friend's name tag. Under the pointer it shows a speech mark; its tooltip says **Talk to** and the friend's name. The Friend panel opens on that friend, and the conversation fits inside the window at every size. A double-click on the friend does the same. A right-click opens a short menu with **Talk to**, **Play with** and **Ask … to dig** for that friend |
| Put down a treat | Click **Picnic** in **Play → Garden**, then choose a spot in the yard. From the keyboard, press it again to set it beside the selected friend. A picnic blanket with sandwiches, fruit and snacks appears, and friends gather around it. It clears after 15 seconds if not everyone arrives, or six seconds after the last friend eats |

Each friend has a name tag underneath. It switches to the selected look when you select that friend, and while a coding agent works, the status shows next to it.

Left alone, friends slowly wander the yard and talk to themselves. When it rains they say things like "Got an umbrella?", and at night they get sleepy. Time of day and weather are in [The yard and games](./play.md).

## What next

- Talk with your friend: [Chat with a friend](./chat.md).
- Put your friend out on the desktop: [Desktop mode](./desktop.md).
