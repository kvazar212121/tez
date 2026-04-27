/** shared/regions.json dan API bo‘lmaganda sintetik ro‘yxat */
export function buildSyntheticRegionsFromSeed(raw) {
  return raw.map((r, i) => ({
    id: i + 1,
    name: r.name,
    center: r.center,
    sortOrder: i + 1,
    districts: r.districts.map((d, j) => ({
      id: (i + 1) * 10000 + j + 1,
      name: d,
      sortOrder: j + 1,
    })),
  }));
}

export function interregionalFromToText({ fromRegionName, fromDistrictName, toRegionName, toDistrictName }) {
  return {
    from: `${fromRegionName}, ${fromDistrictName}`,
    to: `${toRegionName}, ${toDistrictName}`,
  };
}

/** Qayerdan tuman majburiy; qayerga viloyat majburiy, tuman ixtiyoriy (bo‘sh bo‘lsa viloyat markazi). */
export function buildDriverInterregionalLabel(fr, fd, tr, td) {
  if (!fr || !fd || !tr) return null;
  const from = `${fr.name}, ${fd.name}`;
  if (td) {
    return `${from} → ${tr.name}, ${td.name}`;
  }
  return `${from} → ${tr.name} (viloyat markazi)`;
}

/** Mijoz yo‘nalishni buyurtmada to‘liq belgilaganmi (xaritada boshqa odamlar / takliflar) */
export function isClientRouteDefined(order) {
  if (!order || typeof order !== 'object') return false;
  if (order.orderKind === 'interregional') {
    return [order.fromRegionName, order.fromDistrictName, order.toRegionName, order.toDistrictName].every(
      (x) => typeof x === 'string' && x.trim().length > 0,
    );
  }
  return Boolean(order.to?.trim());
}

function offerMatchesInterregional(order, offer) {
  return (
    offer.fromRegionName === order.fromRegionName &&
    offer.fromDistrictName === order.fromDistrictName &&
    offer.toRegionName === order.toRegionName &&
    offer.toDistrictName === order.toDistrictName
  );
}

function offerMatchesLocal(order, offer) {
  const to = (order.to || '').trim().toLowerCase();
  if (!to || !offer.matchLocalToIncludes) return false;
  return to.includes(offer.matchLocalToIncludes);
}

/** Yo‘nalishga mos demo takliflar (yo‘lovchilar yo‘q) */
export function isOrderMatchDriver(order, driverService) {
  if (!order || !driverService) return false;
  
  // 1. Agar haydovchi 'city' (mahalliy) bo'lsa, faqat 'local' buyurtmalarni ko'radi
  if (driverService.serviceMode === 'city') {
    return order.orderKind === 'local';
  }

  // 2. Agar haydovchi 'interregional' bo'lsa
  if (driverService.serviceMode === 'interregional') {
    if (order.orderKind !== 'interregional') return false;

    // Viloyatlararo moslik: Qayerdan (Region + District) va Qayerga (Region) mos kelishi shart.
    // ToDistrictId ixtiyoriy (NULL bo'lsa hamma tumanlar tushadi).
    const matchesFrom = 
      Number(order.fromRegionId) === Number(driverService.fromRegionId) &&
      Number(order.fromDistrictId) === Number(driverService.fromDistrictId);
    
    const matchesToRegion = Number(order.toRegionId) === Number(driverService.toRegionId);
    
    // Agar haydovchi aniq tuman tanlagan bo'lsa (toDistrictId), u holda buyurtma ham osha tumanga yoki markazga bo'lishi kerak
    let matchesToDistrict = true;
    if (driverService.toDistrictId) {
      matchesToDistrict = 
        !order.toDistrictId || Number(order.toDistrictId) === Number(driverService.toDistrictId);
    }

    return matchesFrom && matchesToRegion && matchesToDistrict;
  }

  return false;
}

export function filterRouteOffersForOrder(order, offers) {
  if (!isClientRouteDefined(order) || !Array.isArray(offers)) return [];
  if (order.orderKind === 'interregional') {
    return offers.filter((o) => o.orderKind === 'interregional' && offerMatchesInterregional(order, o));
  }
  return offers.filter((o) => o.orderKind === 'local' && offerMatchesLocal(order, o));
}

const timingPayload = (driverData) => ({
  tripDepartureMode: driverData.tripDepartureMode === 'scheduled' ? 'scheduled' : 'asap',
  tripDepartureAt: driverData.tripDepartureAt ?? null,
});

function clampPassengersOnBoard(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return 0;
  return Math.min(8, Math.max(0, Math.round(x)));
}

/** Haydovchi faoliyat yo‘nalishi — socket uchun ixcham obyekt */
export function packDriverService(driverData) {
  if (!driverData || typeof driverData !== 'object') {
    return { serviceMode: 'city', ...timingPayload({}), passengersOnBoard: 0 };
  }
  const t = {
    ...timingPayload(driverData),
    passengersOnBoard: clampPassengersOnBoard(driverData.passengersOnBoard),
  };
  if (driverData.serviceMode !== 'interregional') {
    return { serviceMode: 'city', ...t };
  }
  return {
    serviceMode: 'interregional',
    fromRegionId: driverData.serviceFromRegionId ?? null,
    fromDistrictId: driverData.serviceFromDistrictId ?? null,
    toRegionId: driverData.serviceToRegionId ?? null,
    toDistrictId: driverData.serviceToDistrictId ?? null,
    fromRegionName: driverData.serviceFromRegionName ?? null,
    fromDistrictName: driverData.serviceFromDistrictName ?? null,
    toRegionName: driverData.serviceToRegionName ?? null,
    toDistrictName: driverData.serviceToDistrictName ?? null,
    ...t,
  };
}

/** Ketish vaqtini qisqa matn (UI) */
export function formatDriverTripDeparture(driverData) {
  if (!driverData || driverData.tripDepartureMode !== 'scheduled' || !driverData.tripDepartureAt) {
    return null;
  }
  const raw = String(driverData.tripDepartureAt).trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return d.toLocaleString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return raw;
  }
}
