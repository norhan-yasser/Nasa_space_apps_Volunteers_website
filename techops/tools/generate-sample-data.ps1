# Generates the dummy CSV data for the TechOps prototype backend sheet.
# Run:  powershell -ExecutionPolicy Bypass -File tools\generate-sample-data.ps1
# Output: ..\sample-data\*.csv  (Rooms, WiFi, Team, Inventory, Reports, Meetups)
# All values are DUMMY test data. Replace with real data in the Google Sheet later.

$out = Join-Path $PSScriptRoot '..\sample-data'
New-Item -ItemType Directory -Force -Path $out | Out-Null

# --- Room geometry (same measurements as the floor plans; used only to place Wi-Fi points) ---
# code, floor, zone, assigned group, flat geometry (rect = 4 numbers, polygon = x,y pairs)
$rooms = @(
  # Ground floor
  @('S034','G','VIPs','VIP Lounge A',@(86,201,185,287)),
  @('S035','G','VIPs','VIP Lounge B',@(87,312,185,394)),
  @('C027','G','Participants','Team Nebula; Team Orbit',@(511,240,558,320)),
  @('C026','G','Participants','Team Aurora; Team Zenith',@(559,240,607,320)),
  @('C017','G','Volunteers','Registration Desk',@(1157,240,1202,320)),
  @('S016','G','Judges','Judges Panel 1',@(1259,273,1220,208,1295,165,1333,229)),
  @('S015','G','Judges','Judges Panel 2',@(1309,360,1270,295,1341,252,1381,316)),
  # First floor
  @('S140','F','Participants','Team Quasar; Team Lyra',@(126,178,229,269)),
  @('S141','F','Mentors','Mentor Hub 1',@(126,295,230,378)),
  @('C139','F','Participants','Team Vega; Team Comet',@(283,218,335,304)),
  @('C138','F','Participants','Team Pulsar',@(334,218,384,304)),
  @('C137','F','Participants','Team Helios; Team Titan',@(384,218,434,304)),
  @('C136','F','Participants','Team Rigel',@(434,218,485,304)),
  @('B135','F','Participants','Team Andromeda',@(485,218,537,304)),
  @('B134','F','Participants','Team Cassini',@(537,218,591,304)),
  @('B133','F','Volunteers','TechOps HQ',@(589,218,639,304)),
  @('B132','F','Volunteers','Volunteer Base',@(639,218,691,304)),
  @('B131','F','Participants','Team Kepler',@(940,218,994,303)),
  @('B130','F','Participants','Team Hubble',@(991,218,1040,303)),
  @('B129','F','Participants','Team Voyager',@(1039,217,1089,303)),
  @('B128','F','Participants','Team Juno',@(1088,217,1138,303)),
  @('C127','F','Participants','Team Galileo',@(1138,217,1185,303)),
  @('C126','F','Participants','Team Artemis',@(1185,217,1235,303)),
  @('C125','F','Participants','Team Gemini',@(1234,217,1283,303)),
  @('C124','F','Participants','Team Apollo',@(1283,217,1333,303)),
  @('S123','F','Judges','Judges Panel 3',@(1396,248,1355,178,1437,130,1478,201)),
  @('S122','F','Judges','Judges Panel 4',@(1403,368,1362,298,1489,224,1530,294)),
  @('H114','F','Participants','Team Odyssey; Team Mariner; Team Pioneer',@(1466,568,1432,510,1527,455,1561,513)),
  @('H113','F','Participants','Team Cosmos; Team Eclipse; Team Horizon',@(1516,658,1477,591,1563,542,1602,608)),
  @('C154','F','Mentors','Mentor Hub 2',@(381,530,430,617)),
  @('C153','F','Mentors','Mentor Hub 3',@(431,530,481,618)),
  @('C152','F','Volunteers','Volunteer Rest Area',@(480,530,534,618)),
  # Second floor
  @('S241','S','Judges','Judges Panel 5',@(119,165,224,257)),
  @('S242','S','Judges','Judges Panel 6',@(120,282,225,363)),
  @('C240','S','VIPs','VIP Lounge C',@(274,203,324,286)),
  @('B236','S','Mentors','Mentor Command',@(465,203,512,286)),
  @('B235','S','Mentors','Mentor Desk A',@(511,203,559,286)),
  @('B234','S','Mentors','Mentor Desk B',@(559,203,607,286)),
  @('B233','S','Mentors','Mentor Desk C',@(607,203,661,286)),
  @('C231','S','Participants','Team Sirius',@(916,199,963,279)),
  @('C230','S','Participants','Team Vector',@(962,199,1011,280)),
  @('C229','S','Participants','Team Photon',@(1010,198,1058,280)),
  @('C228','S','Participants','Team Quark',@(1058,197,1105,280)),
  @('C227','S','Participants','Team Neutron',@(1106,198,1153,280)),
  @('C226','S','Participants','Team Ion',@(1152,198,1200,280)),
  @('C225','S','Participants','Team Plasma',@(1201,198,1249,280)),
  @('C224','S','Participants','Team Flux',@(1249,198,1300,280)),
  @('H210','S','Participants','Team Nova; Team Astra; Team Lumen',@(1448,534,1403,462,1512,394,1557,465)),
  @('H209','S','Participants','Team Stellar; Team Cosmo; Team Ranger',@(1506,629,1460,555,1573,486,1618,559)),
  @('C260','S','Volunteers','Logistics Standby',@(119,492,173,585)),
  @('C259','S','Participants','Team Mira',@(172,492,223,585)),
  @('C258','S','Participants','Team Atlas',@(268,492,317,585)),
  @('C257','S','Participants','Team Delta',@(316,492,364,584)),
  @('C256','S','Participants','Team Omega',@(363,492,412,584)),
  @('C265','S','VIPs','VIP Lounge D',@(617,698,512,698,512,612,617,612))
)

