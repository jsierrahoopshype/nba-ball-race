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
