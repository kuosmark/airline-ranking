// Selected from the 1 October 2026 daily-departures list; one ICAO operator per row.
// https://www.flightsfrom.com/top-100-airlines
// Names and prefixes checked against IATA where available; FAA fallback and exceptions in README.
// https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/chap3_section_3.html
// Sources checked on 4 October 2026; see README for display-name conventions.
export const airlines = [
  // https://www.iata.org/en/about/members/airline-list/american-airlines/22/
  { id: 'american-airlines', name: 'American Airlines', prefix: 'AAL' },
  // https://www.iata.org/en/about/members/airline-list/united-airlines/65/
  { id: 'united-airlines', name: 'United Airlines', prefix: 'UAL' },
  // https://www.iata.org/en/about/members/airline-list/delta-air-lines/72/
  { id: 'delta-air-lines', name: 'Delta Air Lines', prefix: 'DAL' },
  // https://www.iata.org/en/about/members/airline-list/southwest-airlines/642/
  { id: 'southwest-airlines', name: 'Southwest Airlines', prefix: 'SWA' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.ryanair.com/
  { id: 'ryanair', name: 'Ryanair', prefix: 'RYR' },
  // IATA: https://www.iata.org/en/about/members/airline-list/china-eastern/58/
  // Display name: https://global.ceair.com/global/en_static/en_AboutChinaEasternAirlines/en_intoEasternAirlines/en_chinaeasternInto/
  { id: 'china-eastern-airlines', name: 'China Eastern Airlines', prefix: 'CES' },
  // https://www.iata.org/en/about/members/airline-list/indigo/545/
  { id: 'indigo', name: 'IndiGo', prefix: 'IGO' },
  // https://www.iata.org/en/about/members/airline-list/china-southern-airlines/54/
  { id: 'china-southern-airlines', name: 'China Southern Airlines', prefix: 'CSN' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.easyjet.com/en/help-centre/policy-terms-and-conditions/terms-and-conditions
  { id: 'easyjet-uk', name: 'easyJet UK', prefix: 'EZY' },
  // https://www.iata.org/en/about/members/airline-list/air-china-/16/
  { id: 'air-china', name: 'Air China', prefix: 'CCA' },
  // https://www.iata.org/en/about/members/airline-list/alaska-airlines/31/
  { id: 'alaska-airlines', name: 'Alaska Airlines', prefix: 'ASA' },
  // https://www.iata.org/en/about/members/airline-list/air-canada/21/
  { id: 'air-canada', name: 'Air Canada', prefix: 'ACA' },
  // https://www.iata.org/en/about/members/airline-list/turkish-airlines/196/
  { id: 'turkish-airlines', name: 'Turkish Airlines', prefix: 'THY' },
  // IATA: https://www.iata.org/en/about/members/airline-list/latam-airlines-group/98/
  // Display name: https://www.latamairlines.com/cl/es
  { id: 'latam-airlines-chile', name: 'LATAM Airlines Chile', prefix: 'LAN' },
  // https://www.iata.org/en/about/members/airline-list/lufthansa/115/
  { id: 'lufthansa', name: 'Lufthansa', prefix: 'DLH' },
  // https://www.iata.org/en/about/members/airline-list/japan-airlines/93/
  { id: 'japan-airlines', name: 'Japan Airlines', prefix: 'JAL' },
  // IATA: https://www.iata.org/en/about/members/airline-list/ana-/37/
  // Display name: https://www.ana.co.jp/group/en/company/ana/
  { id: 'all-nippon-airways', name: 'All Nippon Airways', prefix: 'ANA' },
  // https://www.iata.org/en/about/members/airline-list/qantas/139/
  { id: 'qantas', name: 'Qantas', prefix: 'QFA' },
  // IATA: https://www.iata.org/en/about/members/airline-list/azul-brazilian-airlines/440/
  // Display name: https://www.voeazul.com.br/us/en/home
  { id: 'azul', name: 'Azul', prefix: 'AZU' },
  // https://www.iata.org/en/about/members/airline-list/aeroflot/42/
  { id: 'aeroflot', name: 'Aeroflot', prefix: 'AFL' },
  // https://www.iata.org/en/about/members/airline-list/shenzhen-airlines-/333/
  { id: 'shenzhen-airlines', name: 'Shenzhen Airlines', prefix: 'CSZ' },
  // https://www.iata.org/en/about/members/airline-list/british-airways/52/
  { id: 'british-airways', name: 'British Airways', prefix: 'BAW' },
  // https://www.iata.org/en/about/members/airline-list/hainan-airlines/318/
  { id: 'hainan-airlines', name: 'Hainan Airlines', prefix: 'CHH' },
  // IATA: https://www.iata.org/en/about/members/airline-list/klm/109/
  // Display name: https://www.klm.com/
  { id: 'klm', name: 'KLM Royal Dutch Airlines', prefix: 'KLM' },
  // IATA: https://www.iata.org/en/about/members/airline-list/avianca/6/
  // Display name: https://www.avianca.com/en/about-us/we-are-avianca
  { id: 'avianca-colombia', name: 'Avianca Colombia', prefix: 'AVA' },
  // IATA: https://www.iata.org/en/about/members/airline-list/jetblue/399/
  // Display name: https://www.jetblue.com/our-company
  { id: 'jetblue-airways', name: 'JetBlue Airways', prefix: 'JBU' },
  // https://www.iata.org/en/about/members/airline-list/pegasus-airlines/378/
  { id: 'pegasus-airlines', name: 'Pegasus Airlines', prefix: 'PGT' },
  // https://www.iata.org/en/about/members/airline-list/air-india-/61/
  { id: 'air-india', name: 'Air India', prefix: 'AIC' },
  // IATA: https://www.iata.org/en/about/members/airline-list/iberia/412/
  // Display name: https://www.iberia.com/
  { id: 'iberia', name: 'Iberia', prefix: 'IBE' },
  // https://www.iata.org/en/about/members/airline-list/sichuan-airlines-/374/
  { id: 'sichuan-airlines', name: 'Sichuan Airlines', prefix: 'CSC' },
  // https://www.iata.org/en/about/members/airline-list/shandong-airlines-/335/
  { id: 'shandong-airlines', name: 'Shandong Airlines', prefix: 'CDG' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://en.ch.com/about-spring-airlines
  { id: 'spring-airlines', name: 'Spring Airlines', prefix: 'CQH' },
  // https://www.iata.org/en/about/members/airline-list/air-france/7/
  { id: 'air-france', name: 'Air France', prefix: 'AFR' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://corporate.wizzair.com/corporate-governance/leadership-team/
  { id: 'wizz-air-hungary', name: 'Wizz Air Hungary', prefix: 'WZZ' },
  // https://www.iata.org/en/about/members/airline-list/xiamen-airlines/147/
  { id: 'xiamen-airlines', name: 'Xiamen Airlines', prefix: 'CXA' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://corporate.wizzair.com/corporate-governance/leadership-team/
  { id: 'wizz-air-malta', name: 'Wizz Air Malta', prefix: 'WMT' },
  // IATA: https://www.iata.org/en/about/members/airline-list/sas/171/
  // Display name: https://www.flysas.com/
  { id: 'scandinavian-airlines', name: 'Scandinavian Airlines', prefix: 'SAS' },
  // https://www.iata.org/en/about/members/airline-list/vueling/466/
  { id: 'vueling', name: 'Vueling', prefix: 'VLG' },
  // https://www.iata.org/en/about/members/airline-list/volaris/397/
  { id: 'volaris', name: 'Volaris', prefix: 'VOI' },
  // https://www.iata.org/en/about/members/airline-list/emirates/73/
  { id: 'emirates', name: 'Emirates', prefix: 'UAE' },
  // https://www.iata.org/en/about/members/airline-list/eurowings/87/
  { id: 'eurowings', name: 'Eurowings', prefix: 'EWG' },
  // https://www.iata.org/en/about/members/airline-list/ethiopian-airlines/83/
  { id: 'ethiopian-airlines', name: 'Ethiopian Airlines', prefix: 'ETH' },
  // https://www.iata.org/en/about/members/airline-list/china-express-airlines/480/
  { id: 'china-express-airlines', name: 'China Express Airlines', prefix: 'HXA' },
  // https://www.iata.org/en/about/members/airline-list/aeromexico/9/
  { id: 'aeromexico', name: 'Aeromexico', prefix: 'AMX' },
  // https://www.iata.org/en/about/members/airline-list/qatar-airways/277/
  { id: 'qatar-airways', name: 'Qatar Airways', prefix: 'QTR' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://newsroom.airasia.com/news/airasia-malaysia-ak-secures-second-consecutive-three-year-air-operator-certificate-aoc-approval-from-caam-through-2029
  { id: 'airasia-malaysia', name: 'AirAsia Malaysia', prefix: 'AXM' },
  // https://www.iata.org/en/about/members/airline-list/westjet/473/
  { id: 'westjet', name: 'WestJet', prefix: 'WJA' },
  // https://www.iata.org/en/about/members/airline-list/frontier-airlines/676/
  { id: 'frontier-airlines', name: 'Frontier Airlines', prefix: 'FFT' },
  // https://www.iata.org/en/about/members/airline-list/air-india-express/655/
  { id: 'air-india-express', name: 'Air India Express', prefix: 'AXB' },
  // https://www.iata.org/en/about/members/airline-list/air-new-zealand/24/
  { id: 'air-new-zealand', name: 'Air New Zealand', prefix: 'ANZ' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.jet2.com/
  { id: 'jet2-com', name: 'Jet2.com', prefix: 'EXS' },
  // IATA: https://www.iata.org/en/about/members/airline-list/saudi-arabian-airlines/174/
  // Display name: Saudia-issued release: https://rss.globenewswire.com/news-release/2026/01/08/3215556/0/en/Saudia-Continues-to-Support-Saudi-Arabia-s-Expanding-Global-Events-Calendar-in-2026.html
  { id: 'saudia', name: 'Saudia', prefix: 'SVA' },
  // IATA: https://www.iata.org/en/about/members/airline-list/gol-linhas-aereas/406/
  // Display name: https://www.voegol.com.br/en
  { id: 'gol', name: 'GOL', prefix: 'GLO' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.jetstar.com/lk/en/about-us/jetstar-group/jetstar-airways
  { id: 'jetstar-airways', name: 'Jetstar Airways', prefix: 'JST' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.vivaaerobus.com/en-us/info/ex/about-us/viva-aerobus
  { id: 'viva-aerobus', name: 'Viva', prefix: 'VIV' },
  // IATA: https://www.iata.org/en/about/members/airline-list/copa-airlines/70/
  // Display name: https://www.copaair.com/en-us/
  { id: 'copa-airlines', name: 'Copa Airlines', prefix: 'CMP' },
  // https://www.iata.org/en/about/members/airline-list/korean-air/96/
  { id: 'korean-air', name: 'Korean Air', prefix: 'KAL' },
  // https://www.iata.org/en/about/members/airline-list/lion-air/651/
  { id: 'lion-air', name: 'Lion Air', prefix: 'LNI' },
  // https://www.iata.org/en/about/members/airline-list/singapore-airlines/177/
  { id: 'singapore-airlines', name: 'Singapore Airlines', prefix: 'SIA' },
  // https://www.iata.org/en/about/members/airline-list/chengdu-airlines/675/
  { id: 'chengdu-airlines', name: 'Chengdu Airlines', prefix: 'UEA' },
  // https://www.iata.org/en/about/members/airline-list/ajet/663/
  { id: 'ajet', name: 'AJet', prefix: 'TKJ' },
  // IATA: https://www.iata.org/en/about/members/airline-list/wideroe/233/
  // Display name: https://www.wideroe.no/en
  { id: 'wideroe', name: 'Widerøe', prefix: 'WIF' },
  // IATA: https://www.iata.org/en/about/members/airline-list/austrian/60/
  // Display name: https://www.austrian.com/
  { id: 'austrian-airlines', name: 'Austrian Airlines', prefix: 'AUA' },
  // https://www.iata.org/en/about/members/airline-list/aer-lingus/1/
  { id: 'aer-lingus', name: 'Aer Lingus', prefix: 'EIN' },
  // https://www.iata.org/en/about/members/airline-list/vietnam-airlines/375/
  { id: 'vietnam-airlines', name: 'Vietnam Airlines', prefix: 'HVN' },
  // IATA: https://www.iata.org/en/about/members/airline-list/vietjet/486/
  // Display name: https://www.vietjetair.com/en
  { id: 'vietjet-air', name: 'Vietjet Air', prefix: 'VJC' },
  // https://www.iata.org/en/about/members/airline-list/shanghai-airlines/155/
  { id: 'shanghai-airlines', name: 'Shanghai Airlines', prefix: 'CSH' },
  // https://www.iata.org/en/about/members/airline-list/cathay-pacific/64/
  { id: 'cathay-pacific', name: 'Cathay Pacific', prefix: 'CPA' },
  // https://www.iata.org/en/about/members/airline-list/swiss/67/
  { id: 'swiss', name: 'SWISS', prefix: 'SWR' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://corporate.transavia.com/en-EU/legal/privacy/
  { id: 'transavia-france', name: 'Transavia France', prefix: 'TVF' },
  // https://www.iata.org/en/about/members/airline-list/loong-air/533/
  { id: 'loong-air', name: 'Loong Air', prefix: 'CDC' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://newsroom.airasia.com/about-us
  { id: 'thai-airasia', name: 'Thai AirAsia', prefix: 'AIQ' },
  // IATA: https://www.iata.org/en/about/members/airline-list/batik-air/511/
  // Display name: https://help.batikair.com/article/contact-center-batik-air-indonesia/733
  { id: 'batik-air-indonesia', name: 'Batik Air Indonesia', prefix: 'BTK' },
  // https://www.iata.org/en/about/members/airline-list/juneyao-airlines/433/
  { id: 'juneyao-airlines', name: 'Juneyao Airlines', prefix: 'DKH' },
  // https://www.iata.org/en/about/members/airline-list/aegean-airlines/393/
  { id: 'aegean-airlines', name: 'Aegean Airlines', prefix: 'AEE' },
  // https://www.iata.org/en/about/members/airline-list/etihad-airways/292/
  { id: 'etihad-airways', name: 'Etihad Airways', prefix: 'ETD' },
  // https://www.iata.org/en/about/members/airline-list/flydubai/474/
  { id: 'flydubai', name: 'flydubai', prefix: 'FDB' },
  // https://www.iata.org/en/about/members/airline-list/tianjin-airlines/411/
  { id: 'tianjin-airlines', name: 'Tianjin Airlines', prefix: 'GCR' },
  // https://www.iata.org/en/about/members/airline-list/finnair/86/
  { id: 'finnair', name: 'Finnair', prefix: 'FIN' },
  // https://www.iata.org/en/about/members/airline-list/cebu-pacific/540/
  { id: 'cebu-pacific', name: 'Cebu Pacific', prefix: 'CEB' },
  // IATA lists VAU; retain FAA-confirmed VOZ for callsign matching.
  // https://www.iata.org/en/about/members/airline-list/virgin-australia/417/
  // https://www.virginaustralia.com/
  { id: 'virgin-australia', name: 'Virgin Australia', prefix: 'VOZ' },
  // IATA: https://www.iata.org/en/about/members/airline-list/flynas/551/
  // Display name: https://www.flynas.com/en
  { id: 'flynas', name: 'flynas', prefix: 'KNE' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.capeair.com/
  { id: 'cape-air', name: 'Cape Air', prefix: 'KAP' },
  // https://www.iata.org/en/about/members/airline-list/s7-airlines/338/
  { id: 's7-airlines', name: 'S7 Airlines', prefix: 'SBI' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.flybreeze.com/
  { id: 'breeze-airways', name: 'Breeze Airways', prefix: 'MXY' },
  // https://www.iata.org/en/about/members/airline-list/porter-airlines/670/
  { id: 'porter-airlines', name: 'Porter Airlines', prefix: 'POE' },
  // https://www.iata.org/en/about/members/airline-list/sunexpress/407/
  { id: 'sunexpress', name: 'SunExpress', prefix: 'SXS' },
  // https://www.iata.org/en/about/members/airline-list/citilink/658/
  { id: 'citilink', name: 'Citilink', prefix: 'CTV' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://help.superairjet.com/
  { id: 'super-air-jet', name: 'Super Air Jet', prefix: 'SJV' },
  // https://www.iata.org/en/about/members/airline-list/malaysia-airlines/117/
  { id: 'malaysia-airlines', name: 'Malaysia Airlines', prefix: 'MAS' },
  // https://www.iata.org/en/about/members/airline-list/philippine-airlines/122/
  { id: 'philippine-airlines', name: 'Philippine Airlines', prefix: 'PAL' },
  // https://www.iata.org/en/about/members/airline-list/airlink/252/
  { id: 'airlink', name: 'Airlink', prefix: 'LNK' },
  // https://www.iata.org/en/about/members/airline-list/binter-canarias/289/
  { id: 'binter-canarias', name: 'Binter Canarias', prefix: 'IBB' },
  // https://www.iata.org/en/about/members/airline-list/thai-airways-international/182/
  { id: 'thai-airways-international', name: 'Thai Airways International', prefix: 'THA' },
  // Not found in IATA member directory; ICAO prefix verified against FAA.
  // https://www.norwegian.com/contentassets/28e69335e8a04903bac70d8400810867/norwegian-group-company-list-2026.pdf
  { id: 'norwegian-air-sweden', name: 'Norwegian Air Sweden', prefix: 'NSZ' },
  // https://www.iata.org/en/about/members/airline-list/condor/392/
  { id: 'condor', name: 'Condor', prefix: 'CFG' },
  // https://www.iata.org/en/about/members/airline-list/garuda-indonesia/77/
  { id: 'garuda-indonesia', name: 'Garuda Indonesia', prefix: 'GIA' },
  // IATA: https://www.iata.org/en/about/members/airline-list/capital-airlines/477/
  // Display name: https://intl.jdair.net/news/index?id=43&valueMenuaid=58
  { id: 'beijing-capital-airlines', name: 'Beijing Capital Airlines', prefix: 'CBJ' },
  // https://www.iata.org/en/about/members/airline-list/air-arabia/429/
  { id: 'air-arabia', name: 'Air Arabia', prefix: 'ABY' },
  // https://www.iata.org/en/about/members/airline-list/jeju-air/531/
  { id: 'jeju-air', name: 'Jeju Air', prefix: 'JJA' },
];
