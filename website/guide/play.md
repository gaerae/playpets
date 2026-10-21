---
description: Time of day, weather and seasons, the garden and gifts, fishing and bugs, the album, closeness, seasonal events, yard sounds, three games, and a freely resizable yard window
---

<script setup>
import DiscoveryGuide from '../.vitepress/theme/DiscoveryGuide.vue';
</script>

# The yard and games

The yard changes with the time of day, the weather and the season, and it grows over the days. Friends dig up flower seeds and saplings and bring gifts, you fish and catch bugs for the album, friends grow closer to you, seasonal events come and go, the yard has its own sounds, and you can play three games with your friends.

The scenery fills the window. The dock has **Place & atmosphere**, **Play** and **Friends & settings**. Each opens one page with its sections, with no tabs or Back buttons inside. Only one yard panel opens at a time. Automatic time follows your computer’s clock without displaying a clock.

**Play** is titled for the selected friend, such as **Play with Clover**, and has three sections. **Find** holds **Dig**, **Fish** and **Album**. **Garden** holds **Plant a seed** (with how many seeds you have), **Plant a tree** and **Picnic**. **Group games** holds the three games and **Let them chat**. Let them chat needs two friends connected to an AI; the other activities do not.

A new yard starts on a clear spring day. Choose **Auto** for season, time or weather when you want them to change on their own; saved choices stay as you left them.

**Place & atmosphere → Atmosphere** also holds the **Yard sounds** switch and **Volume**. Sounds begin after your first interaction and play only while the yard is visible. Rain, birds, water and other ambient sounds follow the place, weather, season and time. This control is separate from automatic conversation in **Friends & settings → Settings → Friends & AI**.

## Time of day and weather <Since v="0.1.0" />

Season and weather are independent: summer with Snow keeps the summer landscape and outfits while snow falls; winter with Clear keeps the winter landscape. The indoor window and imported backgrounds follow the same rule. Auto weather still limits naturally selected snow to winter.

<Shot name="yard-spring" caption="A clear spring day in the yard. Auto time follows your clock when selected." />

Open **Place & atmosphere** at the bottom right to choose a background by its thumbnail. Built-in and imported backgrounds share one gallery. The panel is one page: choose a background under **Places** and season, time and weather under **Atmosphere**; changes apply immediately. **Import background** and **Background studio** sit beside the Places heading. Remove appears there only when an imported background is selected.

| Choice | Options |
|---|---|
| Place | Hill garden, Stone courtyard, Lakeside cottage, Cozy living room |
| Time of day | Auto time, Morning, Midday, Evening, Night |
| Weather | Auto weather, Clear, Rain, Snow |

The three outdoor places have distinct houses, four seasonal landscapes and their own fishing positions. **Cozy living room** keeps the same calm style indoors: morning, midday, evening and night change its lighting, while spring blossoms, autumn leaves and winter snow change the view through the windows. Rain and snow stay beyond the glass. You can pet friends, chat, grow flowers and play the three games in every place. Fishing, wild bugs and outdoor seasonal effects are available in the three gardens. Your place is remembered separately from the time and weather choices.

<Shot name="studio-night" caption="Cozy living room at night: a quiet village view beyond the glass and warm light indoors." />

