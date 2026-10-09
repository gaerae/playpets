---
description: Time of day and weather, the rules of hide and seek, parade and tag, and mini mode that leaves only the yard
---

# The yard and games

The yard changes its look with the time of day, and you can play three games with your friends.

## Time of day and weather <Since v="0.1.0" />

<Shot name="yard-evening" caption="The yard on a golden evening. The time of day follows the clock automatically." />

The label at the top left of the yard describes the current scene, such as "A golden evening in the yard". Click it to open a small menu with the time of day and the weather.

| Choice | Options |
|---|---|
| Time of day | Auto time, Morning, Midday, Evening, Night |
| Weather | Auto weather, Clear, Rain, Snow |

- **Auto time** follows your computer's clock. The colours of the sky and ground change through morning, midday, evening and night, the sun crosses the sky from left to right, and at night the moon shows tonight's phase.
- **Auto weather** picks new weather once every 20 minutes. It is mostly clear, with rain now and then; snow comes only in winter. It does not fetch the real weather from the internet.
- The yard is painted like the background of an animated film, and painted again when the light changes: the sun lights the trees and hills from its side (left in the morning, right in the evening), far mountains fade into the haze, and a small lake in the valley mirrors the sky.
- The yard follows the **season** by the date: cherry blossoms and falling petals in spring, deep green in summer, red and gold leaves drifting down in autumn, muted winter green and dry fields in winter. South of the equator (by your computer's time zone) the seasons are the other way round.
- When rain clears up in daylight, a rainbow stands over the hills for a few minutes. On clear days a flock of birds crosses the sky now and then, butterflies flutter until autumn, and fireflies glow on spring and summer nights.
- Pick a value yourself and that time of day and weather are fixed. Your choice is remembered, so it is the same the next time you open the app.

When the weather changes, one or two friends say a word about it, like "Rain!" or "Snowman time?". Left alone, they also talk to themselves to fit the time of day.

## Let them chat <Since v="0.1.0" />

Press **Let them chat** in the toolbar and the friends with an AI (up to three) have a short talk among themselves about the time of day and the weather. The lines show up one after another as speech bubbles in the yard. With fewer than two friends with an AI the button is off, and hovering it says why. To join in yourself, use [the Friend tab's group chat](./chat.md).

To let them talk on their own now and then, turn on **Let them chat now and then** in the Settings tab. They chat once every 20 minutes, and rest while the window is hidden or someone is answering.

## The garden <Since v="0.1.0" />

Friends out for a stroll find a seed now and then (every 8 to 20 minutes while the yard is open; the first one comes within a couple of minutes). The friend jumps, says so, and leaves a glowing seed at its feet: click it to pick it up. Left alone, the friend pockets it after a minute and a half, so nothing is missed by not watching.

1. Click **Plant a seed** in the toolbar (the number beside it is how many seeds you have).
2. Click a spot on the field. You can plant several in a row; **Esc** or the tool again stops.

A seed grows by the clock, also while the app is closed: a sprout after 10 minutes, leaves after 40, a bud after 2 hours, a flower after 4. What flowers depends on the season it was planted in: tulips in spring, sunflowers in summer, cosmos in autumn, camellias in winter. Hover over a plant to see what it is and how long until it flowers.

- Click a plant and the nearest friend walks over to water it.
- Friends also go and look at the flowers on their own.
- Right-click a plant (or press **Delete** on it) to pull it up. The seed does not come back.
- You can keep 20 seeds and 24 plants. The garden is saved as `garden` in `state.json`.

### Gifts

Once a day a friend brings a gift for the yard, after the yard has been open for a while that day (20 to 40 minutes; the very first gift comes after 5). It jumps, says so, and sets it down beside it. The first gifts come in this order: a bench, a lantern, a birdhouse, a little pond, a mailbox and a picnic blanket; after that a friend brings one that is not in the yard.

- Drag a decoration to move it anywhere on the field (or select it and use the arrow keys).
- Click it and the nearest friend walks over. Friends also visit decorations on their own: they sit on the bench, gather on the blanket and look into the pond.
- The lantern is lit from evening on, the pond mirrors the sky, and a bird sits on the birdhouse by day.
- Right-click a decoration (or press **Delete** on it) to put it away. A friend may bring it again another day.
- The yard holds 8 decorations; while it is full, no gift comes.

## Games <Since v="0.1.0" />

The tools float at the bottom of the yard. **Games** there opens a small menu with three games. You can play only one game at a time; while a game is on, the same button reads **End …** and ends it, and Treat is disabled for a moment. When a game ends, the friends walk back to where they were.

Click a button and it changes to something like **Stop Hide and seek**; click it again and the game ends right away.

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
4. After a set time, the game ends with "Tag is over. Everyone ran well!".

## Mini mode <Since v="0.1.0" />

<Shot name="mini" caption="Mini mode. A small window with only the yard floats on top of other windows." />

Click the **Mini** button at the top of the window and the panel and toolbar go away, leaving a small window with only the yard.

- The small window always floats on top of other windows. The first time, it opens in the bottom-right corner of the screen; after that it opens where you last left it, at the size you gave it.
- Point at the yard and **Treat** and **Let them chat** rise at the bottom as small buttons.
- Name tags are hidden; hover over a friend and theirs shows for a moment.
- Drag an empty spot with no friend and the window moves. Drag a friend and the friend moves.
- Patting works as before, and clicking a friend's name tag opens the chat (the window goes back to full size).
- Entering mini mode during a game ends the game.

To go back, click the **Full size** button in the corner of the small window; the window returns to where it was. Mini mode is remembered, so if you quit while it is small, it opens small the next time too.

## Want to see more of your friends?

To use the whole desktop as a yard, turn on [Desktop mode](./desktop.md). You can use it together with mini mode.
