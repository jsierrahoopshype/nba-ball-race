// Bundled NBA rosters for the in-ball picker. Stars + all 30 team logos.
// Player headshots: NBA CDN by personId. Team logos: ESPN CDN by abbreviation.
// Both are public, stable URLs. IDs are recalled and may need the odd correction;
// any that 404 fall back to color+initials automatically (see images.js).

export const TEAMS = [
  ['ATL','Hawks'],['BOS','Celtics'],['BKN','Nets'],['CHA','Hornets'],
  ['CHI','Bulls'],['CLE','Cavaliers'],['DAL','Mavericks'],['DEN','Nuggets'],
  ['DET','Pistons'],['GS','Warriors'],['HOU','Rockets'],['IND','Pacers'],
  ['LAC','Clippers'],['LAL','Lakers'],['MEM','Grizzlies'],['MIA','Heat'],
  ['MIL','Bucks'],['MIN','Timberwolves'],['NO','Pelicans'],['NY','Knicks'],
  ['OKC','Thunder'],['ORL','Magic'],['PHI','76ers'],['PHX','Suns'],
  ['POR','Trail Blazers'],['SAC','Kings'],['SA','Spurs'],['TOR','Raptors'],
  ['UTAH','Jazz'],['WSH','Wizards'],
];

// [shortLabel, fullName, nbaPersonId]
export const PLAYERS = [
  ['LBJ','LeBron James',2544,'2544-lebron-james.png'],
  ['SC','Stephen Curry',201939,'201939-stephen-curry.png'],
  ['KD','Kevin Durant',201142,'201142-kevin-durant.png'],
  ['GIA','Giannis Antetokounmpo',203507,'203507-giannis-antetokounmpo.png'],
  ['LUKA','Luka Doncic',1629029,'1629029-luka-doni.png'],
  ['JOK','Nikola Jokic',203999,'203999-nikola-joki.png'],
  ['EMB','Joel Embiid',203954,'203954-joel-embiid.png'],
  ['JT','Jayson Tatum',1628369,'1628369-jayson-tatum.png'],
  ['ANT','Anthony Edwards',1630162,'1630162-anthony-edwards.png'],
  ['SGA','Shai Gilgeous-Alexander',1628983,'1628983-shai-gilgeous-alexander.png'],
  ['WEMB','Victor Wembanyama',1641705,'1641705-victor-wembanyama.png'],
  ['DAME','Damian Lillard',203081,'203081-damian-lillard.png'],
  ['BOOK','Devin Booker',1626164,'1626164-devin-booker.png'],
  ['JB','Jimmy Butler',202710,'202710-jimmy-butler-iii.png'],
  ['KAWHI','Kawhi Leonard',202695,'202695-kawhi-leonard.png'],
  ['AD','Anthony Davis',203076,'203076-anthony-davis.png'],
  ['JA','Ja Morant',1629630,'1629630-ja-morant.png'],
  ['SPIDA','Donovan Mitchell',1628378,'1628378-donovan-mitchell.png'],
  ['HALI','Tyrese Haliburton',1630169,'1630169-tyrese-haliburton.png'],
  ['TRAE','Trae Young',1629027,'1629027-trae-young.png'],
  ['ZION','Zion Williamson',1629627,'1629627-zion-williamson.png'],
  ['KAI','Kyrie Irving',202681,'202681-kyrie-irving.png'],
  ['PAOLO','Paolo Banchero',1631094,'1631094-paolo-banchero.png'],
  ['KAT','Karl-Anthony Towns',1626157,'1626157-karl-anthony-towns.png'],
  ['BAM','Bam Adebayo',1628389,'1628389-bam-adebayo.png'],
  ['JBROWN','Jaylen Brown',1627759,'1627759-jaylen-brown.png'],
  ['MELO','LaMelo Ball',1630163,'1630163-lamelo-ball.png'],
  ['CADE','Cade Cunningham',1630595,'1630595-cade-cunningham.png'],
  ['SABO','Domantas Sabonis',1627734,'1627734-domantas-sabonis.png'],
  ['SIAK','Pascal Siakam',1627783,'1627783-pascal-siakam.png'],
  ['CHET','Chet Holmgren',1631096,'1631096-chet-holmgren.png'],
  ['SENGUN','Alperen Sengun',1630578,'1630578-alperen-sengun.png'],
  ['FRANZ','Franz Wagner',1630532,'1630532-franz-wagner.png'],
  ['MOBLEY','Evan Mobley',1630596,'1630596-evan-mobley.png'],
  ['BRUNSON','Jalen Brunson',1628973,'1628973-jalen-brunson.png'],
  ['JJJ','Jaren Jackson Jr',1628991,'1628991-jaren-jackson-jr.png'],
  ['MITCH','Mikal Bridges',1628969,'1628969-mikal-bridges.png'],
];