$typeName = @{ B='Bring Your Own Device'; H='Lecture Hall'; S='Small Lecture Hall'; C='Classroom' }
$typeCap  = @{ B=40; H=120; S=45; C=30 }
$floorName = @{ G='Ground Floor'; F='First Floor'; S='Second Floor' }

function Get-Center($g) {
  if ($g.Count -eq 4) { return @([int](($g[0]+$g[2])/2), [int](($g[1]+$g[3])/2)) }
  $xs = @(); $ys = @()
  for ($i=0; $i -lt $g.Count; $i+=2) { $xs += $g[$i]; $ys += $g[$i+1] }
  return @([int](($xs | Measure-Object -Average).Average), [int](($ys | Measure-Object -Average).Average))
}

# --- Rooms tab ---
$roomRows = foreach ($r in $rooms) {
  $t = $r[0].Substring(0,1)
  $cap = $typeCap[$t]
  if ($r[2] -eq 'VIPs') { $cap = 20 }
  [pscustomobject][ordered]@{
    'Room Code'      = $r[0]
    'Floor'          = $floorName[$r[1]]
    'Zone'           = $r[2]
    'Space Type'     = $typeName[$t]
    'Capacity'       = $cap
    'Assigned To'    = $r[3]
    'Room Contact'   = ''
  }
}
$roomRows | Export-Csv -Path (Join-Path $out 'Rooms.csv') -NoTypeInformation -Encoding UTF8

# --- WiFi tab (one reading per room + corridor / hall access points) ---
$rand = New-Object System.Random 7
$override = @{ H113=9; H114=14; C139=17; C260=6; C259=11; B128=24; C124=31; S241=21; C017=44 }
$wifi = @()
foreach ($r in $rooms) {
  $c = Get-Center $r[4]
  $mbps = 55 + $rand.Next(0,46)
  if ($c[0] -lt 200 -or $c[0] -gt 1380) { $mbps -= 28 }
  if ($r[2] -eq 'Judges' -or $r[2] -eq 'VIPs') { $mbps += 15 }
  if ($override.ContainsKey($r[0])) { $mbps = $override[$r[0]] }
  $mbps = [Math]::Max(3, [Math]::Min(150, $mbps))
  $lat = [int](8 + (150 - $mbps) * 0.9 + $rand.Next(0,8))
  $wifi += [pscustomobject][ordered]@{
    'Point ID'     = 'WF-' + $r[0]
    'Floor'        = $floorName[$r[1]]
    'Label'        = 'Room ' + $r[0]
    'X'            = $c[0]
    'Y'            = $c[1]
    'Speed Mbps'   = $mbps
    'Latency ms'   = $lat
    'Last Updated' = '2026-11-06 12:30'
  }
}
$corridors = @(
  @('G','Main Entrance Hall',720,640,92), @('G','Auditorium Foyer',730,380,70), @('G','West Corridor',350,350,48), @('G','East Corridor',1100,330,12), @('G','Outer Stage Side',1380,430,5),
  @('F','Central Atrium',730,420,84), @('F','West Corridor',320,400,62), @('F','East Corridor',1200,400,38), @('F','South Corridor',800,660,26), @('F','Stairs East',1450,420,8),
  @('S','Central Atrium',730,420,79), @('S','West Corridor',300,420,58), @('S','East Corridor',1250,430,35), @('S','South Wing',900,620,18), @('S','North Wing',800,150,66)
)
$i = 1
foreach ($k in $corridors) {
  $wifi += [pscustomobject][ordered]@{
    'Point ID'     = 'WF-AP' + $i.ToString('00')
    'Floor'        = $floorName[$k[0]]
    'Label'        = $k[1]
    'X'            = $k[2]
    'Y'            = $k[3]
    'Speed Mbps'   = $k[4]
    'Latency ms'   = [int](8 + (150 - $k[4]) * 0.9)
    'Last Updated' = '2026-11-06 12:30'
  }
  $i++
}
$wifi | Export-Csv -Path (Join-Path $out 'WiFi.csv') -NoTypeInformation -Encoding UTF8

