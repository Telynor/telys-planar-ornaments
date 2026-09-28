# Tely's Planar Ornaments

Standalone Foundry VTT v14 / dnd5e 5.3.3 module for Planar Spheres and Link Ropes. Open from the HSR phone's **Upgrade Planar Relics** menu tile or the `TelysPlanar.open()` macro. GMs also have **Planar Relics Config** and **Generate Planar Relics** phone tiles. Generation prompts for the recipient character, set, and piece (including a random piece option). Configuration remains available from the Planar interface and `TelysPlanar.openConfig()`.

The 28 canonical planar sets have 56 piece icons plus 28 set emblems. The set display projects the matching Sphere and Link Rope when equipped, and previews any selected set. GMs can drag and scale each projected piece per set in **Set Display Designer**, available from the HSR GM panel, Planar interface, or Foundry module settings. **Apply Sphere to all sets** and **Apply Link Rope to all sets** copy the chosen piece’s X, Y and scale to every set without changing the other piece, and save that piece as the default for new custom sets. Set preview artwork uses the original 128×128 PNG assets; the starfield and rings are rendered with CSS.

## Upgrading

Configure the credit item, XP materials and XP per level as GM. New generated relics begin at +0 with no substats. Every level adds a new distinct substat until four are present, then improves a randomly selected existing one. Each roll yields +1 with 90% probability, +2 with 9%, and +3 with 1%. Speed rolls grant +5, +10 or +15 ft instead. Level is capped at +15. Healing and Energy Regen are Rope main stats only; elemental damage is Sphere main only. Elemental damage adds +1 through level 7, +2 at levels 8–14, and +3 at level 15 to matching damage types. Healing follows the same tier. All other main stat values use configured +0 and +15 bounds.

Equipped relic bonuses apply while equipped. The character sheet's Original Stats toggle presents editable base numbers; Buffed Stats mode is read-only. Crit Range starts from the sheet's existing threshold. Break Effect and Energy Regen use the HSR module's actor fields when that module is active. Elemental and other damage adjustments require Midi-QOL.

The GM's custom set builder adds two-piece bonuses by selecting a substat and a flat amount. The 28 built-in conversions and their intended conditions are listed in `scripts/adaptations.mjs`; some conditional combat triggers still require live Foundry verification and are not represented as always-on bonuses.

## Artwork and licensing

Relic and set icon PNGs were obtained from [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes), which distributes the resource archive under AGPL-3.0. Original Honkai: Star Rail artwork and character designs belong to their respective rights holders. The module is an unofficial fan project.

The display background uses only decorative rings. Sphere and Link Rope renders are independent images that the GM can position and scale in the Set Display Designer; no relic image is baked into the background.
