import {ADAPTATIONS} from './adaptations.mjs';
export const CANONICAL_SETS = [
  {
    "id": "301",
    "name": "Space Sealing Station",
    "canonicalEffect": "Increases the wearer's ATK by 12%. When the wearer's SPD reaches 120 or higher, the wearer's ATK increases by an extra 12%.",
    "bonuses": [
      {
        "stat": "atkPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "Herta's Space Station",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/301_0.png",
    "ropeName": "Herta's Wandering Trek",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/301_1.png"
  },
  {
    "id": "302",
    "name": "Fleet of the Ageless",
    "canonicalEffect": "Increases the wearer's Max HP by 12%. When the wearer's SPD reaches 120 or higher, all allies' ATK increases by 8%.",
    "bonuses": [
      {
        "stat": "hpPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "The Xianzhou Luofu's Celestial Ark",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/302_0.png",
    "ropeName": "The Xianzhou Luofu's Ambrosial Arbor Vines",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/302_1.png"
  },
  {
    "id": "303",
    "name": "Pan-Cosmic Commercial Enterprise",
    "canonicalEffect": "Increases the wearer's Effect Hit Rate by 10%. Meanwhile, the wearer's ATK increases by an amount that is equal to 25% of the current Effect Hit Rate, up to a maximum increase of 25%.",
    "bonuses": [
      {
        "stat": "effectHit",
        "value": 10
      }
    ],
    "canonical": true,
    "sphereName": "The IPC's Mega HQ",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/303_0.png",
    "ropeName": "The IPC's Trade Route",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/303_1.png"
  },
  {
    "id": "304",
    "name": "Belobog of the Architects",
    "canonicalEffect": "Increases the wearer's DEF by 15%. When the wearer's Effect Hit Rate is 50% or higher, the wearer gains an extra 15% DEF.",
    "bonuses": [
      {
        "stat": "defPct",
        "value": 15
      }
    ],
    "canonical": true,
    "sphereName": "Belobog's Fortress of Preservation",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/304_0.png",
    "ropeName": "Belobog's Iron Defense",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/304_1.png"
  },
  {
    "id": "305",
    "name": "Celestial Differentiator",
    "canonicalEffect": "Increases the wearer's CRIT DMG by 16%. When the wearer's current CRIT DMG reaches 120% or higher, after entering battle, the wearer's CRIT Rate increases by 60% until the end of their first attack.",
    "bonuses": [
      {
        "stat": "critDamage",
        "value": 16
      }
    ],
    "canonical": true,
    "sphereName": "Planet Screwllum's Mechanical Sun",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/305_0.png",
    "ropeName": "Planet Screwllum's Ring System",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/305_1.png"
  },
  {
    "id": "306",
    "name": "Inert Salsotto",
    "canonicalEffect": "Increases the wearer's CRIT Rate by 8%. When the wearer's current CRIT Rate reaches 50% or higher, the DMG dealt by the wearer's Ultimate and Follow-Up ATK increases by 15%.",
    "bonuses": [
      {
        "stat": "critRate",
        "value": 8
      }
    ],
    "canonical": true,
    "sphereName": "Salsotto's Moving City",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/306_0.png",
    "ropeName": "Salsotto's Terminator Line",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/306_1.png"
  },
  {
    "id": "307",
    "name": "Talia: Kingdom of Banditry",
    "canonicalEffect": "Increases the wearer's Break Effect by 16%. When the wearer's SPD reaches 145 or higher, the wearer's Break Effect increases by an extra 20%.",
    "bonuses": [
      {
        "stat": "breakEffect",
        "value": 16
      }
    ],
    "canonical": true,
    "sphereName": "Talia's Nailscrap Town",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/307_0.png",
    "ropeName": "Talia's Exposed Electric Wire",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/307_1.png"
  },
  {
    "id": "308",
    "name": "Sprightly Vonwacq",
    "canonicalEffect": "Increases the wearer's Energy Regeneration Rate by 5%. When the wearer's SPD reaches 120 or higher, the wearer's action is Advanced Forward by 40% immediately upon entering battle.",
    "bonuses": [
      {
        "stat": "energyRegen",
        "value": 5
      }
    ],
    "canonical": true,
    "sphereName": "Vonwacq's Island of Birth",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/308_0.png",
    "ropeName": "Vonwacq's Islandic Coast",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/308_1.png"
  },
  {
    "id": "309",
    "name": "Rutilant Arena",
    "canonicalEffect": "Increases the wearer's CRIT Rate by 8%. When the wearer's current CRIT Rate reaches 70% or higher, DMG dealt by Basic ATK and Skill increases by 20%.",
    "bonuses": [
      {
        "stat": "critRate",
        "value": 8
      }
    ],
    "canonical": true,
    "sphereName": "Taikiyan Laser Stadium",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/309_0.png",
    "ropeName": "Taikiyan's Arclight Race Track",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/309_1.png"
  },
  {
    "id": "310",
    "name": "Broken Keel",
    "canonicalEffect": "Increases the wearer's Effect RES by 10%. When the wearer's Effect RES is at 30% or higher, all allies' CRIT DMG increases by 10%.",
    "bonuses": [
      {
        "stat": "effectRes",
        "value": 10
      }
    ],
    "canonical": true,
    "sphereName": "Insumousu's Whalefall Ship",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/310_0.png",
    "ropeName": "Insumousu's Frayed Hawser",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/310_1.png"
  },
  {
    "id": "311",
    "name": "Firmament Frontline: Glamoth",
    "canonicalEffect": "Increases the wearer's ATK by 12%. When the wearer's SPD is equal to or higher than 135/160, the wearer deals 12%/18% more DMG.",
    "bonuses": [
      {
        "stat": "atkPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "Glamoth's Iron Cavalry Regiment",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/311_0.png",
    "ropeName": "Glamoth's Silent Tombstone",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/311_1.png"
  },
  {
    "id": "312",
    "name": "Penacony, Land of the Dreams",
    "canonicalEffect": "Increases wearer's Energy Regeneration Rate by 5%. Increases DMG by 10% for all other allies that are of the same Type as the wearer.",
    "bonuses": [
      {
        "stat": "energyRegen",
        "value": 5
      }
    ],
    "canonical": true,
    "sphereName": "Penacony's Grand Hotel",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/312_0.png",
    "ropeName": "Penacony's Dream-Seeking Tracks",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/312_1.png"
  },
  {
    "id": "313",
    "name": "Sigonia, the Unclaimed Desolation",
    "canonicalEffect": "Increases the wearer's CRIT Rate by 4%. When an enemy target gets defeated, the wearer's CRIT DMG increases by 4%, stacking up to 10 time(s).",
    "bonuses": [
      {
        "stat": "critRate",
        "value": 4
      }
    ],
    "canonical": true,
    "sphereName": "Sigonia's Gaiathra Berth",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/313_0.png",
    "ropeName": "Sigonia's Knot of Cyclicality",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/313_1.png"
  },
  {
    "id": "314",
    "name": "Izumo Gensei and Takama Divine Realm",
    "canonicalEffect": "Increases the wearer's ATK by 12%. When entering battle, if at least one teammate follows the same Path as the wearer, then the wearer's CRIT Rate increases by 12%.",
    "bonuses": [
      {
        "stat": "atkPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "Izumo's Magatsu no Morokami",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/314_0.png",
    "ropeName": "Izumo's Blades of Origin and End",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/314_1.png"
  },
  {
    "id": "315",
    "name": "Duran, Dynasty of Running Wolves",
    "canonicalEffect": "When an ally character uses a Follow-Up ATK, the wearer gains 1 stack of \"Merit,\" stacking up to 5 time(s). Each stack of \"Merit\" increases the DMG dealt by the wearer's Follow-Up ATKs by 5%. When there are 5 stacks, additionally increases the wearer's CRIT DMG by 25%.",
    "bonuses": [],
    "canonical": true,
    "sphereName": "Duran's Tent of Golden Sky",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/315_0.png",
    "ropeName": "Duran's Mechabeast Bridle",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/315_1.png"
  },
  {
    "id": "316",
    "name": "Forge of the Kalpagni Lantern",
    "canonicalEffect": "Increases the wearer's SPD by 6%. When the wearer hits an enemy target that has Fire Weakness, the wearer's Break Effect increases by 40%, lasting for 1 turn(s).",
    "bonuses": [
      {
        "stat": "speedPct",
        "value": 6
      }
    ],
    "canonical": true,
    "sphereName": "Forge's Lotus Lantern Wick",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/316_0.png",
    "ropeName": "Forge's Heavenly Flamewheel Silk",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/316_1.png"
  },
  {
    "id": "317",
    "name": "Lushaka, the Sunken Seas",
    "canonicalEffect": "Increases the wearer's Energy Regeneration Rate by 5%. If the wearer is not the first character in the team lineup, then increases the ATK of the first character in the team lineup by 12%.",
    "bonuses": [
      {
        "stat": "energyRegen",
        "value": 5
      }
    ],
    "canonical": true,
    "sphereName": "Lushaka's Waterscape",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/317_0.png",
    "ropeName": "Lushaka's Twinlanes",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/317_1.png"
  },
  {
    "id": "318",
    "name": "The Wondrous BananAmusement Park",
    "canonicalEffect": "Increases the wearer's CRIT DMG by 16%. When a target summoned by the wearer is on the field, CRIT DMG additionally increases by 32%.",
    "bonuses": [
      {
        "stat": "critDamage",
        "value": 16
      }
    ],
    "canonical": true,
    "sphereName": "BananAmusement Park's BananAxis Plaza",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/318_0.png",
    "ropeName": "BananAmusement Park's Memetic Cables",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/318_1.png"
  },
  {
    "id": "319",
    "name": "Bone Collection's Serene Demesne",
    "canonicalEffect": "Increases the wearer's Max HP by 12%. When the wearer's Max HP is 5000 or higher, increases the wearer's and their memosprite's CRIT DMG by 28%.",
    "bonuses": [
      {
        "stat": "hpPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "Aidonia's Deceased Gravestones",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/319_0.png",
    "ropeName": "Aidonia's Deathward Bone Chains",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/319_1.png"
  },
  {
    "id": "320",
    "name": "Giant Tree of Rapt Brooding",
    "canonicalEffect": "Increases the wearer's SPD by 6%. When the wearer's SPD is 135/180 or higher, the wearer and their memosprite's Outgoing Healing increases by 12%/20%.",
    "bonuses": [
      {
        "stat": "speedPct",
        "value": 6
      }
    ],
    "canonical": true,
    "sphereName": "Grove of Epiphany's Pondering Colossus",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/320_0.png",
    "ropeName": "Grove of Epiphany's Interwoven Veins",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/320_1.png"
  },
  {
    "id": "321",
    "name": "Arcadia of Woven Dreams",
    "canonicalEffect": "When the number of ally targets on the field is not equal to 4, for every 1 additional/missing ally target, increases the DMG dealt by the wearer and their memosprite by 9%/12%, stacking up to 4/3 time(s).",
    "bonuses": [],
    "canonical": true,
    "sphereName": "Membrance Maze's Serene Treehouse",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/321_0.png",
    "ropeName": "Membrance Maze's Wishing Whistle",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/321_1.png"
  },
  {
    "id": "322",
    "name": "Revelry by the Sea",
    "canonicalEffect": "Increases the wearer's ATK by 12%. When the wearer's ATK is higher than or equal to 2400/3600, increases the DoT DMG dealt by 12%/24% respectively.",
    "bonuses": [
      {
        "stat": "atkPct",
        "value": 12
      }
    ],
    "canonical": true,
    "sphereName": "Warbling Shores' Blazing Beacon",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/322_0.png",
    "ropeName": "Warbling Shores' Cantillation Trail",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/322_1.png"
  },
  {
    "id": "323",
    "name": "Amphoreus, The Eternal Land",
    "canonicalEffect": "Increases the wearer's CRIT Rate by 8%. While the wearer's memosprite is on the field, increases all allies' SPD by 8%. This effect cannot be stacked.",
    "bonuses": [
      {
        "stat": "critRate",
        "value": 8
      }
    ],
    "canonical": true,
    "sphereName": "Last West Wind of Amphoreus",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/323_0.png",
    "ropeName": "Eternal Verses of Amphoreus",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/323_1.png"
  },
  {
    "id": "324",
    "name": "Tengoku@Livestream",
    "canonicalEffect": "Increases the wearer's CRIT DMG by 16%. If 3 or more Skill Points are consumed in the same turn, additionally increases the wearer's CRIT DMG by 32%, lasting for 3 turns.",
    "bonuses": [
      {
        "stat": "critDamage",
        "value": 16
      }
    ],
    "canonical": true,
    "sphereName": "Livestream's Protean Vistas",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/324_0.png",
    "ropeName": "Livestream's Chatter Banter",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/324_1.png"
  },
  {
    "id": "325",
    "name": "Punklorde Stage Zero",
    "canonicalEffect": "Increases the wearer's Elation by 8%. When Elation reaches 40%/80% for the first time in combat, increases the wearer's CRIT DMG by 20%/32%.",
    "bonuses": [
      {
        "stat": "elation",
        "value": 8
      }
    ],
    "canonical": true,
    "sphereName": "Punklorde's Rainbow City",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/325_0.png",
    "ropeName": "Punklorde's Data Deluge",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/325_1.png"
  },
  {
    "id": "326",
    "name": "City of Converging Stars",
    "canonicalEffect": "When the wearer uses Follow-Up ATK, increases ATK by 24% for 2 turn(s). When an enemy target gets defeated, increases CRIT DMG for all allies by 12% in the current battle. This effect cannot stack.",
    "bonuses": [],
    "canonical": true,
    "sphereName": "Astropolis Media Headquarters",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/326_0.png",
    "ropeName": "Astropolis Employee Credentials",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/326_1.png"
  },
  {
    "id": "327",
    "name": "Fallen Star Anchorage",
    "canonicalEffect": "Increases the wearer's CRIT Rate by 8%. When entering combat, if the wearer and another teammate are both Trailblaze Companions characters, increases the wearer's CRIT DMG by 32%.",
    "bonuses": [
      {
        "stat": "critRate",
        "value": 8
      }
    ],
    "canonical": true,
    "sphereName": "Stranded Express at the Anchorage",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/327_0.png",
    "ropeName": "Silver Rails of the Anchorage",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/327_1.png"
  },
  {
    "id": "328",
    "name": "Cosmic Life Sciences Institute",
    "canonicalEffect": "When entering combat, if the wearer's Max Energy is greater than or equal to 200, for every 1 excess point, increases the wearer's DMG dealt by 0.2%, up to a max increase of 32%.",
    "bonuses": [],
    "canonical": true,
    "sphereName": "Central Synapse of the Life Sciences Institute",
    "sphereImage": "modules/telys-planar-ornaments/assets/relic/328_0.png",
    "ropeName": "Peripheral Conduits of the Life Sciences Institute",
    "ropeImage": "modules/telys-planar-ornaments/assets/relic/328_1.png"
  }
];
for(const set of CANONICAL_SETS){
  const conversion=ADAPTATIONS[set.id];
  set.bonuses=(conversion?.bonuses??[]).map(([stat,value])=>({stat,value}));
  set.adaptedEffect=conversion?.text??'';
  set.setImage=`modules/telys-planar-ornaments/assets/sets/${set.id}.png`;
}
