import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useLocale } from '../i18n/LocaleContext';
import { DEMO_ROUTE_OFFERS } from '../demoRouteOffers';
import { DEMO_CLIENT_MARKERS } from '../demoMijozlar';
import { DEFAULT_CLIENT_ORDER, buildInitialDriverData } from '../appDefaults';
import { filterRouteOffersForOrder, isClientRouteDefined, packDriverService } from '../orderRouteUtils';
import { clearPersistedState, loadPersistedState, savePersistedState } from '../persistState';
import { socket } from '../socket';

export function useTaxiAppState() {
  const { t, locale } = useLocale();
  const initial = loadPersistedState();

  const [status, setStatus] = useState('connecting');
  const [role, setRole] = useState(initial?.role ?? null);
  const [location, setLocation] = useState(
    initial?.location?.length === 2 ? initial.location : [41.2995, 69.2401],
  );
  const [hasLocation, setHasLocation] = useState(!!initial?.hasLocation);
  /** `true` — ruxsat yo‘q (matn PermissionScreen da `t('gps.denied')` orqali) */
  const [gpsError, setGpsError] = useState(false);
  const [otherUsers, setOtherUsers] = useState({});
  const [isDriverRegistered, setIsDriverRegistered] = useState(!!initial?.isDriverRegistered);
  const [profileOpen, setProfileOpen] = useState(false);
  const [driverDbId, setDriverDbId] = useState(initial?.driverDbId ?? null);
  const [postRegNoticeOpen, setPostRegNoticeOpen] = useState(false);
  const [driverData, setDriverData] = useState(() => {
    if (initial?.driverData) {
      return { ...buildInitialDriverData(), ...initial.driverData };
    }
    return buildInitialDriverData();
  });
  const [clientOrder, setClientOrder] = useState(() => ({
    ...DEFAULT_CLIENT_ORDER,
    ...(initial?.clientOrder && typeof initial.clientOrder === 'object' ? initial.clientOrder : {}),
  }));
  const [clientOrderOpen, setClientOrderOpen] = useState(false);

  const roleRef = useRef(role);
  const isDriverRegisteredRef = useRef(isDriverRegistered);
  const locationRef = useRef(location);
  const driverDataRef = useRef(driverData);
  const clientOrderRef = useRef(clientOrder);
  const watchIdRef = useRef(null);

  useEffect(() => {
    roleRef.current = role;
    isDriverRegisteredRef.current = isDriverRegistered;
    locationRef.current = location;
    driverDataRef.current = driverData;
    clientOrderRef.current = clientOrder;
  }, [role, isDriverRegistered, location, driverData, clientOrder]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
    }

    socket.on('connect', () => {
      setStatus('online');
    });

    socket.on('disconnect', () => setStatus('offline'));

    socket.on('user_moved', (data) => {
      setOtherUsers((prev) => ({
        ...prev,
        [data.id]: {
          pos: [data.lat, data.lng],
          role: data.role,
          order: data.order !== undefined ? data.order : prev[data.id]?.order,
          driverService:
            data.driverService !== undefined ? data.driverService : prev[data.id]?.driverService,
          acceptingClients:
            data.acceptingClients !== undefined
              ? data.acceptingClients
              : prev[data.id]?.acceptingClients,
        },
      }));
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('user_moved');
    };
  }, []);

  const startWatchPosition = useCallback(() => {
    if (!navigator.geolocation) return;
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocation([lat, lng]);
        const r = roleRef.current;
        const idr = isDriverRegisteredRef.current;
        if (r && (r === 'client' || (r === 'driver' && idr))) {
          const payload = { lat, lng, role: r };
          if (r === 'client') {
            payload.order = clientOrderRef.current;
          }
          if (r === 'driver') {
            payload.driverService = packDriverService(driverDataRef.current);
            payload.acceptingClients = driverDataRef.current.acceptingClients !== false;
          }
          socket.emit('update_location', payload);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true },
    );
  }, []);

  useEffect(
    () => () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const p = loadPersistedState();
    if (!p?.hasLocation) return undefined;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation([latitude, longitude]);
        setHasLocation(true);
        setGpsError(null);
        startWatchPosition();
      },
      () => {
        clearPersistedState();
        setHasLocation(false);
      },
      { enableHighAccuracy: true },
    );
    return undefined;
  }, [startWatchPosition]);

  const driverServiceSlice = useMemo(
    () => ({
      ...driverData,
    }),
    [driverData],
  );

  useEffect(() => {
    if (role !== 'driver' || !isDriverRegistered) return undefined;
    const [lat, lng] = locationRef.current;
    if (lat == null || lng == null) return undefined;
    socket.emit('update_location', {
      lat,
      lng,
      role: 'driver',
      driverService: packDriverService(driverServiceSlice),
      acceptingClients: driverData.acceptingClients !== false,
    });
    return undefined;
  }, [role, isDriverRegistered, location, driverServiceSlice, driverData.acceptingClients]);

  useEffect(() => {
    savePersistedState({
      hasLocation,
      location: locationRef.current,
      role,
      isDriverRegistered,
      driverDbId,
      driverData: driverDataRef.current,
      clientOrder: clientOrderRef.current,
    });
  }, [hasLocation, role, isDriverRegistered, driverDbId, driverData, clientOrder]);

  useEffect(() => {
    const id = setInterval(() => {
      savePersistedState({
        hasLocation,
        location: locationRef.current,
        role,
        isDriverRegistered,
        driverDbId,
        driverData: driverDataRef.current,
        clientOrder: clientOrderRef.current,
      });
    }, 4000);
    return () => clearInterval(id);
  }, [hasLocation, role, isDriverRegistered, driverDbId, driverData, clientOrder]);

  useEffect(() => {
    if (!profileOpen || role !== 'driver' || !driverDbId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/drivers/${driverDbId}`);
        if (!res.ok || cancelled) return;
        const j = await res.json();
        if (cancelled) return;
        setDriverData((prev) => ({
          ...prev,
          fullName: j.fullName,
          phone: j.phone,
          carModel: j.carModel,
          carNumber: j.carNumber,
          licenseNumber: j.licenseNumber,
          originPlace: j.originPlace || '',
          avatarUrl: j.avatarUrl,
          carPhotoUrl: j.carPhotoUrl,
        }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileOpen, driverDbId, role]);

  const requestGPS = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation([latitude, longitude]);
        setHasLocation(true);
        setGpsError(null);
        startWatchPosition();
      },
      () => {
        setGpsError(true);
      },
      { enableHighAccuracy: true },
    );
  }, [startWatchPosition]);

  const mergeDriverProfile = useCallback((patch) => {
    setDriverData((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleDriverAccepting = useCallback(() => {
    setDriverData((prev) => ({
      ...prev,
      acceptingClients: prev.acceptingClients === false ? true : false,
    }));
  }, []);

  const selectRole = useCallback((selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'client') {
      socket.emit('set_role', 'client');
    }
  }, []);

  const handleDriverRegSubmit = useCallback(async (e) => {
    e.preventDefault();
    const phone = driverData.phone.trim();
    const name = driverData.fullName.trim();
    if (!name && !phone) {
      alert("Demo: kamida ism yoki telefon kiriting.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(driverData),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Server: ${res.status}`);
      }
      if (data.id != null) setDriverDbId(data.id);
      setIsDriverRegistered(true);
      setPostRegNoticeOpen(true);
      socket.emit('set_role', 'driver');
    } catch (err) {
      const msg =
        err?.message ||
        (err?.name === 'TypeError' && String(err?.message || '').includes('fetch')
          ? 'Serverga ulanib bo‘lmadi. Backend ishlayotganini va telefonda API manzilini tekshiring (bir Wi‑Fi, firewall).'
          : null) ||
        'Ro‘yxatdan o‘tishda xatolik';
      alert(msg);
    }
  }, [driverData]);

  const closeProfile = useCallback(() => setProfileOpen(false), []);

  const handleSaveClientOrder = useCallback((order) => {
    setClientOrder(order);
    setClientOrderOpen(false);
    const [lat, lng] = locationRef.current;
    if (roleRef.current === 'client' && lat != null && lng != null) {
      socket.emit('update_location', { lat, lng, role: 'client', order });
    }
  }, []);

  const handleLogout = useCallback(() => {
    setProfileOpen(false);
    setRole(null);
    setIsDriverRegistered(false);
    setDriverDbId(null);
    setPostRegNoticeOpen(false);
    setClientOrderOpen(false);
    setDriverData(buildInitialDriverData());
    setClientOrder({ ...DEFAULT_CLIENT_ORDER });
    clearPersistedState();
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (driverDbId == null) return;
    if (!window.confirm(t('confirm.delete'))) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/drivers/${driverDbId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'O‘chirish muvaffaqiyatsiz');
      handleLogout();
    } catch (err) {
      alert(err.message || 'Xatolik');
    }
  }, [driverDbId, handleLogout, t]);

  const mergedMapUsers =
    role === 'client' ? {} : { ...DEMO_CLIENT_MARKERS, ...otherUsers };

  const clientRouteReady = role === 'client' && isClientRouteDefined(clientOrder);
  const routeOffersForMap = useMemo(() => {
    if (role !== 'client' || !clientRouteReady) return [];
    return filterRouteOffersForOrder(clientOrder, DEMO_ROUTE_OFFERS);
  }, [role, clientOrder, clientRouteReady]);

  const taxiCount = Object.values(otherUsers).filter((u) => u.role === 'driver').length;
  const demoMijozCount = Object.keys(DEMO_CLIENT_MARKERS).length;

  const driverAccepting = driverData.acceptingClients !== false;

  const overlayTitle = useMemo(() => {
    if (role === 'driver') {
      return driverAccepting ? t('overlay.driver.waitTitle') : t('overlay.driver.offTitle');
    }
    if (role === 'client' && !clientRouteReady) return t('overlay.client.routeTitle');
    if (role === 'client') return t('overlay.client.taxisTitle');
    return t('overlay.defaultTitle');
  }, [role, driverAccepting, clientRouteReady, t, locale]);

  const overlaySubtitle = useMemo(() => {
    if (role === 'driver') {
      return driverAccepting
        ? t('overlay.driver.waitSub', { demoCount: demoMijozCount })
        : t('overlay.driver.offSub');
    }
    if (role === 'client' && !clientRouteReady) return t('overlay.client.routeSub');
    if (role === 'client') {
      return routeOffersForMap.length === 0
        ? t('overlay.client.noTaxis')
        : t('overlay.client.taxisSub', { count: routeOffersForMap.length });
    }
    return t('overlay.client.defaultSub', { taxiCount });
  }, [
    role,
    driverAccepting,
    clientRouteReady,
    routeOffersForMap.length,
    taxiCount,
    demoMijozCount,
    t,
    locale,
  ]);

  const overlayAction = useMemo(() => {
    if (role === 'driver') {
      return driverAccepting ? t('overlay.action.driverOff') : t('overlay.action.driverOn');
    }
    return t('overlay.action.clientRoute');
  }, [role, driverAccepting, t, locale]);

  const showMainChrome = !profileOpen && !postRegNoticeOpen && !clientOrderOpen;

  return {
    status,
    role,
    location,
    hasLocation,
    gpsError,
    profileOpen,
    driverDbId,
    postRegNoticeOpen,
    driverData,
    setDriverData,
    clientOrder,
    clientOrderOpen,
    setClientOrderOpen,
    requestGPS,
    mergeDriverProfile,
    selectRole,
    handleDriverRegSubmit,
    closeProfile,
    handleSaveClientOrder,
    handleLogout,
    handleDeleteAccount,
    isDriverRegistered,
    setRole,
    setProfileOpen,
    mergedMapUsers,
    clientRouteReady,
    routeOffersForMap,
    overlayTitle,
    overlaySubtitle,
    overlayAction,
    showMainChrome,
    setPostRegNoticeOpen,
    toggleDriverAccepting,
  };
}
