---
description: Time of day, weather and seasons, the garden and gifts, fishing and bugs, the album, closeness, seasonal events, yard sounds, three games, and a freely resizable yard window
---

<script setup>
import DiscoveryGuide from '../.vitepress/theme/DiscoveryGuide.vue';
</script>

# The yard and games

- The yard changes with the time of day, the weather and the season, and grows over the days.
- Friends dig up flower seeds and saplings and bring gifts.
- You fish and catch bugs for the album.
- Friends grow closer to you; seasonal events come and go.
- The yard has its own sounds, and you can play three games with your friends.

**The dock**
- The scenery fills the window.
- The dock has **Place & atmosphere**, **Play** and **Friends & settings**.
- Each opens one page with its sections, with no tabs or Back buttons inside.
- Only one yard panel opens at a time.
- Automatic time follows your computer’s clock without displaying a clock.

**Play**
- Titled for the selected friend, such as **Play with Clover**. Three sections:

| Section | Holds |
|---|---|
| **Find** | **Dig**, **Fish**, **Album** |
| **Garden** | **Plant a seed** (with how many seeds you have), **Plant a tree**, **Picnic** |
| **Group games** | The three games, **Let them chat** |

- Let them chat needs two friends connected to an AI. The other activities do not.

**Starting yard**
- A new yard starts on a clear spring day.
- Choose **Auto** for season, time or weather to let them change on their own.
- Saved choices stay as you left them.

**Sounds**
- **Place & atmosphere → Atmosphere** holds the **Yard sounds** switch and **Volume**.
- Sounds begin after your first interaction and play only while the yard is visible.
- Rain, birds, water and other ambient sounds follow the place, weather, season and time.
- Separate from automatic conversation in **Friends & settings → Settings → Friends & AI**.

## Time of day and weather <Since v="0.1.0" />

- Season and weather are independent:
  - Summer with Snow keeps the summer landscape and outfits while snow falls.
  - Winter with Clear keeps the winter landscape.
  - The indoor window and imported backgrounds follow the same rule.
- Auto weather still limits naturally selected snow to winter.

<Shot name="yard-spring" caption="A clear spring day in the yard. Auto time follows your clock when selected." />

1. Open **Place & atmosphere** at the bottom right.
2. Choose a background by its thumbnail under **Places**. Built-in and imported backgrounds share one gallery.
3. Choose season, time and weather under **Atmosphere**.

- Changes apply immediately. The panel is one page.
- **Import background** and **Background studio** sit beside the Places heading.
- Remove appears there only when an imported background is selected.

| Choice | Options |
|---|---|
| Place | Hill garden, Stone courtyard, Lakeside cottage, Cozy living room |
| Time of day | Auto time, Morning, Midday, Evening, Night |
| Weather | Auto weather, Clear, Rain, Snow |

**Places**
- The three outdoor places have distinct houses, four seasonal landscapes and their own fishing positions.
- **Cozy living room** keeps the same calm style indoors:
  - Morning, midday, evening and night change its lighting.
  - Spring blossoms, autumn leaves and winter snow change the view through the windows.
  - Rain and snow stay beyond the glass.
- Every place: pet friends, chat, grow flowers, play the three games.
- The three gardens only: fishing, wild bugs, outdoor seasonal effects.
- Your place is remembered separately from the time and weather choices.

<Shot name="studio-night" caption="Cozy living room at night: a quiet village view beyond the glass and warm light indoors." />

- **Auto time** follows your computer's clock.
  - Sky and ground colours change through morning, midday, evening and night.
  - The sun crosses the sky from left to right.
  - At night the moon shows tonight's phase.
- **Auto weather** picks new weather once every 20 minutes.
  - Mostly clear, with rain now and then; snow only in winter.
  - It does not fetch the real weather from the internet.
- The illustrated outdoor places have different compositions, from a sheltered courtyard to an open hillside and lake.
  - Their colours change with the light.
  - The background is repainted only when the scene or window size changes.
- Season on **Auto**: the outdoor places follow the date.

| Season | Outdoor places show |
|---|---|
| Spring | Blossoms and falling petals |
| Summer | Deep green |
| Autumn | Red and gold leaves |
| Winter | Snowy ground |

