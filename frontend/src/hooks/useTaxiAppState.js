import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useLocale } from '../i18n/LocaleContext';
import { DEMO_ROUTE_OFFERS } from '../demoRouteOffers';
import { DEMO_CLIENT_MARKERS } from '../demoMijozlar';
import { DEFAULT_CLIENT_ORDER, buildInitialDriverData } from '../appDefaults';
import { filterRouteOffersForOrder, isClientRouteDefined, packDriverService, isOrderMatchDriver } from '../orderRouteUtils';
import { clearPersistedState, loadPersistedState, savePersistedState } from '../persistState';
import { socket } from '../socket';

export function useTaxiAppState() {
  const { t, locale } = useLocale();
  const initial = loadPersistedState();
  
  // Telegram WebApp state
  const [telegramUser, setTelegramUser] = useState(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [startParam, setStartParam] = useState(null);

  const [status, setStatus] = useState('connecting');
  const [role, setRole] = useState(initial?.role ?? null);
  const [location, setLocation] = useState(
    initial?.location?.length === 2 ? initial.location : [41.2995, 69.2401],
  );
  const [hasLocation, setHasLocation] = useState(!!initial?.hasLocation);
  /** `true` — ruxsat yo'q (matn PermissionScreen da `t('gps.denied')` orqali) */
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
  const [clientActiveNoticeOpen, setClientActiveNoticeOpen] = useState(false);
  const [driverActiveNoticeOpen, setDriverActiveNoticeOpen] = useState(false);
  const [dbUsers, setDbUsers] = useState({});

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
      setIsTelegram(true);
      tg.expand();
      
      // Telegram user ma'lumotlarini olish
      const user = tg.initDataUnsafe?.user;
      const param = tg.initDataUnsafe?.start_param;
      if (param) setStartParam(param);

      if (user) {
        setTelegramUser(user);
        
        const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const phoneOrUser = user.username ? `@${user.username}` : '';

        // Agar haydovchi bo'lsa va hali ro'yxatdan o'tmagan bo'lsa
        if (roleRef.current === 'driver' && !isDriverRegisteredRef.current) {
          setDriverData(prev => ({
            ...prev,
            fullName: fullName || prev.fullName,
            phone: phoneOrUser || prev.phone,
          }));
        }

        // Mijoz buyurtmasi uchun kontaktlarni to'ldirish
        setClientOrder(prev => ({
          ...prev,
          telegram: user.username || prev.telegram,
          id_telegram: user.id || prev.id_telegram,
        }));
      }
      
      // Telegram mavzusiga moslashish
      document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
      document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
      document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#3390ec');
      document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
      
      // Back button sozlamalari
      tg.BackButton.onClick(() => {
        if (profileOpen) {
          setProfileOpen(false);
        } else if (clientOrderOpen) {
          setClientOrderOpen(false);
        } else if (postRegNoticeOpen) {
          setPostRegNoticeOpen(false);
        }
      });
      
      // Back button ko'rinishini boshqarish
      if (profileOpen || clientOrderOpen || postRegNoticeOpen) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
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
          lastSeenAt: data.lastSeenAt || new Date().toISOString(),
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
      if (tg) {
        tg.BackButton.offClick();
      }
    };
  }, []);

  // Telegram ID orqali haydovchini avtomatik yuklash
  useEffect(() => {
    if (!telegramUser || !telegramUser.id) return;
    
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/drivers/telegram/${telegramUser.id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        
        if (!cancelled) {
          setIsDriverRegistered(true);
          setDriverDbId(data.id);
          setDriverData(prev => ({
            ...prev,
            fullName: data.fullName || prev.fullName,
            phone: data.phone || prev.phone,
            carModel: data.carModel || prev.carModel,
            carNumber: data.carNumber || prev.carNumber,
            licenseNumber: data.licenseNumber || prev.licenseNumber,
            originPlace: data.originPlace || prev.originPlace,
            avatarUrl: data.avatarUrl || prev.avatarUrl,
            carPhotoUrl: data.carPhotoUrl || prev.carPhotoUrl,
          }));
          // Agar foydalanuvchi hali rol tanlamagan bo'lsa, avtomatik haydovchi qilib qo'yishimiz mumkin
          // yoki shunchaki ma'lumotlarni yuklab qo'yamiz.
        }
      } catch (err) {
        console.error('Fetch driver by TG error:', err);
      }
    })();
    
    return () => { cancelled = true; };
  }, [telegramUser]);

  // Back button holatini yangilash
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      if (profileOpen || clientOrderOpen || postRegNoticeOpen) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    }
  }, [profileOpen, clientOrderOpen, postRegNoticeOpen]);

  // DB dagi aktiv buyurtmalarni vaqti-vaqti bilan olish (Ghost users)
  useEffect(() => {
    if (role !== 'driver' || !isDriverRegistered) return undefined;
    
    const fetchDbUsers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/map/ride-requests`);
        if (!res.ok) return;
        const j = await res.json();
        const users = {};
        j.forEach(req => {
          if (req.pickupLat && req.pickupLng) {
            users[`db_${req.id}`] = {
              pos: [req.pickupLat, req.pickupLng],
              role: 'client',
              lastSeenAt: req.lastSeenAt,
              order: req,
              isDbGhost: true,
            };
          }
        });
        setDbUsers(users);
      } catch (err) {
        console.error('Fetch DB users error:', err);
      }
    };

    fetchDbUsers();
    const id = setInterval(fetchDbUsers, 30000); // 30 soniyada yangilash
    return () => clearInterval(id);
  }, [role, isDriverRegistered]);

  const handleSaveClientOrder = useCallback(async (order) => {
    // 1. Avval natijani kutmasdan local state yangilash (UX uchun)
    setClientOrder(order);
    setClientOrderOpen(false);

    // 2. Serverga buyurtmani saqlash (persistency uchun)
    if (order.isActive !== false) {
      try {
        const [lat, lng] = locationRef.current;
        const res = await fetch(`${API_BASE_URL}/api/ride-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...order,
            fromLabel: order.from,
            toLabel: order.to,
            pickupLat: lat,
            pickupLng: lng
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          // Id ni saqlab qo'yamiz (socket orqali yangilab turish uchun)
          setClientOrder(prev => ({ ...prev, id: saved.id }));
          
          // 3. Socket orqali xabar yuborish
          if (roleRef.current === 'client' && lat != null && lng != null) {
            socket.emit('update_location', {
              lat,
              lng,
              role: 'client',
              rideRequestId: saved.id,
              order: { 
                ...order, 
                id: saved.id,
                from: order.from,
                to: order.to,
                price: order.price,
                when: order.when,
                phone: order.phone,
                telegram: order.telegram
              },
            });
          }
        }
      } catch (err) {
        console.error('Save order error:', err);
      }
    }
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
            const currentOrder = clientOrderRef.current;
            if (currentOrder.isActive !== false) {
              payload.order = {
                ...currentOrder,
                from: currentOrder.from,
                to: currentOrder.to,
                price: currentOrder.price,
                when: currentOrder.when,
                phone: currentOrder.phone,
                telegram: currentOrder.telegram
              };
            } else {
              payload.order = null;
            }
            if (currentOrder.id) payload.rideRequestId = currentOrder.id;
          }
          if (r === 'driver') {
            payload.driverService = packDriverService(driverDataRef.current);
            payload.acceptingClients = driverDataRef.current.acceptingClients !== false;
            if (driverDbId) payload.driverId = driverDbId;
          }
          socket.emit('update_location', payload);
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true },
    );
  }, [driverDbId]);

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
      driverId: driverDbId,
      driverService: packDriverService(driverServiceSlice),
      acceptingClients: driverData.acceptingClients !== false,
    });
    return undefined;
  }, [role, isDriverRegistered, location, driverServiceSlice, driverData.acceptingClients, driverDbId]);

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
    setDriverData((prev) => {
      const nextVal = prev.acceptingClients === false;
      if (nextVal === true) {
        setDriverActiveNoticeOpen(true);
      }
      return { ...prev, acceptingClients: nextVal };
    });
  }, []);

  const selectRole = useCallback((selectedRole) => {
    setRole(selectedRole);
    if (selectedRole === 'client') {
      socket.emit('set_role', 'client');
    }
  }, []);

  const toggleClientOrderActive = useCallback(() => {
    setClientOrder((prev) => {
      const nextActive = prev.isActive === false ? true : false;
      if (nextActive === true) {
        setClientActiveNoticeOpen(true);
      }
      return { ...prev, isActive: nextActive };
    });
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
        body: JSON.stringify({ 
          ...driverData, 
          inviteCode: startParam,
          idTelegram: telegramUser?.id 
        }),
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
          ? `Serverga ulanib bo'lmadi. Backend ishlayotganini va telefonda API manzilini tekshiring (bir Wi‑Fi, firewall).`
          : null) ||
        `Ro'yxatdan o'tishda xatolik`;
      alert(msg);
    }
  }, [driverData, startParam]);

  const closeProfile = useCallback(() => setProfileOpen(false), []);

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
      if (!res.ok) throw new Error(data.message || `O'chirish muvaffaqiyatsiz`);
      handleLogout();
    } catch (err) {
      alert(err.message || 'Xatolik');
    }
  }, [driverDbId, handleLogout, t]);

  const mergedMapUsers = useMemo(() => {
    if (role !== 'driver' || !isDriverRegistered) return {};
    
    const driverService = packDriverService(driverData);
    const filtered = {};
    
    // 1. Haqiqiy online foydalanuvchilar (otherUsers)
    Object.entries(otherUsers).forEach(([id, u]) => {
      if (u.role === 'client' && isOrderMatchDriver(u.order, driverService)) {
        filtered[id] = u;
      }
    });

    // 2. DB dagi e'lonlar (Ghost users) - agar online bo'lmasa qo'shamiz
    Object.entries(dbUsers).forEach(([id, u]) => {
      // Online ro'yxatda bormi (id lari bir xil bo'lsa)
      const isOnline = Object.values(otherUsers).some(onlineU => 
        onlineU.role === 'client' && onlineU.order?.id === u.order?.id
      );
      if (!isOnline && isOrderMatchDriver(u.order, driverService)) {
        filtered[id] = u;
      }
    });

    // 3. Demo mijozlar
    Object.entries(DEMO_CLIENT_MARKERS).forEach(([id, u]) => {
      const isOnline = Object.values(otherUsers).some(onlineU => 
        onlineU.role === 'client' && onlineU.order?.pickupLat === u.pos[0]
      );
      if (!isOnline && isOrderMatchDriver(u.order, driverService)) {
        filtered[id] = u;
      }
    });

    return filtered;
  }, [role, isDriverRegistered, otherUsers, dbUsers, driverData]);

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
    clientActiveNoticeOpen,
    setClientActiveNoticeOpen,
    driverActiveNoticeOpen,
    setDriverActiveNoticeOpen,
    toggleDriverAccepting,
    toggleClientOrderActive,
    telegramUser,
    isTelegram,
  };
}
