/**
 * Demo: yo‘nalishga mos taksi takliflari (keyinchalik API: mashina rasmi, model, haydovchi tavsifi).
 * Yo‘lovchilar ro‘yxati yo‘q — faqat vaqt va o‘rindiq.
 */

const base = `${import.meta.env.BASE_URL || '/'}`.replace(/\/?$/, '/');

export const DEMO_ROUTE_OFFERS = [
  {
    id: 'offer-norin-olmazor-1',
    orderKind: 'interregional',
    pos: [41.318, 69.248],
    fromRegionName: 'Namangan viloyati',
    fromDistrictName: 'Norin',
    toRegionName: 'Toshkent shahri',
    toDistrictName: 'Olmazor',
    departureTime: 'Bugun 18:30',
    seatsTotal: 4,
    seatsFree: 2,
    carModel: 'Chevrolet Nexia 3',
    carPhotoUrl: `${base}demo-offers/nexia.svg`,
    /** Haydovchi yozgan qisqa tavsif (marker/popupda) */
    description:
      'Konditsioner bor, yukxonada joy bor. Toshkentga muntazman boraman, yo‘l uchun telefon qiling.',
  },
  {
    id: 'offer-norin-olmazor-2',
    orderKind: 'interregional',
    pos: [41.305, 69.232],
    fromRegionName: 'Namangan viloyati',
    fromDistrictName: 'Norin',
    toRegionName: 'Toshkent shahri',
    toDistrictName: 'Olmazor',
    departureTime: 'Ertaga 07:00',
    seatsTotal: 3,
    seatsFree: 3,
    carModel: 'Damas',
    carPhotoUrl: `${base}demo-offers/damas.svg`,
    description: 'Erta yo‘lga chiqaman. Kichik yuk va sumkalar bepul. To‘xtab turishlar kelishiladi.',
  },
  {
    id: 'offer-chorsu-yunusobod',
    orderKind: 'local',
    pos: [41.328, 69.225],
    departureTime: 'Srochno (20 daqiqa)',
    seatsTotal: 4,
    seatsFree: 1,
    carModel: 'Chevrolet Cobalt',
    carPhotoUrl: `${base}demo-offers/cobalt.svg`,
    description: 'Shahar ichida tez yetkazib beraman. Kartadan to‘lov mumkin.',
    matchLocalToIncludes: 'yunusobod',
  },
  {
    id: 'offer-mustaqillik-sergeli',
    orderKind: 'local',
    pos: [41.308, 69.27],
    departureTime: 'Bugun 20:15',
    seatsTotal: 3,
    seatsFree: 2,
    carModel: 'Ravon R4',
    carPhotoUrl: `${base}demo-offers/spark.svg`,
    description: 'Sergeli tomonga boraman. Bolalar o‘rindig‘i bor.',
    matchLocalToIncludes: 'sergeli',
  },
];
