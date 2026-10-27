---
description: Import a pet from a pet page address on a community site, or from a folder on your computer
---

# Import a pet

A pet is a character file. The starter pets that come with the app and the pets in Codex's pet folder (`~/.codex/pets`) show up in **Invite a friend** on their own. Any other pet has to be imported.

## One-click import from a link <Since v="0.1.0" />

1. On a pet gallery, click an **Open in PlayPets** link. It looks like `playpets://import?url=<pet page address>`.
2. If PlayPets is installed, it asks "Import this pet?" and shows which site the link comes from.
3. Say yes. PlayPets imports the pet and opens Invite a friend.

If you run a gallery, add this link to your pet pages:

```text
playpets://import?url=https%3A%2F%2Fpetdex.dev%2Fpets%2Fboba
```

## The Import a pet window <Since v="0.1.0" />

Click **Import a pet** at the top of **Invite a friend**. There are two ways to bring a pet in:

| Way | How |
|---|---|
| From an address | Paste the address of a pet page on a community site, or of a GitHub pet folder, into **Pet page address** and click **Import** |
| From this computer | Click **Import from a folder on this computer** and pick a pet folder |

When the import finishes, the pet joins the yard as a friend right away. A notice says "Imported a new pet and invited it into the yard."

- Address imports fetch files over https only, and only from the pasted address's site (and its subdomains).
- If a page points at files on another site, the import doesn't follow it.

## Supported sites <Since v="0.1.0" />

1. Expand **Find more pets**. It starts collapsed so the address field and import buttons stay easy to find. Inside are compact site rows with import guidance.
2. Click a site to open it in your browser.
3. Copy a pet page address into the field above.

These are community links. Listing a site doesn't mean a partnership.

| Site | Site address |
|---|---|
| OpenPets Registry | openpets.sh |
| Petdex | petdex.dev |
| Codex PokéPets | github.com/dnnyngyen/codex-pokepets |
| Awesome Codex Pet | codexpet.top |
| Codex Pets | codex-pets.net |

The sites above have dedicated import support. Places without a chip work too: a pet folder on GitHub (a folder containing `pet.json`) and pet page addresses on sites built with codex-pet-share.

An entry marked **(browse only)** has no dedicated importer. You can still open it in your browser, and a compatible generic pet page may import when you paste its address. Listing a new site doesn't add import support by itself.

- If the address is wrong or the site doesn't respond, the window tells you why.
- You can't close the window while an import is in progress.

## A folder on your computer <Since v="0.1.0" />

A folder you pick with **Import from a folder on this computer** isn't copied into app storage. The app reads the pet right where it is, which is why it shows up in Invite a friend under **Pets picked from this computer**, with the folder name.

For a ZIP from the creator kit:

1. Extract it into a permanent location.
2. Choose that folder.
3. Keep it at the same path. Don't move or delete it while you use the pet.

::: warning Move the folder and the friend waits
A friend recognizes its pet by the pet folder's path. If you move or delete the picked folder, or unplug its drive, that friend can't come into the yard the next time you open the app.

It isn't removed, though. It waits with its closeness kept, and a notice tells you how many friends are waiting. Put the folder back in the same place and the friend comes back.
:::

## Where pets are saved <Since v="0.1.0" />

A pet imported from an address is saved as one folder in `pets/` in the [data folder](./install.md#data-folder).

- **Open folder** opens that folder right away. These groups in Invite a friend have the button:
  - **Pets imported from an address**
  - **PlayPets starter pets**
  - **Codex pet folder**
- **Pets picked from this computer** has no button. Each card shows its folder name instead.

An imported pet's `pet.json` records where it came from, and its card shows the site, creator and license on one line, like "Petdex, creator, CC BY-NC 4.0". Community pets are their creators' work, so check the license before you use one.

To remove a pet you no longer use, delete its folder inside `pets/`. Friends made from it wait outside the yard from the next start, as described above. If you want them gone too, send them away first.

## Make your own

A pet is one folder with a `pet.json` and one sprite sheet (PNG or WebP). It uses the same format as Codex pets, so a pet made for Codex works as it is.

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

When your folder is ready, invite it right away with **Import from a folder on this computer**.
