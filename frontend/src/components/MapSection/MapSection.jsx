import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLocale } from '../../i18n/LocaleContext';
import OrderPopupContent from '../OrderPopupContent/OrderPopupContent';
import RouteOfferPopupContent from '../RouteOfferPopupContent/RouteOfferPopupContent';
import './MapSection.css';

const markerBase = `${import.meta.env.BASE_URL || '/'}`.replace(/\/?$/, '/');

const taxiIcon = L.divIcon({
  html: `
    <div class="taxi-marker-wrap">
      <div class="taxi-marker-star">⭐</div>
      <img src="${markerBase}markers/taxi.svg" class="taxi-marker-svg" />
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 40],
  popupAnchor: [0, -36],
  className: 'taxi-marker-div-icon'
});

/** Mijozlar: kichik odamcha qo‘lni silkitayotgan */
const clientIcon = L.divIcon({
  html: `
    <div class="client-marker-wrap">
      <div class="client-marker-hand">👋</div>
      <img src="${markerBase}markers/person.svg" class="client-marker-svg" />
      <div class="client-marker-glow"></div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 40],
  popupAnchor: [0, -36],
  className: 'client-marker-div-icon'
});

L.Marker.prototype.options.icon = clientIcon;

/** GPS har safar yangilanganda setView chaqirmaymiz — xarita surilganda qayta tortilmaydi. */
function CenterOnUserOnce({ center, hasLocation }) {
  const map = useMap();
  const didCenter = useRef(false);
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    if (!hasLocation) {
      didCenter.current = false;
      return;
    }
    if (didCenter.current) return;
    map.setView(centerRef.current, map.getZoom());
    didCenter.current = true;
  }, [hasLocation, map]);

  return null;
}

/** Qo‘lda o‘z joyiga qaytish (GPS yangilanishi xarita markazini o‘zgartirmaydi). */
function LocateControl({ center, hasLocation, locateLabel }) {
  const map = useMap();
  const centerRef = useRef(center);
  centerRef.current = center;

  useEffect(() => {
    if (!hasLocation) return undefined;
    const Control = L.Control.extend({
      onAdd() {
        const wrap = L.DomUtil.create('div', 'map-locate-control');
        const btn = L.DomUtil.create('button', 'map-locate-btn', wrap);
        btn.type = 'button';
        btn.setAttribute('aria-label', locateLabel);
        btn.title = locateLabel;
        btn.textContent = '📍';
        L.DomEvent.disableClickPropagation(wrap);
        L.DomEvent.on(btn, 'click', (e) => {
          L.DomEvent.stopPropagation(e);
          const c = centerRef.current;
          if (c?.[0] != null && c?.[1] != null) {
            map.setView(c, Math.max(15, map.getZoom()));
          }
        });
        return wrap;
      },
    });
    const ctrl = new Control({ position: 'bottomright' });
    ctrl.addTo(map);
    return () => ctrl.remove();
  }, [map, hasLocation, locateLabel]);

  return null;
}

export default function MapSection({
  location,
  hasLocation,
  role,
  isDriverRegistered,
  otherUsers,
  myClientOrder,
  /** Haydovchi: o‘z marker popup — salonda nechta kishi */
  myDriverService,
  /** Mijoz: yo‘nalish belgilanganidan keyin mos taksi nuqtalari */
  routeOffers = [],
  /** Mijoz: yo‘nalish hali yo‘q — xarita ustida eslatma */
  clientNeedsRoute = false,
}) {
  const { t } = useLocale();
  const userIcon = role === 'driver' && isDriverRegistered ? taxiIcon : clientIcon;

  return (
    <div className="map-container">
      {clientNeedsRoute && (
        <div className="map-container__hint" role="status">
          <p className="map-container__hint-title">{t('map.hintTitle')}</p>
          <p className="map-container__hint-text">{t('map.hintText')}</p>
        </div>
      )}
      <MapContainer center={location} zoom={15} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {hasLocation && (
          <Marker position={location} icon={userIcon}>
            <Popup>
              {role === 'client' && myClientOrder ? (
                <OrderPopupContent id="siz" label={t('map.popup.youClient')} role="client" order={myClientOrder} pos={location} />
              ) : role === 'driver' && isDriverRegistered && myDriverService ? (
                <OrderPopupContent
                  id="siz"
                  label={t('map.popup.youDriver')}
                  role="driver"
                  driverService={myDriverService}
                  pos={location}
                />
              ) : (
                <>{role === 'driver' ? t('map.youLineDriver') : t('map.youLineClient')}</>
              )}
            </Popup>
          </Marker>
        )}
        {Object.entries(otherUsers).map(([id, data]) => {
          const isOffline = data.lastSeenAt && (new Date() - new Date(data.lastSeenAt)) > 60000;
          return (
            <Marker 
              key={id} 
              position={data.pos} 
              icon={data.role === 'driver' ? taxiIcon : clientIcon}
              opacity={isOffline ? 0.6 : 1}
              eventHandlers={{
                click: (e) => {
                  e.target._map.panTo(e.target.getLatLng());
                },
              }}
            >
              <Popup autoPanPadding={[50, 50]}>
                <OrderPopupContent
                  id={id}
                  label={data.label}
                  role={data.role}
                  order={data.order}
                  driverService={data.driverService}
                  pos={data.pos}
                  lastSeenAt={data.lastSeenAt}
                />
              </Popup>
            </Marker>
          );
        })}
        {routeOffers.map((offer) => (
          <Marker key={offer.id} position={offer.pos} icon={taxiIcon}>
            <Popup>
              <RouteOfferPopupContent offer={offer} />
            </Popup>
          </Marker>
        ))}
        <CenterOnUserOnce center={location} hasLocation={hasLocation} />
        <LocateControl center={location} hasLocation={hasLocation} locateLabel={t('map.locate')} />
      </MapContainer>
    </div>
  );
}