- **Auto time** follows your computer's clock. The colours of the sky and ground change through morning, midday, evening and night, the sun crosses the sky from left to right, and at night the moon shows tonight's phase.
- **Auto weather** picks new weather once every 20 minutes. It is mostly clear, with rain now and then; snow comes only in winter. It does not fetch the real weather from the internet.
- The illustrated outdoor places have different compositions, from a sheltered courtyard to an open hillside and lake. Their colours change with the light; the background is repainted only when the scene or window size changes.
- With season set to **Auto**, the outdoor places follow the date: blossoms and falling petals in spring, deep green in summer, red and gold leaves in autumn, and snowy ground in winter. You can also choose a season in **Place & atmosphere → Atmosphere**. South of the equator (by your computer's time zone) automatic seasons are reversed.
- When rain clears up in daylight, a rainbow stands over the hills for a few minutes. On clear days a flock of birds crosses the sky now and then, butterflies flutter until autumn, and fireflies glow on spring and summer nights.
- Pick a value yourself and that time of day and weather are fixed. Your choice is remembered, so it is the same the next time you open the app.

When the weather changes, one or two friends say a word about it, like "Rain!" or "Snowman time?". Left alone, they also talk to themselves to fit the time of day.

## Let them chat <Since v="0.1.0" />

Press **Let them chat** in **Play → Group games** and the friends with an AI (up to three) have a short talk among themselves about the time of day and the weather. The lines show up one after another as speech bubbles in the yard. With fewer than two friends with an AI the button looks off, and pressing or hovering it says why. To join in yourself, use [the Friend tab's group chat](./chat.md).

To let them talk on their own now and then, turn on **Let them chat now and then** in **Friends & settings → Settings → Friends & AI**. They chat once every 20 minutes, and rest while the window is hidden or someone is answering.

## The garden <Since v="0.1.0" />

Flower seeds and saplings both come from digging. Choose **Dig**, send a friend to open ground, and plant what they find. Neither appears just because friends are strolling.

1. Click **Plant a seed** in **Play → Garden** (the number beside it is how many seeds you have).
2. Click a spot on the field. You can plant several in a row; **Esc** or the tool again stops.

From the keyboard, press **Plant a seed** (Enter or Space) and press it again to plant beside the selected friend, as with the picnic. While a tool is in hand, the keys 1, 2 and 3 switch to **Dig**, **Plant a tree** and **Plant a seed**; they do nothing while you type in a field.

In Cozy living room, flowers sit in small planters instead of patches of bare soil. Their growth and your collection remain shared when you change places.

A seed grows by the clock, also while the app is closed: a sprout after 10 minutes, leaves after 40, a bud after 2 hours, a flower after 4. What flowers depends on the season it was planted in, with four kinds per season: tulips, daffodils, crocuses and grape hyacinths in spring; sunflowers, hydrangeas, lavender and bellflowers in summer; cosmos, chrysanthemums, dahlias and asters in autumn; camellias, snowdrops, hellebores and cyclamen in winter. Hover over a plant to see what it is and how long until it flowers.

- Click a plant and the nearest friend walks over to water it.
- Friends also go and look at the flowers on their own.
- Right-click a plant (or press **Delete** on it) to pull it up. The seed does not come back.
- You can keep 20 seeds and 24 plants. The garden is saved as `garden` in `state.json`.
- The first time a kind of flower blooms it goes in the **Album** (Flowers), and every gift that comes is in it too (Gifts).

### Gifts

The whole yard receives at most one gift per local calendar day, shared by all friends, not one gift per friend. The waiting time is 20 to 40 minutes, or five minutes for the first gift. Once scheduled, the delivery time is saved and time with the app closed counts too. You do not need an uninterrupted session; if the gift is due while the app is closed, a friend can deliver it after you return. It jumps, says so, and sets it down beside it. The first gifts come in this order: a bench, a lantern, a birdhouse, a little pond, a mailbox, a picnic blanket, a pinwheel, a campfire, a swing, a flowerpot, a stump stool, a tent, a signpost and a wind chime; after that a friend brings one that is not in the yard. The campfire glows from evening on like the lantern, friends sit on the swing and the stump, and the wind chime rings when a friend visits it.

- Drag a decoration to move it anywhere on the field (or select it and use the arrow keys).
- Click it and the nearest friend walks over. Friends also visit decorations on their own: they sit on the bench, gather on the blanket and look into the pond.
- The lantern is lit from evening on, the pond mirrors the sky, and a bird sits on the birdhouse by day.
- Right-click a decoration (or press **Delete** on it) to put it away. A friend may bring it again another day.
- The yard holds 12 decorations; a full yard pauses deliveries. Putting one away keeps its album entry and makes room for the remaining gifts. The album has 18 gifts, including four delivered only during their calendar events.

## Fishing and bugs <Since v="0.1.0" />

- **Fishing**: click visible water for manual fishing with the nearest free friend. When the float dips and **!** appears, click it; too early or too late loses the catch. **Play → Fish** asks the selected friend to finish the trip independently. Both use that background’s fishing spot.

Your rod can also bring up freshwater prawns, crayfish and pond snails. The album records them together with fish under **Aquatic life**.

- **Bugs**: in clear outdoor weather, click butterflies or dragonflies in the morning and midday, or fireflies on spring and summer evenings and nights. Rain and snow stop appearances. The nearest friend catches the bug.
- From bond level 3, an idle friend may fish independently every 12–25 minutes while the yard is visible. Games, another fishing trip or an active placement tool pause this opportunity; a catch is not guaranteed.
- What bites and what flies depends on the season, the time of day and the weather: catfish and eels come out after dark (and more in the rain), pond smelt only in winter, and a golden carp is very rare. Each fish is a different size every time.
- A card shows what was caught, and says so when it is new. A card for something the album keeps (a fish, a bug, a flower in bloom, a gift or a keepsake) has **See in album**, which opens the album at that book. When something new arrives, **Album** in **Play → Find** and **Play** in the dock carry a small dot until you open the album.
- **Album** in **Play → Find** has six books, Flowers, Aquatic life, Bugs, Gifts, Trees and Keepsakes, and shows every kind: the ones caught with how many and the biggest fish, the others as silhouettes with when and where to look. It is saved as `album` in `state.json`.

The album shows when and where to look, along with rare-find waiting times. It does not display exact percentages.

## Seasonal events <Since v="0.1.0" />

A few times a year the yard changes for a while. The event's name shows beside the scene label, a card says it has begun the first time you see it that year, and friends talk about it.

| Event | When | What it brings |
|---|---|---|
| Cherry blossom festival | April 1 to 20 | Petals drift everywhere and more butterflies come out; a friend brings a cherry sapling |
| Firefly nights | July 20 to August 20 | Many more fireflies at night, and a golden one to catch; a friend brings a watermelon |
| Harvest moon | September 25 to October 15 | A big full moon every night, and the moonlight carp in the lake at night; a friend brings a pumpkin |
| Winter lights | December 10 to 31 | Little lights along the trees, glowing from evening on; a friend brings a snowman |
| New Year | January 1 to 7 | Friends greet the new year |

- The event's gift comes the first time a gift is due during the event, and only then. The album shows when each one comes.
- South of the equator the seasonal events come six months later, by your computer's time zone (the new year stays in January).

## Closeness <Since v="0.1.0" />

Each friend grows closer to you through time in the yard and what you do together. Hearts on its name tag show how close it is, and the Friend tab shows its level, how far it is to the next and what the next one brings. The levels say how close you are, not what you are to each other, so they read the same for a partner or a sibling as for a friend (that is the [relationship](./chat.md#setting-a-relationship)).

| Level | What it brings |
|---|---|
| Just met | |
| At ease | It welcomes you when the app opens and when you come back after a while |
| Warm | It goes fishing on its own now and then |
| Very close | |
| Dearest | A flower on its name tag, and now and then it says something just for you |

- Time together counts every ten minutes the yard is seen. Patting, treats, chatting, watering, catching and gifts count too, up to a day's worth, so a few minutes of clicking cannot rush it: closeness comes over days.
- Nothing is ever lost by being away. Closeness is saved as `bonds` in `state.json`.

## A little digging and tree planting

Open **Play** from the dock, or right-click a friend and choose **Play with** and its name. **Ask Clover to dig** in the same menu (with that friend’s name) picks up the dig tool, and that friend goes first. **Dig** asks you to choose an open patch of ground. The friend walks there and digs; no AI connection is needed. Water, furniture and roots are not valid digging spots. **Esc** cancels the choice. Taking the friend away before arrival gives no discovery.

The dig tool stays in hand until you put it away: each spot you choose sends the next free friend, and a friend that has just dug rests a moment while another goes. The strip that takes the dock's place at the bottom switches to **Plant a tree** or **Plant a seed** in one press; its close button or **Esc** puts the tool away. A tool in hand never hides the lake or the creatures: press the water or a flying or crawling creature and the tool is put away as that same press fishes or catches. Right-click bare ground and choose **Dig here** to dig that spot without opening **Play**.

Daisy, Clover, Pip and Miso have dedicated motions for digging, planting, casting, waiting for a bite, reeling in and reacting to a find in every season. Daisy, Pip and Miso share their everyday outfits in spring and autumn and change into summer and winter outfits. Clover keeps the teal overalls and straw hat through autumn, then changes into a coat, scarf and knitted beanie for winter. Imported pets join the same activities with their original animations.

A completed dig can uncover a flower seed, a sapling or one of seventeen keepsakes, or nothing. Keepsakes appear in **Album → Keepsakes**. After an uncommon find, all friends and places wait 24 hours for another uncommon find. Repeats mean completion can take longer. The same patch gives no further reward for 24 hours; each friend waits eight seconds between digs. Seeds are capped at 20 and saplings at 20 per species. Full storage does not convert a reward.

Find a sapling by digging first. Choose **Plant a tree** to see the stock for cherry, maple, pine, oak, birch and willow; pick a species you have and choose clear ground. Planting uses one matching sapling. Trees become young after two hours and mature after twelve, including time with the app closed. A mature tree is recorded in **Album → Trees** once. Each place holds six trees, up to twenty-four overall. Trees stay in the place where they were planted. Drag to move one, or right-click to remove it after confirmation. Removal keeps its album entry but returns no sapling. Indoor places do not offer digging or tree planting. Imported backgrounds can explicitly allow or disable soil.

## Games <Since v="0.1.0" />

The three games are in **Play → Group games**. You can play only one game at a time. While a game is on, that game's own tile reads **Stop** and the game's name (such as **Stop Hide and seek**); click it and the game ends right away. The other games, **Picnic**, **Plant a seed** and **Plant a tree** stay off for the whole game. When a game ends, the friends walk back to where they were.

### Hide and seek

<Shot name="play-hide-and-seek" caption="Hide and seek. The banner at the top names the friend to find." />

1. Click **Hide and seek** and the friends scatter to their hiding places. A friend who does not reach a spot within 15 seconds hides where they are.
2. The banner at the top of the yard says **Click to find** and the name of the friend to find. Below it are the names of the other friends who are still hiding.
3. Find the friend whose name is called and click them. If you are right, they jump out saying "You found me!" and the banner moves on to the next friend.
4. Click a different friend and you only get an "Oops, that's not them" notice, and that friend keeps hiding. The name to find does not change.
5. Once you have found everyone, the game ends with "Everyone found!".

### Parade

Click **Parade** and the selected friend goes to the front, with the others lining up behind them. When the line is ready, they walk one lap around the yard. After the lap, the friend in front says "Lap done!" and the game ends.

### Tag

**Tag** needs at least two friends.

1. The selected friend is it. They say "I'm it!" and "It" is added to their name tag.
2. The friend who is it chases the nearest friend, and the other friends run away from them.
3. When the friend who is it overlaps another friend on screen, that friend is caught. The caught friend becomes it, and the one who caught them is safe for a moment.
4. After a set time, the game ends with "Tag is over. Good running, everyone!".

## A window beside your work

Resize the yard by dragging any edge or corner, down to 300 × 210. The same window keeps friends, chat, Invite, Settings, scene controls and games available at every size. Drag the narrow transparent area along the top edge to move it. Its position and size are remembered.

At 640 pixels wide or less, or 480 pixels tall or less, the dock hides. A round button in the bottom-right corner opens the same short menu as a right-click on empty scenery: **Place & atmosphere**, **Play**, **Friends & settings** and **Always on top**. **Cmd/Ctrl + Shift + P** opens Friends & settings. In small windows each panel shows its actions as tiles whose names may take two lines, and the section names are hidden. Longer panels scroll inside the window. Closing Place & atmosphere or Play returns directly to the scenery. The Friend and Invite tabs have a Back action to Friends & settings; **×** returns to the yard. In Settings, Back goes from a section to the list of sections, then to Friends & settings. Invite keeps Import visible in its header.

Click a friend’s name tag to talk to it; its tooltip says **Talk to** and the friend’s name. Right-click a friend for a short menu with **Talk to**, **Play with** and **Ask … to dig** for that friend (such as **Ask Clover to dig**). Play opens the same Play panel for it; Ask to dig picks up the dig tool with that friend going first. Close, Escape or clicking outside returns to the scenery. There is no separate small-window play strip.

Right-click empty scenery for the short action menu beside the pointer (in small windows, the corner button opens it too). It stays inside the window and scrolls when necessary. **Esc** or a click outside closes it. Friends, plants and decorations retain their own right-click actions.

Choose **Friends & settings → Window & desktop → Enter fullscreen** to fill the screen. While fullscreen, the same action becomes **Return to previous size**; **Esc** also returns. Esc closes an open panel or menu first. Returning restores the previous window size, position and Always on top setting.

<Shot name="mini" caption="A small yard window beside your work." />

Choose **Friends & settings → Window & desktop → Always on top**, or use the checked action in the short right-click menu. The setting works independently of window size and is remembered. The tray and macOS View menu also offer it; **Cmd/Ctrl + Shift + M** toggles it without resizing.

On Linux, pinning depends on the desktop and window manager. Some Wayland desktops refuse the request; check your desktop’s window rules if the setting cannot be applied.

<Shot name="mini-chat" caption="A conversation stays inside the small yard window, beside your work." />

Choose **Friends & settings → Close window** to hide the yard in the tray while desktop friends and agent hooks keep running. **Quit PlayPets** beside it closes PlayPets at once, the same as Quit in the tray and <kbd>⌘</kbd> <kbd>Q</kbd> on macOS; conversations are not saved. From the short right-click menu or the corner button, choose Friends & settings to reach these actions.

In small windows, an available update appears as a 32-pixel download icon with a dot. Its accessible label identifies the version, and activating it opens App updates directly. Larger windows retain the version pill.

Friend settings, Import and AI connection dialogs keep their headings and actions in place while the form body scrolls. The collection and confirmation dialogs retain their own content scrolling.

## Want to see more of your friends?

To use the whole desktop as a yard, turn on [Desktop mode](./desktop.md). You can use it together with any yard window size.


## Discovery guide {#discovery-guide}

<DiscoveryGuide lang="en" />

## Collecting at your own pace

The album has 100 entries across aquatic life, bugs, flowers, gifts, trees and little finds. Look for pond creatures, ladybugs and field crickets. Dig up a glass marble, wooden whale, felt mushroom, acorn teacup or sleeping fox figurine, and make room for a bunny watering can or hedgehog planter from a friend.

The full 100-item album is not a one-day or one-week goal. The 16 ordinary gifts arrive on different local dates, while the four event gifts need festivals spread across the calendar. Depending on when you start, collecting all event gifts can take months. Changing the season does not start a festival. Flowers bloom four hours after planting and trees mature after twelve hours, including time with the app closed. There is no guaranteed completion date.

- **Fish:** rain makes catfish and eels easier to find. Choose a season and time when they appear, and use the guide to explore what you might catch.
- **Bugs:** look in clear outdoor weather. Butterflies and dragonflies appear in the morning and daytime; spring and summer evenings and nights bring fireflies. Festivals follow the calendar, so changing the season alone does not start one.
- **Digging:** season, weather and outdoor place change which sapling or keepsake is more likely. Matching conditions favor some finds, while others remain reachable. Choose season and weather independently in Atmosphere, including unusual combinations. Custom outdoor places still reflect season and weather. The same patch keeps its result for 24 hours, and an unlucky streak does not make the next find more likely.
- **Space:** clearing a received gift keeps its album record and makes room for later gifts. A full seed or sapling pocket does not reroll the chosen reward.

The guide shows what you might discover under the chosen conditions. Water and obstacles leave fewer usable digging patches than the background's full grid.
