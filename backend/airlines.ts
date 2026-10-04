// Selected from the 1 October 2026 daily-departures list; one ICAO operator per row.
// https://www.flightsfrom.com/top-100-airlines
// Prefixes verified against the FAA directory; see README for selection details.
// https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html
// Display-name sources below were checked on 4 October 2026; see README for naming conventions.
export const airlines = [
  // https://www.aa.com/
  { id: 'american-airlines', name: 'American Airlines', prefix: 'AAL' },
  // https://www.united.com/
  { id: 'united-airlines', name: 'United Airlines', prefix: 'UAL' },
  // https://www.delta.com/
  { id: 'delta-air-lines', name: 'Delta Air Lines', prefix: 'DAL' },
  // https://www.southwest.com/
  { id: 'southwest-airlines', name: 'Southwest Airlines', prefix: 'SWA' },
  // https://www.ryanair.com/
  { id: 'ryanair', name: 'Ryanair', prefix: 'RYR' },
  // https://global.ceair.com/global/en_static/en_AboutChinaEasternAirlines/en_intoEasternAirlines/en_chinaeasternInto/
  { id: 'china-eastern-airlines', name: 'China Eastern Airlines', prefix: 'CES' },
  // https://www.goindigo.in/
  { id: 'indigo', name: 'IndiGo', prefix: 'IGO' },
  // https://www.csair.com/en/
  { id: 'china-southern-airlines', name: 'China Southern Airlines', prefix: 'CSN' },
  // https://www.easyjet.com/en/help-centre/policy-terms-and-conditions/terms-and-conditions
  { id: 'easyjet-uk', name: 'easyJet UK', prefix: 'EZY' },
  // https://webresource.airchina.com.cn/en-US/content/about_us/company/
  { id: 'air-china', name: 'Air China', prefix: 'CCA' },
  // https://www.alaskaair.com/
  { id: 'alaska-airlines', name: 'Alaska Airlines', prefix: 'ASA' },
  // https://www.aircanada.com/
  { id: 'air-canada', name: 'Air Canada', prefix: 'ACA' },
  // https://www.turkishairlines.com/
  { id: 'turkish-airlines', name: 'Turkish Airlines', prefix: 'THY' },
  // https://www.latamairlines.com/cl/es
  { id: 'latam-airlines-chile', name: 'LATAM Airlines Chile', prefix: 'LAN' },
  // https://www.lufthansa.com/
  { id: 'lufthansa', name: 'Lufthansa', prefix: 'DLH' },
  // https://www.jal.com/en-jp/
  { id: 'japan-airlines', name: 'Japan Airlines', prefix: 'JAL' },
  // https://www.ana.co.jp/group/en/company/ana/
  { id: 'all-nippon-airways', name: 'All Nippon Airways', prefix: 'ANA' },
  // https://www.qantas.com/
  { id: 'qantas', name: 'Qantas', prefix: 'QFA' },
  // https://www.voeazul.com.br/us/en/home
  { id: 'azul', name: 'Azul', prefix: 'AZU' },
  // https://www.iata.org/en/about/members/airline-list/aeroflot/42/
  { id: 'aeroflot', name: 'Aeroflot', prefix: 'AFL' },
  // https://globalpage.shenzhenair.com/zhair/cms/static/pages/wcm/static-midbookmarks/CompanyOverview/CompanyProfile/CompanyProfile_en?language_id=102
  { id: 'shenzhen-airlines', name: 'Shenzhen Airlines', prefix: 'CSZ' },
  // https://www.britishairways.com/
  { id: 'british-airways', name: 'British Airways', prefix: 'BAW' },
  // https://www.hainanairlines.com/US/US/Home/
  { id: 'hainan-airlines', name: 'Hainan Airlines', prefix: 'CHH' },
  // https://www.klm.com/
  { id: 'klm', name: 'KLM Royal Dutch Airlines', prefix: 'KLM' },
  // https://www.avianca.com/en/about-us/we-are-avianca
  { id: 'avianca-colombia', name: 'Avianca Colombia', prefix: 'AVA' },
  // https://www.jetblue.com/our-company
  { id: 'jetblue-airways', name: 'JetBlue Airways', prefix: 'JBU' },
  // https://www.flypgs.com/en
  { id: 'pegasus-airlines', name: 'Pegasus Airlines', prefix: 'PGT' },
  // https://www.airindia.com/
  { id: 'air-india', name: 'Air India', prefix: 'AIC' },
  // https://www.iberia.com/
  { id: 'iberia', name: 'Iberia', prefix: 'IBE' },
  // https://global.sichuanair.com/
  { id: 'sichuan-airlines', name: 'Sichuan Airlines', prefix: 'CSC' },
  // https://www.sda.cn/en/about/aboutus.html
  { id: 'shandong-airlines', name: 'Shandong Airlines', prefix: 'CDG' },
  // https://en.ch.com/about-spring-airlines
  { id: 'spring-airlines', name: 'Spring Airlines', prefix: 'CQH' },
  // https://www.airfrance.com/
  { id: 'air-france', name: 'Air France', prefix: 'AFR' },
  // https://corporate.wizzair.com/corporate-governance/leadership-team/
  { id: 'wizz-air-hungary', name: 'Wizz Air Hungary', prefix: 'WZZ' },
  // https://www.xiamenair.com/en-ww/
  { id: 'xiamen-airlines', name: 'Xiamen Airlines', prefix: 'CXA' },
  // https://corporate.wizzair.com/corporate-governance/leadership-team/
  { id: 'wizz-air-malta', name: 'Wizz Air Malta', prefix: 'WMT' },
  // https://www.flysas.com/
  { id: 'scandinavian-airlines', name: 'Scandinavian Airlines', prefix: 'SAS' },
  // https://www.vueling.com/en
  { id: 'vueling', name: 'Vueling', prefix: 'VLG' },
  // https://www.volaris.com/
  { id: 'volaris', name: 'Volaris', prefix: 'VOI' },
  // https://www.emirates.com/
  { id: 'emirates', name: 'Emirates', prefix: 'UAE' },
  // https://www.eurowings.com/en.html
  { id: 'eurowings', name: 'Eurowings', prefix: 'EWG' },
  // https://www.ethiopianairlines.com/
  { id: 'ethiopian-airlines', name: 'Ethiopian Airlines', prefix: 'ETH' },
  // https://www.chinaexpressair.com/help/tkt/passengerNotice/2869.html
  { id: 'china-express-airlines', name: 'China Express Airlines', prefix: 'HXA' },
  // https://www.aeromexico.com/
  { id: 'aeromexico', name: 'Aeromexico', prefix: 'AMX' },
  // https://www.qatarairways.com/
  { id: 'qatar-airways', name: 'Qatar Airways', prefix: 'QTR' },
  // https://newsroom.airasia.com/news/airasia-malaysia-ak-secures-second-consecutive-three-year-air-operator-certificate-aoc-approval-from-caam-through-2029
  { id: 'airasia-malaysia', name: 'AirAsia Malaysia', prefix: 'AXM' },
  // https://www.westjet.com/en-ca
  { id: 'westjet', name: 'WestJet', prefix: 'WJA' },
  // https://www.flyfrontier.com/
  { id: 'frontier-airlines', name: 'Frontier Airlines', prefix: 'FFT' },
  // https://www.airindiaexpress.com/
  { id: 'air-india-express', name: 'Air India Express', prefix: 'AXB' },
  // https://www.airnewzealand.com/
  { id: 'air-new-zealand', name: 'Air New Zealand', prefix: 'ANZ' },
  // https://www.jet2.com/
  { id: 'jet2-com', name: 'Jet2.com', prefix: 'EXS' },
  // https://booking-uat.dcloud.saudia.com/en-US/about-us/press-releases/press-release-15012026
  { id: 'saudia', name: 'Saudia', prefix: 'SVA' },
  // https://www.voegol.com.br/en
  { id: 'gol', name: 'GOL', prefix: 'GLO' },
  // https://www.jetstar.com/lk/en/about-us/jetstar-group/jetstar-airways
  { id: 'jetstar-airways', name: 'Jetstar Airways', prefix: 'JST' },
  // https://www.vivaaerobus.com/en-us/info/ex/about-us/viva-aerobus
  { id: 'viva-aerobus', name: 'Viva', prefix: 'VIV' },
  // https://www.copaair.com/en-us/
  { id: 'copa-airlines', name: 'Copa Airlines', prefix: 'CMP' },
  // https://www.koreanair.com/flights/en-kr/
  { id: 'korean-air', name: 'Korean Air', prefix: 'KAL' },
  // https://www.lionair.co.id/
  { id: 'lion-air', name: 'Lion Air', prefix: 'LNI' },
  // https://www.singaporeair.com/
  { id: 'singapore-airlines', name: 'Singapore Airlines', prefix: 'SIA' },
  // https://pss.cdal.com.cn/
  { id: 'chengdu-airlines', name: 'Chengdu Airlines', prefix: 'UEA' },
  // https://ajet.com/en
  { id: 'ajet', name: 'AJet', prefix: 'TKJ' },
  // https://www.wideroe.no/en
  { id: 'wideroe', name: 'Widerøe', prefix: 'WIF' },
  // https://www.austrian.com/
  { id: 'austrian-airlines', name: 'Austrian Airlines', prefix: 'AUA' },
  // https://mediacentre.aerlingus.com/factsheet/about-aer-lingus
  { id: 'aer-lingus', name: 'Aer Lingus', prefix: 'EIN' },
  // https://www.vietnamairlines.com/
  { id: 'vietnam-airlines', name: 'Vietnam Airlines', prefix: 'HVN' },
  // https://www.vietjetair.com/en
  { id: 'vietjet-air', name: 'Vietjet Air', prefix: 'VJC' },
  // https://global.ceair.com/global/en_static/Announcement/TravelTips/dsGeneralCondition/shanghaiAirlinesLuggageRules/shdomesticRules/
  { id: 'shanghai-airlines', name: 'Shanghai Airlines', prefix: 'CSH' },
  // https://www.cathaypacific.com/cx/en_US/about-us.html
  { id: 'cathay-pacific', name: 'Cathay Pacific', prefix: 'CPA' },
  // https://www.swiss.com/
  { id: 'swiss', name: 'SWISS', prefix: 'SWR' },
  // https://corporate.transavia.com/en-EU/legal/privacy/
  { id: 'transavia-france', name: 'Transavia France', prefix: 'TVF' },
  // https://www.iata.org/en/about/members/airline-list/loong-air/533/
  { id: 'loong-air', name: 'Loong Air', prefix: 'CDC' },
  // https://newsroom.airasia.com/about-us
  { id: 'thai-airasia', name: 'Thai AirAsia', prefix: 'AIQ' },
  // https://help.batikair.com/article/contact-center-batik-air-indonesia/733
  { id: 'batik-air-indonesia', name: 'Batik Air Indonesia', prefix: 'BTK' },
  // https://global.juneyaoair.com/
  { id: 'juneyao-airlines', name: 'Juneyao Airlines', prefix: 'DKH' },
  // https://en.aegeanair.com/
  { id: 'aegean-airlines', name: 'Aegean Airlines', prefix: 'AEE' },
  // https://www.etihad.com/
  { id: 'etihad-airways', name: 'Etihad Airways', prefix: 'ETD' },
  // https://www.flydubai.com/
  { id: 'flydubai', name: 'flydubai', prefix: 'FDB' },
  // https://www.tianjin-air.com/dotCms/content/banner/%E5%A4%A9%E6%B4%A5%E8%88%AA%E7%A9%BA%E8%88%AA%E7%8F%AD%E6%97%B6%E5%88%BB%E8%A1%A8%EF%BC%882022.3.27-2022.10.29%EF%BC%89.pdf
  { id: 'tianjin-airlines', name: 'Tianjin Airlines', prefix: 'GCR' },
  // https://www.finnair.com/en
  { id: 'finnair', name: 'Finnair', prefix: 'FIN' },
  // https://www.cebupacificair.com/
  { id: 'cebu-pacific', name: 'Cebu Pacific', prefix: 'CEB' },
  // https://www.virginaustralia.com/
  { id: 'virgin-australia', name: 'Virgin Australia', prefix: 'VOZ' },
  // https://www.flynas.com/en
  { id: 'flynas', name: 'flynas', prefix: 'KNE' },
  // https://www.capeair.com/
  { id: 'cape-air', name: 'Cape Air', prefix: 'KAP' },
  // https://news.s7.ru/
  { id: 's7-airlines', name: 'S7 Airlines', prefix: 'SBI' },
  // https://www.flybreeze.com/
  { id: 'breeze-airways', name: 'Breeze Airways', prefix: 'MXY' },
  // https://www.flyporter.com/en-us/about-porter/who-we-are
  { id: 'porter-airlines', name: 'Porter Airlines', prefix: 'POE' },
  // https://www.sunexpress.com/en-GB
  { id: 'sunexpress', name: 'SunExpress', prefix: 'SXS' },
  // https://www.citilink.co.id/company-profile
  { id: 'citilink', name: 'Citilink', prefix: 'CTV' },
  // https://help.superairjet.com/
  { id: 'super-air-jet', name: 'Super Air Jet', prefix: 'SJV' },
  // https://www.malaysiaairlines.com/
  { id: 'malaysia-airlines', name: 'Malaysia Airlines', prefix: 'MAS' },
  // https://www.philippineairlines.com/ph/en/home.html
  { id: 'philippine-airlines', name: 'Philippine Airlines', prefix: 'PAL' },
  // https://www.flyairlink.com/cape-town-mauritius-route-launch
  { id: 'airlink', name: 'Airlink', prefix: 'LNK' },
  // https://www.bintercanarias.com/es/corporativo
  { id: 'binter-canarias', name: 'Binter Canarias', prefix: 'IBB' },
  // https://www.thaiairways.com/
  { id: 'thai-airways-international', name: 'Thai Airways International', prefix: 'THA' },
  // https://www.norwegian.com/contentassets/28e69335e8a04903bac70d8400810867/norwegian-group-company-list-2026.pdf
  { id: 'norwegian-air-sweden', name: 'Norwegian Air Sweden', prefix: 'NSZ' },
  // https://www.condor.com/
  { id: 'condor', name: 'Condor', prefix: 'CFG' },
  // https://www.garuda-indonesia.com/
  { id: 'garuda-indonesia', name: 'Garuda Indonesia', prefix: 'GIA' },
  // https://intl.jdair.net/news/index?id=43&valueMenuaid=58
  { id: 'beijing-capital-airlines', name: 'Beijing Capital Airlines', prefix: 'CBJ' },
  // https://www.airarabia.com/
  { id: 'air-arabia', name: 'Air Arabia', prefix: 'ABY' },
  // https://www.jejuair.net/en/about/corp/page.do
  { id: 'jeju-air', name: 'Jeju Air', prefix: 'JJA' },
];
