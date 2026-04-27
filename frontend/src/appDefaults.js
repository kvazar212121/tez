/** Mijoz buyurtmasi va haydovchi boshlang‘ich ma’lumotlari */

export const DEFAULT_CLIENT_ORDER = {
  orderKind: 'interregional',
  from: 'Hozirgi joylashuv',
  to: '',
  when: 'Srochno',
  price: 'Kelishiladi',
  phone: '',
  telegram: '',
  fromRegionId: null,
  fromDistrictId: null,
  toRegionId: null,
  toDistrictId: null,
  fromRegionName: null,
  fromDistrictName: null,
  toRegionName: null,
  toDistrictName: null,
  /** Necha kishi (yo‘lovchi) */
  passengerCount: 1,
  /** Ixtiyoriy: shartlar, izoh («oldinga ketaman» va h.k.) */
  passengerNotes: '',
  /** isActive: false bo‘lsa elon ko‘rinmaydi */
  isActive: true,
};

export function buildInitialDriverData() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  const u = tg?.initDataUnsafe?.user;
  const fullName = u ? `${u.first_name} ${u.last_name || ''}`.trim() : '';
  return {
    phone: '+998',
    carModel: '',
    carNumber: '',
    licenseNumber: '',
    fullName,
    originPlace: '',
    avatarUrl: null,
    carPhotoUrl: null,
    serviceMode: 'interregional',
    serviceFromRegionId: null,
    serviceFromDistrictId: null,
    serviceToRegionId: null,
    serviceToDistrictId: null,
    serviceFromRegionName: null,
    serviceFromDistrictName: null,
    serviceToRegionName: null,
    serviceToDistrictName: null,
    serviceRouteLabel: null,
    /** Ketish: 'asap' — hoziroq; 'scheduled' — ma’lum vaqt */
    tripDepartureMode: 'asap',
    /** datetime-local qiymati (masalan 2026-04-20T14:30) yoki null */
    tripDepartureAt: null,
    /** false bo‘lsa mijozlar xaritada ko‘rmaydi, socket kam yuboriladi */
    acceptingClients: true,
    /** Hozir mashinada nechta yo‘lovchi (0 = bo‘sh) — boshqalar xaritada ko‘rishi mumkin */
    passengersOnBoard: 0,
  };
}