# --- Team tab ---
$team = @(
  @('Mohamed Khairy','TechOps Lead','+20 100 000 0001','First Floor','B133','Available','Overall coordination'),
  @('Omar','Hardware & Equipment','+20 100 000 0002','First Floor','B133','Available','Cables, power strips, projectors'),
  @('Lojine','Network Engineer','+20 100 000 0003','First Floor','H113','On a task','Wi-Fi access points'),
  @('Karim','Power & Electrical','+20 100 000 0004','Ground Floor','C026','Available','Extension lines, outlets'),
  @('Tasbeeh','Floor Support (First)','+20 100 000 0005','First Floor','C139','Available','Participant help desk'),
  @('Nour','Floor Support (Second)','+20 100 000 0006','Second Floor','C231','Busy','Participant help desk'),
  @('Youssef','Live Stream & AV','+20 100 000 0007','Ground Floor','S016','On a task','Judges rooms AV'),
  @('Hana','Floor Support (Ground)','+20 100 000 0008','Ground Floor','C017','Available','Registration support')
)
$team | ForEach-Object {
  [pscustomobject][ordered]@{
    'Name'='' + $_[0]; 'Role'=$_[1]; 'Phone'=$_[2]; 'Current Floor'=$_[3]; 'Current Room'=$_[4]; 'Status'=$_[5]; 'Focus Area'=$_[6]
  }
} | Export-Csv -Path (Join-Path $out 'Team.csv') -NoTypeInformation -Encoding UTF8

# --- Inventory tab (one row = one holding or one lending record) ---
$inv = @(
  @('INV-001','Power strip (6 outlets)','Power',10,'Omar','','','','With member'),
  @('INV-002','Power strip (6 outlets)','Power',4,'Omar','Team Vega','C139','First Floor','Lent out'),
  @('INV-003','Power strip (6 outlets)','Power',3,'Karim','Team Aurora','C026','Ground Floor','Lent out'),
  @('INV-004','Extension reel 20 m','Power',5,'Karim','','','','With member'),
  @('INV-005','Extension reel 20 m','Power',1,'Karim','Team Cosmos','H113','First Floor','Lent out'),
  @('INV-006','HDMI cable 3 m','Cables',12,'Omar','','','','With member'),
  @('INV-007','HDMI cable 3 m','Cables',2,'Youssef','Judges Panel 1','S016','Ground Floor','Lent out'),
  @('INV-008','Ethernet cable 10 m','Cables',15,'Lojine','','','','With member'),
  @('INV-009','Ethernet cable 10 m','Cables',3,'Lojine','Team Nova','H210','Second Floor','Lent out'),
  @('INV-010','Portable Wi-Fi router','Network',3,'Lojine','Team Odyssey','H114','First Floor','Lent out'),
  @('INV-011','Portable Wi-Fi router','Network',2,'Lojine','','','','With member'),
  @('INV-012','USB-C charger 65W','Accessories',8,'Tasbeeh','','','','With member'),
  @('INV-013','USB-C charger 65W','Accessories',2,'Nour','Team Sirius','C231','Second Floor','Lent out'),
  @('INV-014','Projector','AV',2,'Youssef','','','','With member'),
  @('INV-015','Wireless microphone','AV',4,'Youssef','Judges Panel 2','S015','Ground Floor','Lent out'),
  @('INV-016','Laptop (spare)','Devices',3,'Mohamed Khairy','','','','With member'),
  @('INV-017','Laptop (spare)','Devices',1,'Hana','Team Nebula','C027','Ground Floor','Lent out'),
  @('INV-018','Multimeter','Tools',2,'Karim','','','','With member')
)
$inv | ForEach-Object {
  [pscustomobject][ordered]@{
    'Item ID'=$_[0]; 'Item'=$_[1]; 'Category'=$_[2]; 'Quantity'=$_[3]; 'Held By'=$_[4]
    'Lent To Team'=$_[5]; 'Lent To Room'=$_[6]; 'Lent To Floor'=$_[7]; 'Status'=$_[8]; 'Last Updated'='2026-11-06 11:45'
  }
} | Export-Csv -Path (Join-Path $out 'Inventory.csv') -NoTypeInformation -Encoding UTF8

