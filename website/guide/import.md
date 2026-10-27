---
description: How to import a pet from a pet page address on a community site or from a folder on your computer
---

# Import a pet

- A pet is a character file.
- Show up in Invite a friend on their own:
  - the starter pets that come with the app
  - pets in Codex's pet folder (`~/.codex/pets`)
- Other pets have to be imported.

## One-click import from a link <Since v="0.1.0" />

1. On a pet gallery, click an **Open in PlayPets** link. It looks like `playpets://import?url=<pet page address>`.
2. With PlayPets installed, it asks "Import this pet?" and shows the site the link comes from.
3. Say yes. It imports that pet and opens Invite a friend.

- Run a gallery? Add this link to your pet pages:

```text
playpets://import?url=https%3A%2F%2Fpetdex.dev%2Fpets%2Fboba
```

## The Import a pet window <Since v="0.1.0" />

- Click **Import a pet** at the top of **Invite a friend**. Two ways:

| Way | How |
|---|---|
| From an address | Paste the address of a pet page on a community site, or of a GitHub pet folder, into **Pet page address** and click **Import** |
| From this computer | Click **Import from a folder on this computer** and pick a pet folder |

- Address imports fetch files over https only, and only from the pasted address's site (and its subdomains). A page pointing at files on another site is not followed.
- When the import finishes, the pet is invited into the yard as a friend right away. A notice says "Imported a new pet and invited it into the yard."

## Supported sites <Since v="0.1.0" />

1. Expand **Find more pets**. It starts collapsed so the address field and import actions stay easy to find; inside are compact site rows and their import guidance.
2. Click a site to open it in your browser.
3. Copy a pet page address into the field above.

- These are community links. Listing a site does not imply a partnership.

| Site | Site address |
|---|---|
| OpenPets Registry | openpets.sh |
| Petdex | petdex.dev |
| Codex PokéPets | github.com/dnnyngyen/codex-pokepets |
| Awesome Codex Pet | codexpet.top |
| Codex Pets | codex-pets.net |

- Places without a chip work too:
  - a pet folder on GitHub (a folder containing `pet.json`)
  - pet page addresses on sites built with codex-pet-share
- The sites above have dedicated import support.
- An entry marked **(browse only)** has no dedicated importer.
  - You can open it in your browser.
  - Compatible generic pet pages may still work when pasted.
- Listing a new site does not by itself add import support.
- Wrong address or no response: the window shows the reason.
- The window cannot be closed while an import is in progress.

## A folder on your computer <Since v="0.1.0" />

- A folder picked with **Import from a folder on this computer** is not copied into app storage. The app reads it where it is.
- That is why it shows in Invite a friend under **Pets picked from this computer**, with the folder name.
- ZIP from the creator kit:
  1. Extract it into a permanent location.
  2. Then choose that folder.
  3. Keep it at the same path. Do not move or delete it while you use the pet.

::: warning Move the folder and the friend waits
- A friend recognises its pet by the pet folder's path.
- Move or delete the picked folder (or unplug its drive), and that friend cannot come into the yard the next time you open the app.
- It is not removed. It waits with its closeness kept; a notice says how many friends are waiting.
- Put the folder back in the same place and the friend comes back.
:::

## Where pets are saved <Since v="0.1.0" />

- A pet imported from an address is one folder in `pets/` in the [data folder](./install.md#data-folder).
- **Open folder** opens it right away. These groups in Invite a friend have the button:
  - **Pets imported from an address**
  - **PlayPets starter pets**
  - **Codex pet folder**
- **Pets picked from this computer** has no button; each card shows its folder name instead.
- An imported pet's `pet.json` records where it came from.
- Its card shows site, creator and license on one line, like "Petdex, creator, CC BY-NC 4.0".
- Community pets are their creators' work. Check the license before you use them.
- Remove a pet you no longer use: delete its folder inside `pets/`.
  - Friends made from it wait outside the yard from the next start, as above.
  - Want them gone too? Send them away first.

## Make your own

- A pet is one folder with a `pet.json` and one sprite sheet (PNG or WebP).
- Same format as Codex pets: a pet made for Codex works as it is.

```json
{
  "id": "white",
  "displayName": "White",
  "kind": "animal",
  "description": "A puppy.",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

| Sheet | Size |
|---|---|
| Width | 1536px |
| Cell | 192×208px, 8 cells per row |
| v1 | 9 rows (1872px) |
| v2 | 11 rows (2288px) |

- v1 rows, in order: rest, walk right, walk left, wave, jump, error, wait, work, done.
- v2 adds two rows of 16-direction gaze, so the pet follows the mouse with its eyes on the desktop.
- `description` becomes a new friend's first personality.
- Each row's animation and the validation rules: [Pet file format](/dev/standards/pet-files) in the developer docs.
- Invite the folder you made right away with **Import from a folder on this computer**.
