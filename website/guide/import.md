---
description: How to import a pet from a pet page address on a community site or from a folder on your computer
---

# Import a pet

A pet is a character file. The starter pets that come with the app and pets in Codex's pet folder (`~/.codex/pets`) show up in Invite a friend without you doing anything. Other pets have to be imported.

## One-click import from a link <Since v="0.1.0" />

If a pet gallery offers an **Open in PlayPets** link, just click it. The link looks like `playpets://import?url=<pet page address>`. With PlayPets installed, it first asks "Import this pet?" and shows the site the link comes from; say yes and it imports that pet and opens Invite a friend. If you run a gallery, add this link to your pet pages.

```text
playpets://import?url=https%3A%2F%2Fpetdex.dev%2Fpets%2Fboba
```

## The Import a pet window <Since v="0.1.0" />

Click **Import a pet** at the top of **Invite a friend** and a window opens. There are two ways.

- Paste the address of a pet page on a community site, or of a GitHub pet folder, into **Pet page address** and click **Import**. Files are fetched over https only, and only from the site of the address you pasted (and its subdomains); a page pointing at files on another site is not followed.
- Click **Import from a folder on this computer** and pick a pet folder.

When the import finishes, that pet is invited into the yard as a friend right away. A notice says "Imported a new pet and invited it into the yard."

## Supported sites <Since v="0.1.0" />

**Find more pets** starts collapsed, so the pet address and import actions stay easy to find. Expand it to see compact site rows and their import guidance. Click a site to open it in your browser, then copy a pet page address into the field above. These are community links; listing a site does not imply a partnership.

| Site | Site address |
|---|---|
| OpenPets Registry | openpets.sh |
| Petdex | petdex.dev |
| Codex PokéPets | github.com/dnnyngyen/codex-pokepets |
| Awesome Codex Pet | codexpet.top |
| Codex Pets | codex-pets.net |

Places without a chip work too: the address of a pet folder on GitHub (a folder containing `pet.json`) and pet page addresses on sites built with codex-pet-share.

The sites above have dedicated import support. A discovery entry marked **(browse only)** has no dedicated importer: you can open it in your browser, and compatible generic pet pages may still work when pasted. Listing a new site does not by itself add import support.

If the address is wrong or the site does not respond, the reason is shown in the window. You cannot close the window while an import is in progress.

## A folder on your computer <Since v="0.1.0" />

A folder picked with **Import from a folder on this computer** is not copied; the app reads it where it is. That is why it shows in Invite a friend under **Pets picked from this computer**, along with the folder name.

For a ZIP received from the creator kit, extract it into a permanent location before choosing the folder. Keep that folder at the same path; do not move or delete it while using the pet. The selected folder is not copied into app storage.

::: warning Move the folder and the friend waits
A friend recognises its pet by the pet folder's path. If you move or delete the folder you picked (or unplug the drive it is on), that pet's friend cannot come into the yard the next time you open the app. It is not removed: it waits, with its closeness kept, and a notice says how many friends are waiting. Put the folder back in the same place and the friend comes back.
:::

## Where pets are saved <Since v="0.1.0" />

A pet imported from an address is saved as one folder in `pets/` in the [data folder](./install.md#data-folder). The **Pets imported from an address** group in Invite a friend has an **Open folder** button that opens that folder right away. The **PlayPets starter pets** and **Codex pet folder** groups have the same button. The **Pets picked from this computer** group has no button; each card shows its folder name instead.

The `pet.json` of an imported pet records where it came from. The card in Invite a friend shows the site, creator and license on one line, like "Petdex, creator, CC BY-NC 4.0". Community pets are the work of their creators, so check the license before you use them.

To get rid of a pet you no longer use, delete its folder inside `pets/`. Friends made from that pet wait outside the yard from the next start, as above; send them away first if you want them gone too.

## Make your own

A pet is one folder with a `pet.json` and one sprite sheet (PNG or WebP). The format is the same as Codex pets, so a pet made for Codex works as it is.

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

- The sheet is 1536px wide, each cell is 192×208px, and each row has 8 cells. v1 has 9 rows (1872px), v2 has 11 rows (2288px).
- The nine rows of v1 are, in order, rest, walk right, walk left, wave, jump, error, wait, work and done. v2 has two more rows of 16-direction gaze, so the pet follows the mouse with its eyes on the desktop.
- `description` becomes a new friend's first personality.

The animation for each row and the validation rules are in the developer docs under [Pet file format](/dev/standards/pet-files). You can invite the folder you made right away with **Import from a folder on this computer**.
