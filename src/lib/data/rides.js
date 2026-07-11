export const VEHICLE_UPGRADES = [
  { key: 'bulletproof_glass',    label: 'Bulletproof Glass' },
  { key: 'comms_center',         label: 'Communications Center' },
  { key: 'nos',                  label: 'NOS' },
  { key: 'flamethrower',         label: 'Onboard Flamethrower' },
  { key: 'machine_gun',          label: 'Onboard Machine Gun' },
  { key: 'seating_upgrade',      label: 'Seating Upgrade' },
  { key: 'security_upgrade',     label: 'Security Upgrade' },
  { key: 'smuggling_upgrade',    label: 'Smuggling Upgrade' },
  { key: 'armored_chassis',      label: 'Armored Chassis' },
  { key: 'heavy_chassis',        label: 'Heavy Chassis' },
  { key: 'rocket_pod',           label: 'Onboard Rocket Pod' },
  { key: 'heavy_weapon_mount',   label: 'Heavy Weapon Mount' },
  { key: 'melee_weapon',         label: 'Onboard Melee Weapon' },
  { key: 'combat_plow',          label: 'Combat Plow' },
  { key: 'spike_strip',          label: 'Deployable Spike Strip' },
];

export const CLASS_DEFAULTS = {
  compact:       { spd: 50,  speedCombat: 22 },
  sedan:         { spd: 70,  speedCombat: 20 },
  sport:         { spd: 60,  speedCombat: 24 },
  super_sport:   { spd: 50,  speedCombat: 28 },
  light_armored: { spd: 90,  speedCombat: 18 },
  heavy_armored: { spd: 120, speedCombat: 14 },
  off_road:      { spd: 80,  speedCombat: 19 },
};

export const CLASS_CONFIG = {
  // Cars & Trucks
  compact:       { label: 'Compact',        stripe: '#3a4a5a', badge: '#5a7a9a' },
  sedan:         { label: 'Sedan',           stripe: '#3a4a5a', badge: '#5a7a9a' },
  sport:         { label: 'Sport',           stripe: '#7a4010', badge: '#c9622a' },
  super_sport:   { label: 'Super Sport',     stripe: '#8a5010', badge: '#e07820' },
  light_armored: { label: 'Light Armored',   stripe: '#4a5a30', badge: '#6a8a40' },
  heavy_armored: { label: 'Heavy Armored',   stripe: '#3a4a20', badge: '#5a7030' },
  off_road:      { label: 'Off Road',        stripe: '#5a4020', badge: '#8a6030' },
  // Other
  light_armor:   { label: 'Light Armor',     stripe: '#4a5a30', badge: '#6a8a40' },
  heavy_armor:   { label: 'Heavy Armor',     stripe: '#3a4a20', badge: '#5a7030' },
  military:      { label: 'Military',        stripe: '#2a4020', badge: '#407030' },
  aircraft:      { label: 'Aircraft',        stripe: '#1a3a5a', badge: '#2a6090' },
};
