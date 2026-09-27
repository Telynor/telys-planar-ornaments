# Tely's Planar Ornaments

Standalone Foundry VTT v14 / dnd5e 5.3.3 module. Install with the manifest URL after a release is published. Activate alongside Tely's Star Rail Ultimates to see an Upgrade Planar Relics entry in the HSR Hub. Open `TelysPlanar.open()` via a script macro if the Hub is not installed.

GM setup: call `TelysPlanar.openConfig()` from a script macro. Choose an existing world Item as credits; choose any world Items as upgrade materials and assign XP to each. Configure XP per level, credit price per XP, +0/+15 bounds, substat roll bounds, ability mappings, and custom sets. Create a reward from the Planar Ornaments screen, selecting a recipient character, set and Sphere or Rope. Generated loot is embedded in the recipient actor. Owners can equip, unequip and upgrade their own relics. GM must be online for player transactions. A set bonus applies only with both a Sphere and Rope of that set equipped.

Main stat choices follow the Planar Sphere and Link Rope categories. New relics start with no substats. At +3, +6, +9, +12 a distinct substat is added; at +15 one existing substat rolls again. Main values interpolate linearly from configured +0 to +15. Percentage abilities use floor(base + flat + base * combined percentage / 100). Substats exclude the main stat. A stat without a configured target is displayed and exposed through `TelysPlanar.bonuses(actor.items, config)` but does not change D&D mechanics until mapped.

For a custom set, enter stat keys from the GM table or a numeric `system.*` path. Critical range integration requires a target supported by the installed D&D 5e system; configure that target explicitly after confirming its rule fields. This module does not invent a native critical damage score where D&D 5e has none.

The base ability values persist in actor data. The sheet toggle previews original scores. Edit the source ability field as usual to apply ASIs; the relic bonuses recalculate on preparation.
