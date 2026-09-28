# Tely's Planar Ornaments

Standalone Foundry VTT v14 / dnd5e 5.3.3 module for Planar Spheres and Link Ropes. Players manage the shared collection and equip relics from the **Planar Relics** character sheet tab or the **Planar Relics** HSR phone button. The phone also shows GM-only **Planar Relics Config**, **Generate Planar Relics**, and **Set Display Designer** buttons. Generation adds a relic to the shared collection, with a chosen set and Sphere, Link Rope, or random piece. Configuration also remains available from the Planar interface and `TelysPlanar.openConfig()`.

All generated pieces live in one world-wide Planar collection instead of character inventories. Everyone can browse, filter by set/slot/equipment status, and select a relic to equip or upgrade with their character's materials. Hovering shows level, main stat and substats; equipped pieces have the wearer's token portrait on the icon. A character can equip one Sphere and one Link Rope, and a piece can be equipped by one character at a time. On first load, an active GM moves existing character-held planar pieces into the shared collection, retaining their equipped wearers. The 28 canonical planar sets have 56 piece icons. The display projects each piece only when equipped on the selected character. GMs can drag and scale pieces per set in **Set Display Designer**. **Apply Sphere to all sets** and **Apply Link Rope to all sets** copy that piece’s position and scale to all sets and set the default for new custom sets. The display background contains decorative rings only.

## Upgrading

Configure the credit item, XP materials and XP per level as GM. New generated relics begin at +0 with no substats. Every level adds a new distinct substat until four are present, then improves a randomly selected existing one. Each roll yields +1 with 90% probability, +2 with 9%, and +3 with 1%. Speed rolls grant +5, +10 or +15 ft instead. Level is capped at +15. Healing and Energy Regen are Rope main stats only; elemental damage is Sphere main only. Elemental damage adds +1 through level 7, +2 at levels 8–14, and +3 at level 15 to matching damage types. Healing follows the same tier. All other main stat values use configured +0 and +15 bounds.

Equipped relic bonuses apply while equipped. The character sheet's Original Stats toggle presents editable base numbers; Buffed Stats mode is read-only. Crit Range starts from the sheet's existing threshold. Break Effect and Energy Regen use the HSR module's actor fields when that module is active. Elemental and other damage adjustments require Midi-QOL.

The GM's custom set builder adds two-piece bonuses by selecting a substat and a flat amount. The 28 built-in conversions and their intended conditions are listed in `scripts/adaptations.mjs`; some conditional combat triggers still require live Foundry verification and are not represented as always-on bonuses.

## Artwork and licensing

Relic and set icon PNGs were obtained from [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes), which distributes the resource archive under AGPL-3.0. Original Honkai: Star Rail artwork and character designs belong to their respective rights holders. The module is an unofficial fan project.

The display background uses only decorative rings. Sphere and Link Rope renders are independent images that the GM can position and scale in the Set Display Designer; no relic image is baked into the background.