# --- Reports tab (dummy incoming issues) ---
$rep = @(
  @('RPT-0001','2026-11-06 10:12:00','Second Floor','C227','Internet is lagging','Video call drops every few minutes','Resolved','Lojine','2026-11-06 10:40:00',''),
  @('RPT-0002','2026-11-06 11:05:00','First Floor','H113','Internet is lagging','Very slow for the whole room','In progress','Lojine','',''),
  @('RPT-0003','2026-11-06 11:30:00','First Floor','C139','Electricity / Power problem','No power at the back row outlets','Acknowledged','Karim','',''),
  @('RPT-0004','2026-11-06 11:52:00','Ground Floor','C026','Need TechOps assistance','Projector is not detected by laptop','New','','',''),
  @('RPT-0005','2026-11-06 12:08:00','Second Floor','C259','Internet is lagging','Cannot upload files','New','','',''),
  @('RPT-0006','2026-11-06 12:15:00','First Floor','B128','Other','Need a second monitor for demo','New','','','')
)
$rep | ForEach-Object {
  [pscustomobject][ordered]@{
    'Report ID'=$_[0]; 'Timestamp'=$_[1]; 'Floor'=$_[2]; 'Room'=$_[3]; 'Issue Type'=$_[4]; 'Details'=$_[5]
    'Status'=$_[6]; 'Assigned To'=$_[7]; 'Resolved At'=$_[8]; 'Reporter'=$_[9]
  }
} | Export-Csv -Path (Join-Path $out 'Reports.csv') -NoTypeInformation -Encoding UTF8

# --- Meetups tab (dummy meetup requests between team members) ---
$meet = @(
  @('MTG-0001','2026-11-06 11:20:00','Mohamed Khairy','Lojine','First Floor','B133','First Floor','H113','H113','Need to check the access point','On the way'),
  @('MTG-0002','2026-11-06 12:00:00','Omar','Nour','First Floor','B133','Second Floor','C231','B133','Bring spare HDMI cable','Pending')
)
$meet | ForEach-Object {
  [pscustomobject][ordered]@{
    'Request ID'=$_[0]; 'Timestamp'=$_[1]; 'Requested By'=$_[2]; 'Target Member'=$_[3]
    'Requester Floor'=$_[4]; 'Requester Room'=$_[5]; 'Target Floor'=$_[6]; 'Target Room'=$_[7]; 'Meet At'=$_[8]; 'Note'=$_[9]; 'Status'=$_[10]
  }
} | Export-Csv -Path (Join-Path $out 'Meetups.csv') -NoTypeInformation -Encoding UTF8

# Windows PowerShell writes a BOM; Google Sheets import would put it into the first header cell
Get-ChildItem (Join-Path $out '*.csv') | ForEach-Object {
  $t = [IO.File]::ReadAllText($_.FullName)
  [IO.File]::WriteAllText($_.FullName, $t.TrimStart([char]0xFEFF), (New-Object Text.UTF8Encoding($false)))
}

# --- js/sample-data.js : same data bundled for demo mode (used when the sheet cannot be reached) ---
$tabs = [ordered]@{ Rooms='Rooms'; WiFi='WiFi'; Team='Team'; Inventory='Inventory'; Reports='Reports'; Meetups='Meetups' }
$js = "/* Bundled DUMMY data. Mirrors the TechOps Google Sheet. Generated by tools/generate-sample-data.ps1 */`r`nwindow.TECHOPS_SAMPLE = {`r`n"
$parts = foreach ($t in $tabs.Keys) {
  $rows = @(Import-Csv -Path (Join-Path $out "$t.csv") -Encoding UTF8)
  '  "' + $t + '": ' + (ConvertTo-Json -InputObject $rows -Compress)
}
$js += ($parts -join ",`r`n") + "`r`n};`r`n"
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '..\js\sample-data.js'), $js, (New-Object Text.UTF8Encoding($false)))

Write-Host "Generated CSVs in $out"
Get-ChildItem $out | Select-Object Name, Length
