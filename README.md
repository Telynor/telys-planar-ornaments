# Tely's Planar Ornaments

## First-open character sheet layout (1.0.20)

Fixes the Original/Buffed Stats helper placing a saving-throw summary directly in the D&D5e 6 details grid. Skills and Saving Throws now keep their native columns on the first opening. Native signed modifiers are updated inside the actual Saving Throws panel, including localized sheets, and any fallback summary stays inside that panel.

The existing header toggle also rebinds when Foundry replaces only the sheet body, preserving the selected stats mode, editable base scores and pre-existing field locks. Repeated render hooks do not duplicate controls or move the layout. Character data and Path builds are unchanged; update Planar Ornaments and reload Foundry.

## Equipment for each character Path (1.0.19)

With Ultimates preview.30, open Planar Relics and choose **Path loadout** to configure each saved build's Sphere and Link Rope. Equipped badges use its configured Path icon (or token/preview art when no icon is configured), identify the build by name, and show whether it is active. The sheet's Planar display follows the active build.

Several saved sets can remain assigned to the same character. Only the active Path's pieces grant main stats, substats, set bonuses, damage, crit, Energy Regen and party effects. Editing an inactive build does not activate its bonuses. A shared piece may be assigned to multiple Paths, retaining its existing upgrades and rolls. Changing one Path's slot preserves the others. Legacy assignments belong to the original build until changed. Lushaka recipients can differ by Path.

Update Ultimates to **3.14.0-preview.30** for per-Path Light Cone selection as well. Inventory and item charges remain shared.


## Update 1.0.18 — Foundry v14 startup and designer

Fixed the startup exception `You must provide a menu type that is a FormApplication or ApplicationV2 instance or subclass`. The Set Display Designer is now an ApplicationV2 with native render options, content replacement and render lifecycle handling. Existing drag, scale, set-switching, apply-to-all and save behavior is retained.

Modern effect changes are read by their string type without touching deprecated numeric getters. Internal operation codes still support the existing API, while saved effects continue using v14 string types.

Validation: 39 Node tests passed, including the actual init hook under a strict settings-menu type check. Chromium checks passed for designer editing, wheel resizing, set switching, defaults, saving/reopening and the shared Ultimates Actor/NPC controls. These browser checks use Foundry platform mocks; live-world validation remains pending.

## Update 1.0.17 — Midi-QOL and D&D5e 6

