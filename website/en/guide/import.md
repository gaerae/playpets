---
description: How to import a pet from a pet page address on a community site or from a folder on your computer
---

# Import a pet

A pet is a character file. Pets in Codex's pet folder (`~/.codex/pets`) show up in the Invite tab without you doing anything. Other pets have to be imported.

## One-click import from a link <Since v="0.1.0" />

If a pet gallery offers an **Open in PlayPets** link, just click it. The link looks like `playpets://import?url=<pet page address>`; with PlayPets installed it imports that pet and opens the Invite tab. If you run a gallery, add this link to your pet pages.

```text
playpets://import?url=https%3A%2F%2Fpetdex.dev%2Fpets%2Fboba
```

## The Import a pet window <Since v="0.1.0" />

Click **Import a pet** at the top of the **Invite** tab and a window opens. There are two ways.

- Paste the address of a pet page on a community site, or of a GitHub pet folder, into **Pet page address** and click **Import**. Files are fetched over https only, and only from the site of the address you pasted (and its subdomains); a page pointing at files on another site is not followed.
- Click **Import from a folder on this computer** and pick a pet folder.

When the import finishes, that pet is invited into the yard as a friend right away. A notice says "Imported a new pet and invited it into the yard."

## Supported sites <Since v="0.1.0" />

The **Community pets** line at the bottom of the window lists site names as chips. Click a chip and that site opens in your browser. Copy the address from a pet page you like and paste it into the field above.

| Site | Address |
|---|---|
| OpenPets Registry | openpets.sh |
| Petdex | Pet page address |
| Codex PokéPets | Pet page address |
| Awesome Codex Pet | codexpet.top |
| codex-pets.net | Pet page address |
| GitHub | Address of a pet folder (a folder containing `pet.json`) |
| Sites built with codex-pet-share | Pet page address |

Every site in the list can be imported from today. Should a site with a different format join the list, its chip gets **(browse only)**: you can open and look at it, but not import pets from it.

If the address is wrong or the site does not respond, the reason is shown in the window. You cannot close the window while an import is in progress.

## A folder on your computer <Since v="0.1.0" />

A folder picked with **Import from a folder on this computer** is not copied; the app reads it where it is. That is why it shows in the Invite tab under **Pets picked from this computer**, along with the folder name.

::: warning Move the folder and the friend leaves
A friend recognises its pet by the pet folder's path. If you move or delete the folder you picked, that pet's friend leaves the yard the next time you open the app. Put the folder back in the same place and the friend comes back.
:::

## Where pets are saved <Since v="0.1.0" />

A pet imported from an address is saved as one folder in `pets/` in the [data folder](./install.md#data-folder). The **Pets imported from an address** group in the Invite tab has an **Open folder** button that opens that folder right away. The Codex pet folder group has the same button.

The `pet.json` of an imported pet records where it came from. The card in the Invite tab shows the site, creator and license on one line, like "Petdex · creator · CC BY-NC 4.0". Community pets are the work of their creators, so check the license before you use them.

To get rid of a pet you no longer use, delete its folder inside `pets/`. Friends made from that pet leave at the next start.

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
- The rows are rest, walk, wave, jump, error, wait, work and done. v2 has two more rows of 16-direction gaze, so the pet follows the mouse with its eyes on the desktop.
- `description` becomes a new friend's first personality.

The animation for each row and the validation rules are in the developer docs under [Pet file format](/en/dev/standards/pet-files). You can invite the folder you made right away with **Import from a folder on this computer**.
