---
description: How to pick a pet in Invite a friend and make it your friend, then pat it and give it treats in the yard
---

# Invite your first friend

1. Open the app. The empty yard asks **Who would you like to play with?** and shows four moving companion choices.
2. Click one. It comes into the yard and waves.

- **See other pets** opens **Invite a friend** with every pet on this computer.

## Bundled companions <Since v="0.1.0" />

- On first start, Invite a friend shows **PlayPets starter pets**:
  - Daisy the explorer
  - Clover the kitten gardener, the app's main mascot
  - Pip the cheerful puppy
  - Miso the gentle otter
- Their cards show these names in every language.
- They use the Codex pet format: invite them, send them to the desktop and give them an AI like any other pet.
- Their files sit under `builtin/` in the data folder.

**Earlier built-in friends**
- The official cast is Daisy, Clover, Pip and Miso.
- Earlier built-in friends keep their saved IDs, names, settings and closeness. Their appearance maps to this cast:

| Earlier friend | Now looks like |
|---|---|
| Aria | Daisy |
| Noah | Pip |
| The original cats | Clover |

- Imported pets are unchanged.
- Chat is session-only and is not restored after restarting.

**Seasonal clothes**
- Daisy, Clover, Pip and Miso change clothes automatically with the selected season, in the yard and in desktop mode. Auto uses the local calendar.
  - Summer: light clothes
  - Winter: warm clothes
  - Spring and autumn: shared layered everyday outfits
- Faces, accessories and actions stay recognizable.

## Companion stories <span id="companion-stories"></span>

- Short stories that introduce the cast.
- Change each friend’s personality in Friend settings. Conversations use it only when an AI is connected.
- Their little sign of belonging: a shared white flower with a golden centre.

### Daisy, A little further down the path

- Follows the paths other people hurry past.
- A new flower or a whale-shaped cloud makes a day worth remembering.
- Likes sharing discoveries, without turning every outing into a race.

### Clover, Something grew today

- The garden’s quiet caretaker and PlayPets’ main mascot.
- Notices a new leaf before anyone else; saves a sunny patch for a friend.
- Favourite kind of progress: something small, given time to grow.

### Pip, There is room for one more

- Usually the first to wave at someone new.
- Wears indigo denim and ivory shorts.
- Brings energy to a walk or a game, then makes sure nobody is left behind.
- A good afternoon, to Pip, is one everyone can join.

### Miso, A page beside the pond

- A gentle otter in a lavender knit vest who keeps a book nearby.
- Leaves plenty of room for pauses; likes watching ripples while a thought settles.
- Company does not always need a conversation. Sometimes sitting together is enough.


## Next up <Since v="0.1.0" />

- After your first friend arrives, a small **Next up** card in the corner shows what is left:
  - Connect an AI to a friend (**Connect**).
  - Pick a friend to bring news from your coding agent (**Choose**).
- With Claude Code or Codex CLI on this computer, the first button is **Connect now**. It attaches it to every friend with no key (see [Chat with a friend](./chat.md#making-a-connection)).
- Each step is ticked when done. The card disappears when all are done, or earlier with **Hide this**.
- With no friend in the yard, play tools are hidden. **Friends & settings → Invite a friend** stays available.

## Invite a friend <Since v="0.1.0" />

<Shot name="invite" caption="Invite a friend groups cards by where the pets are." />

- Cards are in four groups, by where the pet file lives. An empty group is not shown.

| Group | Where the pets come from |
|---|---|
| PlayPets starter pets | Four pets bundled with the app, unpacked in `builtin/` in the data folder |
| Codex pet folder | Codex pets in `~/.codex/pets`. They show up automatically |
| Pets imported from an address | Community pets you got with **Import a pet**. Saved in `pets/` in the data folder |
| Pets picked from this computer | Pets in a folder you picked yourself. Not copied; the app reads that folder as it is |

- The first three groups have an **Open folder** button. It opens the folder in Explorer or Finder.
- Pets picked from this computer show their folder name on each card.
- No cards at all: start with [Import a pet](./import.md).
- **Type** chips above the shelf (All, People, Animals, Other) narrow it to human-shaped pets. Handy when picking a partner or a mentor.
  - They follow the pet file's `kind`.
- **Search pets** works together with the type filters: enter a name or creator to narrow the same shelf.
- **Show all** clears both the search and the type filter.

## Inviting a friend <Since v="0.1.0" />

1. Click a card (the `+` on its right). A card for a friend already in the yard says "Invite one more".
2. The friend appears in the yard and waves. The Friend panel opens on that friend.
3. Click the same pet again and it becomes "Invite one more". From the second friend on, a number follows the name so you can tell them apart.

- The yard holds up to 12 friends.

## Friend settings <Since v="0.1.0" />

- Open: in the Friend panel, **⋯** menu by the friend's name → **Edit** (the pencil). The relationship chip beside the name opens it too.

| Setting | What it does |
|---|---|
| **Name** | Shown on the name tag in the yard and in the chat. Up to 24 characters |
| **Personality** | Your friend answers in this personality when you chat. Up to 400 characters. Not used until an AI is connected |
| **Relationship** | Friend, Partner, Dependable mentor or Playful younger sibling. Changes how your friend talks to you and asks about your day |
| **What it calls you** | Your friend calls you this. Up to 24 characters |
| **Size** | Five steps: Tiny, Small, Medium, Large, Huge. The yard changes as you slide |

- **Personality** starts as the pet file's introduction. Edit or add to it and save to change it.
- **Add the pet file's introduction** brings the original introduction back.
- Relationship and what it calls you: see [Chat with a friend](./chat.md#setting-a-relationship).
- The friend ID is at the bottom of the window. Use it to point at a specific friend in [Coding agent hooks](./agents.md).

**Send a friend away**
- Choose **Send away** in the **⋯** menu, or click **Send away** in Friend settings.
- A red confirmation asks first.
- The pet stays in Invite a friend; invite them again any time.
- Your conversation and the closeness you built are cleared.

## Things to do in the yard <Since v="0.1.0" />

- Click a friend to pat it; drag it to move it.
- The first friend you invite explains how to chat.

| Action | How |
|---|---|
| Pat | Click a friend once. They jump and show a heart |
| Move | Drag a friend and drop them. Their place in the yard is remembered |
| Chat | Click the friend's name tag. Under the pointer it shows a speech mark; its tooltip says **Talk to** and the friend's name. The Friend panel opens on that friend. The conversation fits inside the window at every size. A double-click on the friend does the same. A right-click opens a short menu with **Talk to**, **Play with** and **Ask … to dig** for that friend |
| Put down a treat | Click **Picnic** in **Play → Garden**, then choose a spot in the yard. From the keyboard, press it again to set it beside the selected friend. A picnic blanket with sandwiches, fruit and snacks appears; friends gather around it. It clears after 15 seconds if not everyone arrives, or six seconds after the last friend eats |

- A **name tag** sits under each friend.
  - Selecting a friend switches its name tag to the selected look.
  - While a coding agent works, the status shows next to the name tag.
- Left alone, friends slowly wander the yard and talk to themselves.
  - Rain: things like "Got an umbrella?"
  - Night: they get sleepy.
- Time of day and weather: [The yard and games](./play.md).

## What next

- Talk with your friend: [Chat with a friend](./chat.md).
- Put your friend out on the desktop: [Desktop mode](./desktop.md).
