export interface VenueTransitConfig {
  county: string
  countyNameZh: string
  busRoutes: string[]
  metro?: {
    operator: string
    operatorNameZh: string
    stationId: string
    stationName: string
  }
  tra?: {
    stationId: string
    stationName: string
  }
  thsr?: {
    stationName: string
  }
}

export const VENUE_TRANSIT_MAP: Record<string, VenueTransitConfig> = {
  'taipei-dome': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['299', '忠孝幹線', '204', '212', '仁愛幹線'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL17', stationName: '國父紀念館' },
    tra: { stationId: '0990', stationName: '松山' },
    thsr: { stationName: '台北' }
  },
  'taipei-arena': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['307', '南京幹線', '288', '承德幹線'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G19', stationName: '台北小巨蛋' },
    tra: { stationId: '0990', stationName: '松山' },
    thsr: { stationName: '台北' }
  },
  'nangang': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['620', '市民小巴15', '內湖幹線', '藍51'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL23', stationName: '南港展覽館' },
    tra: { stationId: '0980', stationName: '南港' },
    thsr: { stationName: '南港' }
  },
  'taipei-music-center': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['212', '270', '藍25', '市民小巴15'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL22', stationName: '昆陽' },
    tra: { stationId: '0980', stationName: '南港' },
    thsr: { stationName: '南港' }
  },
  'zepp-new-taipei': {
    county: 'NewTaipei',
    countyNameZh: '新北市',
    busRoutes: ['652', '835', '960', '859'],
    metro: { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A4', stationName: '新莊副都心' },
    tra: { stationId: '1020', stationName: '板橋' },
    thsr: { stationName: '板橋' }
  },
  'legacy-taipei': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['忠孝幹線', '205', '299', '212', '262'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL14', stationName: '忠孝新生' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'the-wall': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['208', '1', '251', '252', '644'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G07', stationName: '公館' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'taoyuan-arena': {
    county: 'Taoyuan',
    countyNameZh: '桃園市',
    busRoutes: ['171', '172', '173', '高鐵快捷公車'],
    metro: { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A19', stationName: '體育園區' },
    tra: { stationId: '1100', stationName: '中壢' },
    thsr: { stationName: '桃園' }
  },
  'hsinchu': {
    county: 'Hsinchu',
    countyNameZh: '新竹市',
    busRoutes: ['50', '51', '藍線'],
    tra: { stationId: '1210', stationName: '新竹' },
    thsr: { stationName: '新竹' }
  },
  'taichung-dome': {
    county: 'Taichung',
    countyNameZh: '台中市',
    busRoutes: ['12', '58', '71', '127', '崇德幹線'],
    metro: { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '106', stationName: '文心中清' },
    tra: { stationId: '3300', stationName: '台中' },
    thsr: { stationName: '台中' }
  },
  'taichung-venue': {
    county: 'Taichung',
    countyNameZh: '台中市',
    busRoutes: ['300', '60', '69', '75', '307'],
    metro: { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '110', stationName: '市政府' },
    tra: { stationId: '3300', stationName: '台中' },
    thsr: { stationName: '台中' }
  },
  'legacy-taichung': {
    county: 'Taichung',
    countyNameZh: '台中市',
    busRoutes: ['300', '301', '307', '308', '48'],
    metro: { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '110', stationName: '市政府' },
    tra: { stationId: '3300', stationName: '台中' },
    thsr: { stationName: '台中' }
  },
  'changhua': {
    county: 'ChanghuaCounty',
    countyNameZh: '彰化縣',
    busRoutes: ['1', '2', '6912'],
    tra: { stationId: '3360', stationName: '彰化' },
    thsr: { stationName: '彰化' }
  },
  'tainan': {
    county: 'Tainan',
    countyNameZh: '台南市',
    busRoutes: ['2', '5', '0左', '0右', '88'],
    tra: { stationId: '4220', stationName: '台南' },
    thsr: { stationName: '台南' }
  },
  'kaohsiung-dome': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['168環西', '301', '紅36', '24'],
    metro: { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R14', stationName: '巨蛋' },
    tra: { stationId: '4340', stationName: '新左營' },
    thsr: { stationName: '左營' }
  },
  'kaohsiung-natl': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['29', '218', '紅53'],
    metro: { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R17', stationName: '世運' },
    tra: { stationId: '4340', stationName: '新左營' },
    thsr: { stationName: '左營' }
  },
  'kaohsiung-music-center': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['0南', '11', '25', '33', '50五福幹線'],
    metro: { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C11', stationName: '真愛碼頭' },
    tra: { stationId: '4400', stationName: '高雄' },
    thsr: { stationName: '左營' }
  },
  'backstage-live': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['168環東', '83', '11', '100百貨幹線'],
    metro: { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C10', stationName: '光榮碼頭' },
    tra: { stationId: '4400', stationName: '高雄' },
    thsr: { stationName: '左營' }
  },
  'hualien': {
    county: 'HualienCounty',
    countyNameZh: '花蓮縣',
    busRoutes: ['305', '302', '1129'],
    tra: { stationId: '7000', stationName: '花蓮' },
    thsr: { stationName: '台北' }
  },
  'taitung': {
    county: 'TaitungCounty',
    countyNameZh: '台東縣',
    busRoutes: ['8116', '市區觀光循環線'],
    tra: { stationId: '6000', stationName: '台東' },
    thsr: { stationName: '左營' }
  },
  'tianmu': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['紅15', '紅12', '606', '285', '685'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R17', stationName: '芝山' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'xinzhuang': {
    county: 'NewTaipei',
    countyNameZh: '新北市',
    busRoutes: ['299', '99', '805', '藍18'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'O18', stationName: '新莊' },
    tra: { stationId: '1020', stationName: '板橋' },
    thsr: { stationName: '板橋' }
  },
  'asia-pacific-main': {
    county: 'Tainan',
    countyNameZh: '台南市',
    busRoutes: ['18', '市區公車', '和順轉運站專車'],
    tra: { stationId: '4200', stationName: '永康' },
    thsr: { stationName: '台南' }
  },
  'chengcing-lake': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['60', '70', '79', '217', '橘12'],
    metro: { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'O10', stationName: '衛武營' },
    tra: { stationId: '4400', stationName: '高雄' },
    thsr: { stationName: '左營' }
  },
  'douliou': {
    county: 'YunlinCounty',
    countyNameZh: '雲林縣',
    busRoutes: ['701', '市區公車'],
    tra: { stationId: '3470', stationName: '斗六' },
    thsr: { stationName: '雲林' }
  },
  'chiayi': {
    county: 'Chiayi',
    countyNameZh: '嘉義市',
    busRoutes: ['中山幹線', '光林我嘉線', 'BRT 7211'],
    tra: { stationId: '4080', stationName: '嘉義' },
    thsr: { stationName: '嘉義' }
  },
  'ticc': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['信義幹線', '基隆路幹線', '20', '284'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R03', stationName: '台北101/世貿' },
    tra: { stationId: '0990', stationName: '松山' },
    thsr: { stationName: '台北' }
  },
  'legacy-max': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['忠孝幹線', '信義幹線', '669', '藍5'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL18', stationName: '市政府' },
    tra: { stationId: '0990', stationName: '松山' },
    thsr: { stationName: '台北' }
  },
  'ntu-sports-center': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['新生幹線', '松江新生幹線', '208', '0南'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G07', stationName: '公館' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'clapper-studio': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['205', '忠孝幹線', '299', '212', '262'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL14', stationName: '忠孝新生' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'xinzhuang-gym': {
    county: 'NewTaipei',
    countyNameZh: '新北市',
    busRoutes: ['299', '99', '805', '藍18'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'O18', stationName: '新莊' },
    tra: { stationId: '1020', stationName: '板橋' },
    thsr: { stationName: '板橋' }
  },
  'ntpc-exhibition-center': {
    county: 'NewTaipei',
    countyNameZh: '新北市',
    busRoutes: ['橘21', '835', '520', '982'],
    metro: { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A3', stationName: '新北產業園區' },
    tra: { stationId: '1020', stationName: '板橋' },
    thsr: { stationName: '板橋' }
  },
  'ntpc-hall': {
    county: 'NewTaipei',
    countyNameZh: '新北市',
    busRoutes: ['307', '99', '環狀線先導公車', '667'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL07', stationName: '板橋' },
    tra: { stationId: '1020', stationName: '板橋' },
    thsr: { stationName: '板橋' }
  },
  'linkou-arena': {
    county: 'Taoyuan',
    countyNameZh: '桃園市',
    busRoutes: ['967', '坪頂專車', '966'],
    metro: { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A7', stationName: '體育大學' },
    tra: { stationId: '1080', stationName: '桃園' },
    thsr: { stationName: '桃園' }
  },
  'witch-house': {
    county: 'Taipei',
    countyNameZh: '台北市',
    busRoutes: ['新生幹線', '208', '251', '252'],
    metro: { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G07', stationName: '公館' },
    tra: { stationId: '1000', stationName: '台北' },
    thsr: { stationName: '台北' }
  },
  'wild-egret': {
    county: 'Tainan',
    countyNameZh: '台南市',
    busRoutes: ['紅幹線', '綠幹線', '0左', '0右'],
    tra: { stationId: '4220', stationName: '台南' },
    thsr: { stationName: '台南' }
  },
  'tcrc-livehouse': {
    county: 'Tainan',
    countyNameZh: '台南市',
    busRoutes: ['3', '5', '88', '99'],
    tra: { stationId: '4220', stationName: '台南' },
    thsr: { stationName: '台南' }
  },
  'live-warehouse': {
    county: 'Kaohsiung',
    countyNameZh: '高雄市',
    busRoutes: ['50五福幹線', '248', '0南', '0北'],
    metro: { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C12', stationName: '駁二大義' },
    tra: { stationId: '4400', stationName: '高雄' },
    thsr: { stationName: '左營' }
  }
}

// 縣市公車對照表
const CITY_TO_COUNTY: Record<string, { county: string; countyNameZh: string; defaultBus: string[] }> = {
  '台北': { county: 'Taipei', countyNameZh: '台北市', defaultBus: ['忠孝幹線', '南京幹線', '299', '204', '307'] },
  '臺北': { county: 'Taipei', countyNameZh: '台北市', defaultBus: ['忠孝幹線', '南京幹線', '299', '204', '307'] },
  '新北': { county: 'NewTaipei', countyNameZh: '新北市', defaultBus: ['99', '307', '805', '960', '652'] },
  '桃園': { county: 'Taoyuan', countyNameZh: '桃園市', defaultBus: ['1', '101', '171', '172', '高鐵快捷公車'] },
  '台中': { county: 'Taichung', countyNameZh: '台中市', defaultBus: ['300', '301', '12', '58', '71'] },
  '臺中': { county: 'Taichung', countyNameZh: '台中市', defaultBus: ['300', '301', '12', '58', '71'] },
  '台南': { county: 'Tainan', countyNameZh: '台南市', defaultBus: ['2', '5', '0左', '0右', '88', '99'] },
  '臺南': { county: 'Tainan', countyNameZh: '台南市', defaultBus: ['2', '5', '0左', '0右', '88', '99'] },
  '高雄': { county: 'Kaohsiung', countyNameZh: '高雄市', defaultBus: ['168環西', '168環東', '50五福幹線', '100百貨幹線'] },
  '基隆': { county: 'Keelung', countyNameZh: '基隆市', defaultBus: ['101', '201', '501'] },
  '新竹': { county: 'Hsinchu', countyNameZh: '新竹市', defaultBus: ['1', '2', '50', '51', '藍線'] },
  '苗栗': { county: 'MiaoliCounty', countyNameZh: '苗栗縣', defaultBus: ['5801', '5802'] },
  '彰化': { county: 'ChanghuaCounty', countyNameZh: '彰化縣', defaultBus: ['1', '2', '6912'] },
  '南投': { county: 'NantouCounty', countyNameZh: '南投縣', defaultBus: ['6670', '6883'] },
  '雲林': { county: 'YunlinCounty', countyNameZh: '雲林縣', defaultBus: ['7120', '7122'] },
  '嘉義': { county: 'Chiayi', countyNameZh: '嘉義市', defaultBus: ['中山幹線', '忠孝新民幹線', '光林我嘉線'] },
  '屏東': { county: 'PingtungCounty', countyNameZh: '屏東縣', defaultBus: ['505', '506', '8238'] },
  '宜蘭': { county: 'YilanCounty', countyNameZh: '宜蘭縣', defaultBus: ['紅1', '綠12', '1766'] },
  '花蓮': { county: 'HualienCounty', countyNameZh: '花蓮縣', defaultBus: ['301', '302', '303', '1129'] },
  '台東': { county: 'TaitungCounty', countyNameZh: '台東縣', defaultBus: ['市區觀光循環線', '8116'] },
  '臺東': { county: 'TaitungCounty', countyNameZh: '台東縣', defaultBus: ['市區觀光循環線', '8116'] },
}

interface StationItem {
  operator: string
  operatorNameZh: string
  stationId: string
  stationName: string
  lat: number
  lon: number
}

// 台灣主要捷運與輕軌系統車站座標
const METRO_STATIONS_COORDS: StationItem[] = [
  // 台北捷運 (TRTC)
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL17', stationName: '國父紀念館', lat: 25.0413, lon: 121.5578 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL15', stationName: '忠孝復興', lat: 25.0418, lon: 121.5438 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL14', stationName: '忠孝新生', lat: 25.0423, lon: 121.5332 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL12', stationName: '台北車站', lat: 25.0463, lon: 121.5175 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL11', stationName: '西門', lat: 25.0421, lon: 121.5083 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL18', stationName: '市政府', lat: 25.0411, lon: 121.5654 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL22', stationName: '昆陽', lat: 25.0503, lon: 121.5932 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BL23', stationName: '南港展覽館', lat: 25.0553, lon: 121.6174 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G19', stationName: '台北小巨蛋', lat: 25.0518, lon: 121.5501 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G16', stationName: '中山', lat: 25.0528, lon: 121.5204 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'G07', stationName: '公館', lat: 25.0136, lon: 121.5342 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R13', stationName: '台北101/世貿', lat: 25.0332, lon: 121.5641 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R14', stationName: '象山', lat: 25.0329, lon: 121.5714 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R11', stationName: '大安', lat: 25.0329, lon: 121.5435 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R08', stationName: '中正紀念堂', lat: 25.0363, lon: 121.5186 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R16', stationName: '雙連', lat: 25.0578, lon: 121.5207 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R17', stationName: '圓山', lat: 25.0712, lon: 121.5201 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'R20', stationName: '芝山', lat: 25.1031, lon: 121.5226 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'O06', stationName: '頂溪', lat: 25.0136, lon: 121.5152 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'O18', stationName: '新莊', lat: 25.0364, lon: 121.4533 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'Y16', stationName: '板橋', lat: 25.0139, lon: 121.4632 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'Y20', stationName: '新埔民生', lat: 25.0264, lon: 121.4671 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'Y07', stationName: '大坪林', lat: 24.9829, lon: 121.5414 },
  { operator: 'TRTC', operatorNameZh: '台北捷運', stationId: 'BR15', stationName: '劍南路', lat: 25.0849, lon: 121.5558 },
  // 桃園捷運 (TYMC)
  { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A4', stationName: '新莊副都心', lat: 25.0592, lon: 121.4447 },
  { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A7', stationName: '體育大學', lat: 25.0339, lon: 121.3897 },
  { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A18', stationName: '高鐵桃園站', lat: 25.0128, lon: 121.2147 },
  { operator: 'TYMC', operatorNameZh: '桃園捷運', stationId: 'A19', stationName: '桃園體育園區', lat: 25.0016, lon: 121.2008 },
  // 台中捷運 (TMRT)
  { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '106', stationName: '文心中清', lat: 24.1728, lon: 120.6728 },
  { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '110', stationName: '市政府', lat: 24.1611, lon: 120.6472 },
  { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '111', stationName: '水安宮', lat: 24.1539, lon: 120.6492 },
  { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '115', stationName: '大慶', lat: 24.1158, lon: 120.6489 },
  { operator: 'TMRT', operatorNameZh: '台中捷運', stationId: '119', stationName: '高鐵台中站', lat: 24.1119, lon: 120.6158 },
  // 高雄捷運 (KRTC)
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R14', stationName: '巨蛋', lat: 22.6658, lon: 120.3025 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R17', stationName: '世運', lat: 22.6989, lon: 120.3025 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R16', stationName: '左營', lat: 22.6875, lon: 120.3075 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R11', stationName: '高雄車站', lat: 22.6397, lon: 120.3022 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R10', stationName: '美麗島', lat: 22.6314, lon: 120.3019 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'R9', stationName: '中央公園', lat: 22.6247, lon: 120.3011 },
  { operator: 'KRTC', operatorNameZh: '高雄捷運', stationId: 'O1', stationName: '哈瑪星', lat: 22.6219, lon: 120.2758 },
  // 高雄輕軌 (KLRT)
  { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C10', stationName: '光榮碼頭', lat: 22.6178, lon: 120.2922 },
  { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C11', stationName: '真愛碼頭', lat: 22.6206, lon: 120.2872 },
  { operator: 'KLRT', operatorNameZh: '高雄輕軌', stationId: 'C12', stationName: '駁二大義', lat: 22.6194, lon: 120.2831 },
]

// 台灣主要台鐵車站座標
const TRA_STATIONS_COORDS = [
  { stationId: '0900', stationName: '基隆', lat: 25.1328, lon: 121.7397 },
  { stationId: '0960', stationName: '汐止', lat: 25.0678, lon: 121.6628 },
  { stationId: '0980', stationName: '南港', lat: 25.0531, lon: 121.6069 },
  { stationId: '0990', stationName: '松山', lat: 25.0497, lon: 121.5778 },
  { stationId: '1000', stationName: '台北', lat: 25.0478, lon: 121.5172 },
  { stationId: '1010', stationName: '萬華', lat: 25.0336, lon: 121.4994 },
  { stationId: '1020', stationName: '板橋', lat: 25.0136, lon: 121.4628 },
  { stationId: '1040', stationName: '樹林', lat: 24.9911, lon: 121.4244 },
  { stationId: '1070', stationName: '鶯歌', lat: 24.9547, lon: 121.3553 },
  { stationId: '1080', stationName: '桃園', lat: 24.9892, lon: 121.3136 },
  { stationId: '1100', stationName: '中壢', lat: 24.9536, lon: 121.2256 },
  { stationId: '1210', stationName: '新竹', lat: 24.8017, lon: 120.9717 },
  { stationId: '1250', stationName: '竹南', lat: 24.6869, lon: 120.8817 },
  { stationId: '3160', stationName: '苗栗', lat: 24.5700, lon: 120.8236 },
  { stationId: '3230', stationName: '豐原', lat: 24.2542, lon: 120.7231 },
  { stationId: '3300', stationName: '台中', lat: 24.1372, lon: 120.6869 },
  { stationId: '3360', stationName: '彰化', lat: 24.0817, lon: 120.5386 },
  { stationId: '3390', stationName: '員林', lat: 23.9592, lon: 120.5708 },
  { stationId: '3470', stationName: '斗六', lat: 23.7128, lon: 120.5436 },
  { stationId: '4080', stationName: '嘉義', lat: 23.4792, lon: 120.4411 },
  { stationId: '4120', stationName: '新營', lat: 23.3075, lon: 120.3178 },
  { stationId: '4220', stationName: '台南', lat: 22.9972, lon: 120.2128 },
  { stationId: '4310', stationName: '岡山', lat: 22.7933, lon: 120.2975 },
  { stationId: '4340', stationName: '新左營', lat: 22.6872, lon: 120.3069 },
  { stationId: '4400', stationName: '高雄', lat: 22.6397, lon: 120.3022 },
  { stationId: '5000', stationName: '屏東', lat: 22.6689, lon: 120.4858 },
  { stationId: '5050', stationName: '潮州', lat: 22.5503, lon: 120.5375 },
  { stationId: '7190', stationName: '宜蘭', lat: 24.7547, lon: 121.7583 },
  { stationId: '7160', stationName: '羅東', lat: 24.6775, lon: 121.7725 },
  { stationId: '7000', stationName: '花蓮', lat: 23.9933, lon: 121.6014 },
  { stationId: '6000', stationName: '台東', lat: 22.7936, lon: 121.1231 },
]

// 台灣高鐵 12 站座標
const THSR_STATIONS_COORDS = [
  { stationName: '南港', lat: 25.0531, lon: 121.6069 },
  { stationName: '台北', lat: 25.0478, lon: 121.5172 },
  { stationName: '板橋', lat: 25.0136, lon: 121.4628 },
  { stationName: '桃園', lat: 25.0128, lon: 121.2147 },
  { stationName: '新竹', lat: 24.8083, lon: 121.0403 },
  { stationName: '苗栗', lat: 24.6058, lon: 120.8256 },
  { stationName: '台中', lat: 24.1119, lon: 120.6158 },
  { stationName: '彰化', lat: 23.8742, lon: 120.5742 },
  { stationName: '雲林', lat: 23.7347, lon: 120.4172 },
  { stationName: '嘉義', lat: 23.4592, lon: 120.3242 },
  { stationName: '台南', lat: 22.9247, lon: 120.2858 },
  { stationName: '左營', lat: 22.6872, lon: 120.3069 },
]

function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * 111.0
  const dLon = (lon2 - lon1) * 111.0 * Math.cos((lat1 * Math.PI) / 180)
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

/**
 * 取得場館的即時交通動態設定（優先使用預設靜態設定，若無則依場館座標/縣市動態推算最近車站）
 */
export function getVenueTransit(venueOrId: string | { id: string; city?: string; latitude?: number; longitude?: number; [key: string]: any } | null | undefined): VenueTransitConfig | null {
  if (!venueOrId) return null
  const venueId = typeof venueOrId === 'string' ? venueOrId : venueOrId.id

  // 1. 若有靜態預設設定，優先採用
  if (VENUE_TRANSIT_MAP[venueId]) {
    return VENUE_TRANSIT_MAP[venueId]
  }

  // 2. 動態推算
  const venueObj = typeof venueOrId === 'object' ? venueOrId : null
  const rawCity = venueObj?.city || '台北'
  const cityKey = rawCity.replace(/^臺/, '台')
  const countyInfo = CITY_TO_COUNTY[cityKey] || CITY_TO_COUNTY['台北']

  const lat = venueObj?.latitude
  const lon = venueObj?.longitude

  let closestMetro: VenueTransitConfig['metro'] | undefined = undefined
  let closestTra: VenueTransitConfig['tra'] | undefined = undefined
  let closestThsr: VenueTransitConfig['thsr'] | undefined = undefined

  if (typeof lat === 'number' && typeof lon === 'number' && lat > 0 && lon > 0) {
    // 找出 5km 內的最近捷運站
    let minMetroDist = 5.0
    for (const m of METRO_STATIONS_COORDS) {
      const dist = calcDistanceKm(lat, lon, m.lat, m.lon)
      if (dist < minMetroDist) {
        minMetroDist = dist
        closestMetro = {
          operator: m.operator,
          operatorNameZh: m.operatorNameZh,
          stationId: m.stationId,
          stationName: m.stationName,
        }
      }
    }

    // 找出最近台鐵車站
    let minTraDist = 999.0
    for (const tr of TRA_STATIONS_COORDS) {
      const dist = calcDistanceKm(lat, lon, tr.lat, tr.lon)
      if (dist < minTraDist) {
        minTraDist = dist
        closestTra = {
          stationId: tr.stationId,
          stationName: tr.stationName,
        }
      }
    }

    // 找出最近高鐵車站
    let minThsrDist = 999.0
    for (const th of THSR_STATIONS_COORDS) {
      const dist = calcDistanceKm(lat, lon, th.lat, th.lon)
      if (dist < minThsrDist) {
        minThsrDist = dist
        closestThsr = {
          stationName: th.stationName,
        }
      }
    }
  }

  return {
    county: countyInfo.county,
    countyNameZh: countyInfo.countyNameZh,
    busRoutes: countyInfo.defaultBus,
    metro: closestMetro,
    tra: closestTra,
    thsr: closestThsr,
  }
}
