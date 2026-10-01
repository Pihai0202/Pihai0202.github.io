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

export function getVenueTransit(venueId: string): VenueTransitConfig | null {
  return VENUE_TRANSIT_MAP[venueId] || null
}
