# Tely's Planar Ornaments

Standalone Foundry VTT v14 / dnd5e 5.3.3 module. Install with the manifest URL after a release is published. Activate alongside Tely's Star Rail Ultimates to see an Upgrade Planar Relics entry in the HSR Hub. Open `TelysPlanar.open()` via a script macro if the Hub is not installed.

GM setup: call `TelysPlanar.openConfig()` from a script macro. Choose an existing world Item as credits; choose any world Items as upgrade materials and assign XP to each. Configure XP per level, credit price per XP, +0/+15 bounds, substat roll bounds, ability mappings, and custom sets. Create a reward from the Planar Ornaments screen, selecting a recipient character, set and Sphere or Rope. Generated loot is embedded in the recipient actor. Owners can equip, unequip and upgrade their own relics. GM must be online for player transactions. A set bonus applies only with both a Sphere and Rope of that set equipped.

Main stat choices follow the Planar Sphere and Link Rope categories. New relics start with no substats. At +3, +6, +9, +12 a distinct substat is added; at +15 one existing substat rolls again. Main values interpolate linearly from configured +0 to +15. Percentage abilities use floor(base + flat + base * combined percentage / 100). Substats exclude the main stat. A stat without a configured target is displayed and exposed through `TelysPlanar.bonuses(actor.items, config)` but does not change D&D mechanics until mapped.

For a custom set, enter stat keys from the GM table or a numeric `system.*` path. Crit rate adjusts the minimum d20 critical threshold for dnd5e attack activities. Crit damage, effect hit/resistance, elemental damage and other HSR-only stats need a GM-defined numeric D&D target to have a mechanical effect; unconfigured values remain visible in the module API.

The base ability values persist in actor data. The sheet toggle previews original scores. Edit the source ability field as usual to apply ASIs; the relic bonuses recalculate on preparation.

## Percentage damage and critical rate (preview)

With Midi-QOL active, damage percentages from equipped custom two-piece bonuses with stat key `damagePct` and Arcadia of Woven Dreams are added after the original damage roll, before target mitigation. Each source contributes `floor(base rolled damage × rate / 100)`. The original dice are not rerolled. A separate breakdown in chat lists the rolled base, each set and its integer bonus, and the total sent to the damage workflow. For example, 23 base damage and Arcadia +9% gives +2 and 25 before resistance. Healing is excluded. This applies through Midi-QOL's evaluated-damage workflow; direct manual HP adjustments are unaffected.

Critical-rate bonuses are percentage points, not additional d20 faces. The attack threshold is chosen once before each d20 roll: +8% changes a natural-20 baseline (5%) into 19–20 (10%) on 40% of attacks and 18–20 (15%) on 60% of attacks, averaging 13%. Individual attack rolls still have a whole-number d20 threshold.
