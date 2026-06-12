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
  ['LBJ','LeBron James',2544],['SC','Stephen Curry',201939],
  ['KD','Kevin Durant',201142],['GIA','Giannis Antetokounmpo',203507],
  ['LUKA','Luka Doncic',1629029],['JOK','Nikola Jokic',203999],
  ['EMB','Joel Embiid',203954],['JT','Jayson Tatum',1628369],
  ['ANT','Anthony Edwards',1630162],['SGA','Shai Gilgeous-Alexander',1628983],
  ['WEMB','Victor Wembanyama',1641705],['DAME','Damian Lillard',203081],
  ['BOOK','Devin Booker',1626164],['JB','Jimmy Butler',202710],
  ['KAWHI','Kawhi Leonard',202695],['AD','Anthony Davis',203076],
  ['JA','Ja Morant',1629630],['SPIDA','Donovan Mitchell',1628378],
  ['HALI','Tyrese Haliburton',1630169],['TRAE','Trae Young',1629027],
  ['ZION','Zion Williamson',1629627],['KAI','Kyrie Irving',202681],
  ['PAOLO','Paolo Banchero',1631094],['KAT','Karl-Anthony Towns',1626157],
  ['FOX','De\'Aaron Fox',1628368],['BAM','Bam Adebayo',1628389],
  ['JBROWN','Jaylen Brown',1627759],['MELO','LaMelo Ball',1630163],
  ['CADE','Cade Cunningham',1630595],['SABO','Domantas Sabonis',1627734],
  ['SIAK','Pascal Siakam',1627783],['CHET','Chet Holmgren',1631096],
  ['SENGUN','Alperen Sengun',1630578],['FRANZ','Franz Wagner',1630532],
  ['MOBLEY','Evan Mobley',1630596],['BRUNSON','Jalen Brunson',1628973],
  ['JJJ','Jaren Jackson Jr',1628991],['MITCH','Mikal Bridges',1628969],
];

export const HEADSHOT_URL = (id) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
export const TEAM_LOGO_URL = (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr.toLowerCase()}.png`;