For a D&D5e **6.0.6** world, use **Midi-QOL 14.6.0** and **DAE 14.6.0** on Foundry **14.368 or newer**. The authors publish these through the [Midi-QOL 14.6 manifest](https://gitlab.com/tposney/midi-qol/-/releases/v14.6.0/downloads/module.json) and [DAE 14.6 manifest](https://gitlab.com/tposney/dae/-/releases/v14.6.0/downloads/module.json). The catalog's Midi 14.0 line targets D&D5e 5.x; changing an HSR module cannot make that upstream version support D&D5e 6. D&D5e 5.3.3 worlds retain their Midi/DAE 14.0 integration.

Planar effects now use v14 `system.changes` data and map attack/save/initiative/movement bonuses to the installed D&D5e version. Existing saved mappings are translated when effects are synchronized. Repeated synchronization ignores system-generated effect IDs and filters. Speed-based set conditions read the version 6 movement data.

Damage and healing modifiers prefer Midi's awaited `setDamageRolls` API, retaining separate damage types and extra components. Legacy scalar setters remain supported. Aborted workflows do not grant completion bonuses. Use with Ultimates preview.27 and Memosprites 1.4.2 for the complete HSR integration update.

Validation: 35 Node tests plus the shared Actor/NPC controls browser regression passed, including typed multi-part damage, healing, persisted effects and legacy paths. Live Foundry/Midi combat has not been executed in this workspace.

Standalone Foundry VTT v14 / D&D5e 5.3.3–5.x or 6.x module for Planar Spheres and Link Ropes. Players manage the shared collection and equip relics from the **Planar Relics** character sheet tab. The HSR phone designer offers four optional actions in each button's **Opens** menu: player-facing **Planar Relics** and GM-only **Planar Relics Config**, **Generate Planar Relics**, and **Set Display Designer**. Add, place, and size those buttons in the phone designer; this module inserts none automatically. Generation adds a relic to the shared collection, with a chosen set and Sphere, Link Rope, or random piece. Configuration also remains available through `TelysPlanar.openConfig()`.

Every player sees the same Planar collection. Equipped ornaments show the wearer's token at the top left, and the collection can be filtered by wearer. The equipment display defaults to the selected character's equipped set and projects only the Sphere or Link Rope that character has equipped.

All generated pieces live in one world-wide Planar collection instead of character inventories. Everyone can browse, filter by set/slot/equipment status, and select a relic to equip or upgrade with their character's materials. Hovering shows level, main stat and substats; equipped pieces have the wearer's token portrait on the icon. A character can equip one Sphere and one Link Rope, and a piece can be equipped by one character at a time. On first load, an active GM moves existing character-held planar pieces into the shared collection, retaining their equipped wearers. The 30 canonical planar sets have 60 piece icons. The display projects each piece only when equipped on the selected character. GMs can drag and scale pieces per set in **Set Display Designer**. **Apply Sphere to all sets** and **Apply Link Rope to all sets** copy that piece’s position and scale to all sets and set the default for new custom sets. The display background contains decorative rings only.

## Upgrading

The GM drags up to three XP granting Items into the configuration and sets XP per copy. Drag a separate currency Item and set the amount of XP paid for by one currency copy; the currency cost rounds up. Configure XP per level as GM. New generated relics begin at +0 with no substats. Every level adds a new distinct substat until four are present, then improves a randomly selected existing one. Each roll yields +1 with 90% probability, +2 with 9%, and +3 with 1%. Speed rolls grant +5, +10 or +15 ft instead. Level is capped at +15. Healing and Energy Regen are Rope main stats only; elemental damage is Sphere main only. Elemental damage adds +1 through level 7, +2 at levels 8–14, and +3 at level 15 to matching damage types. Healing follows the same tier. All other main stat values use configured +0 and +15 bounds.

Equipped relic bonuses apply while equipped. The character sheet's Original Stats toggle presents editable base numbers; Buffed Stats mode is read-only. Crit Range starts from the sheet's existing threshold. Break Effect and Energy Regen use the HSR module's actor fields when that module is active. Elemental and other damage adjustments require Midi-QOL.

The GM's custom set builder adds two-piece bonuses by selecting a substat and a flat amount. The 30 built-in conversions and their intended conditions are listed in `scripts/adaptations.mjs`; some conditional combat triggers still require live Foundry verification and are not represented as always-on bonuses.

## Artwork and licensing

Relic and set icon PNGs were obtained from [Mar-7th/StarRailRes](https://github.com/Mar-7th/StarRailRes), which distributes the resource archive under AGPL-3.0. Original Honkai: Star Rail artwork and character designs belong to their respective rights holders. The module is an unofficial fan project.

The display background uses only decorative rings. Sphere and Link Rope renders are independent images that the GM can position and scale in the Set Display Designer; no relic image is baked into the background.

## Compact Actor sheet controls (1.0.16)

Planar Relics now uses a small nodes icon next to the Ultimates Toughness, Multitype and Boss controls. On PC sheets it opens that character’s equipment, upgrades and set details; on NPC sheets the GM icon opens global set/currency/material settings. The PC Planar tab remains available on sheets that support tabs. The Original/Buffed stats toggle is also a compact header icon with a descriptive tooltip.

Actor configuration is only added to actual Actor documents. Spell Items and Summon/other activity windows no longer acquire a large Planar Relics banner from their owner Actor getter. The shared header controls stay inside the sheet and hide when minimized.