- You can also choose a season in **Place & atmosphere → Atmosphere**.
- South of the equator (by your computer's time zone), automatic seasons are reversed.
- Sky and wildlife:
  - Rain clears in daylight: a rainbow stands over the hills for a few minutes.
  - Clear days: a flock of birds crosses the sky now and then.
  - Butterflies flutter until autumn.
  - Fireflies glow on spring and summer nights.
- Pick a value yourself and that time of day and weather are fixed. The choice is remembered for the next time you open the app.
- When the weather changes, one or two friends say a word about it, like "Rain!" or "Snowman time?".
- Left alone, friends also talk to themselves to fit the time of day.

## Let them chat <Since v="0.1.0" />

- Press **Let them chat** in **Play → Group games**: the friends with an AI (up to three) have a short talk about the time of day and the weather.
- The lines show one after another as speech bubbles in the yard.
- Fewer than two friends with an AI: the button looks off; pressing or hovering it says why.
- To join in yourself, use [group chat in the Friend panel](./chat.md).
- Talk on their own now and then: turn on **Let them chat now and then** in **Friends & settings → Settings → Friends & AI**.
  - Once every 20 minutes.
  - They rest while the window is hidden or someone is answering.

## The garden <Since v="0.1.0" />

- Flower seeds and saplings both come from digging: choose **Dig**, send a friend to open ground, and plant what they find.
- Neither appears just because friends are strolling.

1. Click **Plant a seed** in **Play → Garden**. The number beside it is how many seeds you have.
2. Click a spot on the field. You can plant several in a row. **Esc** or the tool again stops.

- Keyboard: press **Plant a seed** (Enter or Space), then press it again to plant beside the selected friend, as with the picnic.
- With a tool in hand, keys 1, 2 and 3 switch to **Dig**, **Plant a tree** and **Plant a seed**. They do nothing while you type in a field.
- In Cozy living room, flowers sit in small planters instead of bare soil. Growth and your collection stay shared when you change places.

**Growth** (by the clock, also while the app is closed)

| After | Stage |
|---|---|
| 10 minutes | Sprout |
| 40 minutes | Leaves |
| 2 hours | Bud |
| 4 hours | Flower |

- What flowers depends on the season it was planted in, four kinds per season:

| Planted in | Flowers |
|---|---|
| Spring | Tulips, daffodils, crocuses, grape hyacinths |
| Summer | Sunflowers, hydrangeas, lavender, bellflowers |
| Autumn | Cosmos, chrysanthemums, dahlias, asters |
| Winter | Camellias, snowdrops, hellebores, cyclamen |

- Hover over a plant to see what it is and how long until it flowers.
- Click a plant: the nearest friend walks over to water it.
- Friends also go and look at the flowers on their own.
- Pull a plant up: right-click it, or press **Delete** or **Backspace** on it.
  - It goes at once, without a question.
  - The notice at the bottom shows **Undo** for about six seconds; Undo puts the plant back.
  - Only after that is it gone for good. If the app closes first, the plant stays.
  - The seed does not come back.
- Limits: 20 seeds and 24 plants.
- Saved as `garden` in `state.json`.
- **Album**:
  - Flowers: each kind the first time it blooms.
  - Gifts: every gift that comes.

### Gifts

- The whole yard gets at most one gift per local calendar day, shared by all friends. Not one per friend.
- Waiting time: 20 to 40 minutes; five minutes for the first gift.
- Once scheduled, the delivery time is saved, and time with the app closed counts too.
- No uninterrupted session needed. A gift due while the app is closed can be delivered after you return.
- The friend jumps, says so, and sets the gift down beside it.
- The first gifts come in this order:
  1. a bench
  2. a lantern
  3. a birdhouse
  4. a little pond
  5. a mailbox
  6. a picnic blanket
  7. a pinwheel
  8. a campfire
  9. a swing
  10. a flowerpot
  11. a stump stool
  12. a tent
  13. a signpost
  14. a wind chime
- After that, a friend brings one that is not in the yard.
- The campfire glows from evening on like the lantern. Friends sit on the swing and the stump. The wind chime rings when a friend visits it.

- Move a decoration: drag it anywhere on the field, or select it and use the arrow keys.
- Click it: the nearest friend walks over.
- Friends also visit decorations on their own: they sit on the bench, gather on the blanket and look into the pond.
- The lantern is lit from evening on, the pond mirrors the sky, and a bird sits on the birdhouse by day.
- Put one away: right-click it, or press **Delete** or **Backspace** on it.
  - It goes at once.
  - **Undo** in the notice brings it back for about six seconds. If the app closes first, it stays.
  - A friend may bring it again another day.
- The yard holds 12 decorations. A full yard pauses deliveries.
- Putting one away keeps its album entry and makes room for the remaining gifts.
- The album has 18 gifts, including four delivered only during their calendar events.

## Fishing and bugs <Since v="0.1.0" />

**Fishing**
- Manual: click visible water to fish with the nearest free friend.
  - When the float dips and **!** appears, click it.
  - Too early or too late loses the catch.
- **Play → Fish**: the selected friend finishes the trip on its own.
- Both use that background’s fishing spot.
- Your rod can also bring up freshwater prawns, crayfish and pond snails. The album records them with fish under **Aquatic life**.

**Bugs**
- Clear outdoor weather only. Rain and snow stop appearances.
- Morning and midday: click butterflies or dragonflies.
- Spring and summer evenings and nights: click fireflies.
- The nearest friend catches the bug.

**Fishing on its own**
- From bond level 3, an idle friend may fish on its own every 12–25 minutes while the yard is visible.
- Paused by games, another fishing trip or an active placement tool.
- A catch is not guaranteed.

**What you find**
- Depends on the season, the time of day and the weather:
  - Catfish and eels come out after dark, and more in the rain.
  - Pond smelt only in winter.
  - A golden carp is very rare.
- Each fish is a different size every time.
- A card shows what was caught, and says so when it is new.
- A card for something the album keeps (a fish, a bug, a flower in bloom, a gift or a keepsake) has **See in album**. It opens the album at that book.
- Something new arrived: **Album** in **Play → Find** and **Play** in the dock carry a small dot until you open the album.

**Album** (in **Play → Find**)
- Six books: Flowers, Aquatic life, Bugs, Gifts, Trees, Keepsakes.
- Shows every kind:
  - caught: how many, and the biggest fish
  - not yet: a silhouette with when and where to look
- Saved as `album` in `state.json`.
- Shows when and where to look, and rare-find waiting times. It does not display exact percentages.

## Seasonal events <Since v="0.1.0" />

- A few times a year the yard changes for a while.
  - The event's name shows beside the scene label.
  - A card says it has begun the first time you see it that year.
  - Friends talk about it.

| Event | When | What it brings |
|---|---|---|
| Cherry blossom festival | April 1 to 20 | Petals drift everywhere and more butterflies come out; a friend brings a cherry sapling |
| Firefly nights | July 20 to August 20 | Many more fireflies at night, and a golden one to catch; a friend brings a watermelon |
| Harvest moon | September 8 to October 15 | On the nights around the event's first full moon (two days either side), as at Chuseok and the Mid-Autumn Festival, the moon rises big and golden; the other nights it keeps its phase. The moonlight carp comes to the lake at night; a friend brings a pumpkin |
| Winter lights | December 10 to 31 | Little lights along the trees, glowing from evening on; a friend brings a snowman |
| New Year | January 1 to 7 | Friends greet the new year |

- The event's gift comes the first time a gift is due during the event, and only then.
- The album shows when each one comes.
- South of the equator, seasonal events come six months later, by your computer's time zone. The new year stays in January.

## Closeness <Since v="0.1.0" />

- Each friend grows closer to you through time in the yard and what you do together.
- Hearts on its name tag show how close it is.
- The Friend panel shows its level, how far to the next and what the next one brings.
- Levels say how close you are, not what you are to each other. They read the same for a partner or a sibling as for a friend. That is the [relationship](./chat.md#setting-a-relationship).

| Level | What it brings |
|---|---|
| Just met | |
| At ease | It welcomes you when the app opens and when you come back after a while |
| Warm | It goes fishing on its own now and then |
| Very close | |
| Dearest | A flower on its name tag, and now and then it says something just for you |

- What counts:
  - time together: every ten minutes the yard is seen
  - patting, treats, chatting, watering, catching and gifts, up to a day's worth
- So a few minutes of clicking cannot rush it: closeness comes over days.
- Nothing is ever lost by being away.
- Saved as `bonds` in `state.json`.

## A little digging and tree planting

**Digging**
1. Open **Play** from the dock, or right-click a friend and choose **Play with** and its name.
   - **Ask Clover to dig** in the same menu (with that friend’s name) picks up the dig tool, and that friend goes first.
2. **Dig** asks you to choose an open patch of ground. **Esc** cancels the choice.
3. The friend walks there and digs. No AI connection needed.

- Not valid digging spots: water, furniture, roots.
- Taking the friend away before arrival gives no discovery.
- Shortcut: right-click bare ground and choose **Dig here** to dig that spot without opening **Play**.

**The tool in hand**
- The dig tool stays in hand until you put it away.
- Each spot you choose sends the next free friend. A friend that just dug rests a moment while another goes.
- The strip that takes the dock's place at the bottom switches to **Plant a tree** or **Plant a seed** in one press.
- Its close button or **Esc** puts the tool away.
- A tool in hand never hides the lake or the creatures. Press the water or a flying or crawling creature: the tool is put away as that same press fishes or catches.

**Motions and outfits**
- Daisy, Clover, Pip and Miso have dedicated motions in every season for digging, planting, casting, waiting for a bite, reeling in and reacting to a find.
- Daisy, Pip and Miso share their everyday outfits in spring and autumn, and change into summer and winter outfits.
- Clover keeps the teal overalls and straw hat through autumn, then changes into a coat, scarf and knitted beanie for winter.
- Imported pets join the same activities with their original animations.

**What a dig finds**
- A flower seed, a sapling, one of seventeen keepsakes, or nothing.
- Keepsakes appear in **Album → Keepsakes**.
- After an uncommon find, all friends and places wait 24 hours for another uncommon find.
- Repeats mean completion can take longer.
- The same patch gives no further reward for 24 hours.
- Each friend waits eight seconds between digs.
- Limits: 20 seeds; 20 saplings per species. Full storage does not convert a reward.

**Planting a tree**
1. Find a sapling by digging first.
2. Choose **Plant a tree** to see the stock: cherry, maple, pine, oak, birch, willow.
3. Pick a species you have and choose clear ground. Planting uses one matching sapling.

- Growth (including time with the app closed): young after two hours, mature after twelve.
- A mature tree is recorded in **Album → Trees** once.
- Each place holds six trees, up to twenty-four overall.
- Trees stay in the place where they were planted.
- Drag to move one.
- Remove one at once: right-click it, or press **Delete** on it.
  - As with flowers, **Undo** in the notice brings it back for about six seconds.
  - Removal keeps its album entry but returns no sapling.
- Indoor places do not offer digging or tree planting.
- Imported backgrounds can explicitly allow or disable soil.

## Games <Since v="0.1.0" />

- The three games are in **Play → Group games**.
- One game at a time.
- While a game is on, its tile reads **Stop** and the game's name (such as **Stop Hide and seek**). Click it to end the game right away.
- Off for the whole game: the other games, **Picnic**, **Plant a seed**, **Plant a tree**.
- When a game ends, the friends walk back to where they were.

### Hide and seek

<Shot name="play-hide-and-seek" caption="Hide and seek. The line above the dock names the friend to find." />

1. Click **Hide and seek**. The friends scatter to their hiding places. A friend who does not reach a spot within 15 seconds hides where they are.
2. The line just above the dock says **Click to find** and the friend to find, then the other friends still hiding. Everything the yard tells you (a game, a find, a notice) appears in that same place.
3. Find the friend whose name is called and click them. Right: they jump out saying "You found me!" and the banner moves on to the next friend.
4. Wrong friend: only an "Oops, that's not them" notice. That friend keeps hiding, and the name to find does not change.
5. Everyone found: the game ends with "Everyone found!".

### Parade

1. Click **Parade**. The selected friend goes to the front; the others line up behind.
2. When the line is ready, they walk one lap around the yard.
3. After the lap, the friend in front says "Lap done!" and the game ends.

### Tag

- **Tag** needs at least two friends.

1. The selected friend is it. They say "I'm it!" and "It" is added to their name tag.
2. The friend who is it chases the nearest friend. The others run away.
3. When it overlaps another friend on screen, that friend is caught. The caught friend becomes it; the one who caught them is safe for a moment.
4. After a set time, the game ends with "Tag is over. Good running, everyone!".

## A window beside your work

- Resize: drag any edge or corner, down to 300 × 210.
- Move: drag the narrow transparent area along the top edge.
- Position and size are remembered.
- At every size, the same window keeps friends, chat, Invite, Settings, scene controls and games.

**Small windows** (640 pixels wide or less, or 480 pixels tall or less)
- The dock hides.
- A round button appears in the bottom-right corner while the pointer is over the window (or when you reach it with Tab).
- It opens the same short menu as a right-click on empty scenery: **Place & atmosphere**, **Play**, **Friends & settings**, **Always on top**.
- **Cmd/Ctrl + Shift + P** opens Friends & settings.
- Each panel shows its actions as tiles whose names may take two lines. Section names are hidden.
- Longer panels scroll inside the window.

**Getting back**
- Closing Place & atmosphere or Play returns straight to the scenery.
- The Friend panel and Invite a friend have a Back action to Friends & settings. **×** returns to the yard.
- In Settings, Back goes from a section to the list of sections, then to Friends & settings.
- Invite a friend keeps Import visible in its header.

**Friend menu**
- Click a friend’s name tag to talk to it. Its tooltip says **Talk to** and the friend’s name.
- Right-click a friend for a short menu with **Talk to**, **Play with** and **Ask … to dig** for that friend (such as **Ask Clover to dig**).
  - Play opens the same Play panel for it.
  - Ask to dig picks up the dig tool, with that friend going first.
- Close, Escape or clicking outside returns to the scenery.
- There is no separate small-window play strip.

**Scenery menu**
- Right-click empty scenery for the short action menu beside the pointer. In small windows, the corner button opens it too.
- It stays inside the window and scrolls when needed.
- **Esc** or a click outside closes it.
- Friends, plants and decorations keep their own right-click actions.

**Fullscreen**
- **Friends & settings → Window & desktop → Enter fullscreen** fills the screen.
- While fullscreen, the same action reads **Return to previous size**. **Esc** also returns.
- Esc closes an open panel or menu first.
- Returning restores the previous window size, position and Always on top setting.

<Shot name="mini" caption="A small yard window beside your work." />

**Always on top**
- Turn it on in **Friends & settings → Window & desktop → Always on top**, or with the checked action in the short right-click menu.
- Works independently of window size and is remembered.
- Also in the tray and the macOS View menu.
- **Cmd/Ctrl + Shift + M** toggles it without resizing.
- On Linux, pinning depends on the desktop and window manager. Some Wayland desktops refuse the request; check your desktop’s window rules if the setting cannot be applied.

<Shot name="mini-chat" caption="A conversation stays inside the small yard window, beside your work." />

**Close and quit**
- **Friends & settings → Close window** hides the yard in the tray. Desktop friends and agent hooks keep running.
- **Quit PlayPets** beside it closes PlayPets at once, the same as Quit in the tray and <kbd>⌘</kbd> <kbd>Q</kbd> on macOS. Conversations are not saved.
- From the short right-click menu or the corner button, choose Friends & settings to reach these actions.

**Updates in small windows**
- An available update shows as a 32-pixel download icon with a dot.
- Its accessible label names the version. Activating it opens App updates directly.
- Larger windows keep the version pill.

**Dialogs and confirmations**
- Friend settings, Import and AI connection dialogs keep their headings and actions in place while the form body scrolls.
- The collection and confirmation dialogs keep their own content scrolling.
- A confirmation asks calmly, with **Cancel**, unless something that cannot come back would be lost.
  - These ask in red, and the other button reads **Keep it**: deleting an AI connection, sending a friend away, deleting a background.
- Every confirmation also has a **Close** button.
- Flowers, trees and gifts are not asked about. They offer **Undo** instead.

## Want to see more of your friends?

- To use the whole desktop as a yard, turn on [Desktop mode](./desktop.md).
- It works together with any yard window size.


## Discovery guide {#discovery-guide}

<DiscoveryGuide lang="en" />

## Collecting at your own pace

- The album has 100 entries across aquatic life, bugs, flowers, gifts, trees and little finds.
- Look for pond creatures, ladybugs and field crickets.
- Dig up a glass marble, wooden whale, felt mushroom, acorn teacup or sleeping fox figurine.
- Make room for a bunny watering can or hedgehog planter from a friend.

**How long it takes**
- The full 100-item album is not a one-day or one-week goal. There is no guaranteed completion date.
- The 16 ordinary gifts arrive on different local dates.
- The four event gifts need festivals spread across the calendar. Depending on when you start, collecting them all can take months.
- Changing the season does not start a festival.
- Flowers bloom four hours after planting; trees mature after twelve hours. Both count time with the app closed.

**Tips**
- **Fish:** rain makes catfish and eels easier to find. Choose a season and time when they appear, and use the guide to explore what you might catch.
- **Bugs:** look in clear outdoor weather.
  - Morning and daytime: butterflies and dragonflies.
  - Spring and summer evenings and nights: fireflies.
  - Festivals follow the calendar; changing the season alone does not start one.
- **Digging:** season, weather and outdoor place change which sapling or keepsake is more likely.
  - Matching conditions favor some finds; others stay reachable.
  - Choose season and weather independently in Atmosphere, including unusual combinations.
  - Custom outdoor places still reflect season and weather.
  - The same patch keeps its result for 24 hours.
  - An unlucky streak does not make the next find more likely.
- **Space:** clearing a received gift keeps its album record and makes room for later gifts. A full seed or sapling pocket does not reroll the chosen reward.

- The guide shows what you might discover under the chosen conditions.
- Water and obstacles leave fewer usable digging patches than the background's full grid.