// Headshots come from Jorge's nba-headshots repo via raw.githubusercontent.com,
// which sends CORS headers (so the canvas stays clean and recording works).
// NOTE: this points at a WORK BRANCH. If you merge it to main, change BRANCH to 'main'.
const HEADSHOT_REPO = 'jsierrahoopshype/nba-headshots';
const HEADSHOT_BRANCH = 'claude/bulk-download-nba-assets-PP6lk';
const HEADSHOT_DIR = 'players/headshots/face';
export const HEADSHOT_URL = (filename) =>
  `https://raw.githubusercontent.com/${HEADSHOT_REPO}/${HEADSHOT_BRANCH}/${HEADSHOT_DIR}/${filename}`;
export const TEAM_LOGO_URL = (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`;

// Team colors [primary, secondary]. Colors are stable; used for ball fill + border.
export const TEAM_COLORS = {
  ATL:['#E03A3E','#26282A'], BOS:['#007A33','#BA9653'], BKN:['#000000','#FFFFFF'],
  CHA:['#1D1160','#00788C'], CHI:['#CE1141','#000000'], CLE:['#860038','#FDBB30'],
  DAL:['#00538C','#002B5E'], DEN:['#0E2240','#FEC524'], DET:['#C8102E','#1D42BA'],
  GS:['#1D428A','#FFC72C'], HOU:['#CE1141','#000000'], IND:['#002D62','#FDBB30'],
  LAC:['#C8102E','#1D428A'], LAL:['#552583','#FDB927'], MEM:['#5D76A9','#12173F'],
  MIA:['#98002E','#F9A01B'], MIL:['#00471B','#EEE1C6'], MIN:['#0C2340','#236192'],
  NO:['#0C2340','#C8102E'], NY:['#006BB6','#F58426'], OKC:['#007AC1','#EF3B24'],
  ORL:['#0077C0','#C4CED4'], PHI:['#006BB6','#ED174C'], PHX:['#1D1160','#E56020'],
  POR:['#E03A3E','#000000'], SAC:['#5A2D81','#63727A'], SA:['#000000','#C4CED4'],
  TOR:['#CE1141','#000000'], UTAH:['#002B5C','#F9A01B'], WSH:['#002B5C','#E31837'],
};

// Best-effort current team per bundled player, keyed by NBA person id. Team
// COLORS are stable but ASSIGNMENTS churn with trades, so treat these as a
// sensible default that the color box can override per ball.
export const PLAYER_TEAM = {
  2544:'LAL', 201939:'GS', 201142:'PHX', 203507:'MIL', 1629029:'LAL', 203999:'DEN',
  203954:'PHI', 1628369:'BOS', 1630162:'MIN', 1628983:'OKC', 1641705:'SA', 203081:'MIL',
  1626164:'PHX', 202710:'GS', 202695:'LAC', 203076:'DAL', 1629630:'MEM', 1628378:'CLE',
  1630169:'IND', 1629027:'ATL', 1629627:'NO', 202681:'DAL', 1631094:'ORL', 1626157:'NY',
  1628389:'MIA', 1627759:'BOS', 1630163:'CHA', 1630595:'DET', 1627734:'SAC', 1627783:'IND',
  1631096:'OKC', 1630578:'HOU', 1630532:'ORL', 1630596:'CLE', 1628973:'NY', 1628991:'MEM',
  1628969:'NY',
};

// Returns [primary, secondary] for a player id, or null if unknown.
export function teamColorsForPlayer(id) {
  const t = PLAYER_TEAM[id];
  return t && TEAM_COLORS[t] ? TEAM_COLORS[t] : null;
}
