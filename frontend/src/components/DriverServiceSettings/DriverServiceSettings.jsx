import { useCallback, useEffect, useMemo, useState } from 'react';
import regionsSeed from '@regions';
import { API_BASE_URL } from '../../config';
import { useLocale } from '../../i18n/LocaleContext';
import DriverTripTiming from '../DriverTripTiming/DriverTripTiming';
import { buildDriverInterregionalLabel, buildSyntheticRegionsFromSeed } from '../../orderRouteUtils';
import './DriverServiceSettings.css';

function emptyIds() {
  return { fromRegionId: '', fromDistrictId: '', toRegionId: '', toDistrictId: '' };
}

function deriveIds(regions, driverData) {
  if (!regions.length || driverData?.serviceMode !== 'interregional') {
    return emptyIds();
  }
  /** API ID lar bo‘lsa — qisman tanlash ham saqlanadi (faqat viloyat → keyin tuman). */
  const hasNumeric =
    driverData.serviceFromRegionId != null ||
    driverData.serviceFromDistrictId != null ||
    driverData.serviceToRegionId != null ||
    driverData.serviceToDistrictId != null;
  if (hasNumeric) {
    return {
      fromRegionId:
        driverData.serviceFromRegionId != null ? String(driverData.serviceFromRegionId) : '',
      fromDistrictId:
        driverData.serviceFromDistrictId != null ? String(driverData.serviceFromDistrictId) : '',
      toRegionId:
        driverData.serviceToRegionId != null ? String(driverData.serviceToRegionId) : '',
      toDistrictId:
        driverData.serviceToDistrictId != null ? String(driverData.serviceToDistrictId) : '',
    };
  }
  const fr = regions.find((r) => r.name === driverData.serviceFromRegionName);
  const tr = regions.find((r) => r.name === driverData.serviceToRegionName);
  const fd = fr?.districts?.find((d) => d.name === driverData.serviceFromDistrictName);
  const td = tr?.districts?.find((d) => d.name === driverData.serviceToDistrictName);
  if (fr && fd && tr) {
    return {
      fromRegionId: String(fr.id),
      fromDistrictId: String(fd.id),
      toRegionId: String(tr.id),
      toDistrictId: td ? String(td.id) : '',
    };
  }
  return emptyIds();
}

export default function DriverServiceSettings({
  driverData,
  onDriverServiceChange,
  variant = 'full',
  idPrefix = '',
  /** Modal ichida: sarlavha yo‘q, tepada Shahar / Viloyat pill tugmalar */
  embeddedInModal = false,
}) {
  const { t } = useLocale();
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);

  const irIds = useMemo(() => deriveIds(regions, driverData), [regions, driverData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRegionsLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/regions`);
        if (!r.ok) throw new Error('fail');
        const j = await r.json();
        if (!cancelled && Array.isArray(j) && j.length) {
          setRegions(j);
        } else if (!cancelled) {
          setRegions(buildSyntheticRegionsFromSeed(regionsSeed));
        }
      } catch {
        if (!cancelled) setRegions(buildSyntheticRegionsFromSeed(regionsSeed));
      } finally {
        if (!cancelled) setRegionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fromRegion = regions.find((r) => String(r.id) === irIds.fromRegionId);
  const toRegion = regions.find((r) => String(r.id) === irIds.toRegionId);

  const applyInterregionalFromIds = useCallback(
    (ids) => {
      const fr = regions.find((r) => String(r.id) === ids.fromRegionId);
      const fd = fr?.districts?.find((d) => String(d.id) === ids.fromDistrictId);
      const tr = regions.find((r) => String(r.id) === ids.toRegionId);
      const td = tr?.districts?.find((d) => String(d.id) === ids.toDistrictId);
      const patch = {
        serviceMode: 'interregional',
        serviceFromRegionId: fr?.id ?? null,
        serviceFromDistrictId: fd?.id ?? null,
        serviceToRegionId: tr?.id ?? null,
        serviceToDistrictId: td?.id ?? null,
        serviceFromRegionName: fr?.name ?? null,
        serviceFromDistrictName: fd?.name ?? null,
        serviceToRegionName: tr?.name ?? null,
        serviceToDistrictName: td?.name ?? null,
      };
      patch.serviceRouteLabel = buildDriverInterregionalLabel(fr, fd, tr, td);
      onDriverServiceChange(patch);
    },
    [regions, onDriverServiceChange],
  );

  const swapInterregionalRoute = useCallback(() => {
    applyInterregionalFromIds({
      fromRegionId: irIds.toRegionId,
      fromDistrictId: irIds.toDistrictId,
      toRegionId: irIds.fromRegionId,
      toDistrictId: irIds.fromDistrictId,
    });
  }, [irIds, applyInterregionalFromIds]);

  const handleModeChange = (mode) => {
    if (mode === 'city') {
      onDriverServiceChange({
        serviceMode: 'city',
        serviceFromRegionId: null,
        serviceFromDistrictId: null,
        serviceToRegionId: null,
        serviceToDistrictId: null,
        serviceFromRegionName: null,
        serviceFromDistrictName: null,
        serviceToRegionName: null,
        serviceToDistrictName: null,
        serviceRouteLabel: null,
        tripDepartureMode: 'asap',
        tripDepartureAt: null,
      });
      return;
    }
    onDriverServiceChange({ serviceMode: 'interregional' });
  };

  const mode = driverData?.serviceMode === 'interregional' ? 'interregional' : 'city';

  if (variant === 'pickInterregional') {
    return (
      <div className="driver-service driver-service--pick-only">
        <p className="driver-service__hint driver-service__hint--compact">{t('driverService.pickHint')}</p>
        <button
          type="button"
          className="driver-service__swap"
          onClick={swapInterregionalRoute}
          disabled={!irIds.fromRegionId && !irIds.toRegionId}
        >
          {t('driverService.swap')}
        </button>
        <div className="driver-service__field">
          <label htmlFor={`${idPrefix}ds-from-r`}>{t('driverService.fromR')}</label>
          <select
            id={`${idPrefix}ds-from-r`}
            className="driver-service__select"
            value={irIds.fromRegionId}
            disabled={regionsLoading}
            onChange={(e) => {
              const v = e.target.value;
              applyInterregionalFromIds({
                ...irIds,
                fromRegionId: v,
                fromDistrictId: '',
              });
            }}
          >
            <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.center})
              </option>
            ))}
          </select>
        </div>
        <div className="driver-service__field">
          <label htmlFor={`${idPrefix}ds-from-d`}>{t('driverService.fromD')}</label>
          <select
            id={`${idPrefix}ds-from-d`}
            className="driver-service__select"
            value={irIds.fromDistrictId}
            disabled={!fromRegion}
            onChange={(e) => {
              const v = e.target.value;
              applyInterregionalFromIds({
                ...irIds,
                fromDistrictId: v,
              });
            }}
          >
            <option value="">{t('clientOrder.pick')}</option>
            {(fromRegion?.districts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="driver-service__field">
          <label htmlFor={`${idPrefix}ds-to-r`}>{t('driverService.toR')}</label>
          <select
            id={`${idPrefix}ds-to-r`}
            className="driver-service__select"
            value={irIds.toRegionId}
            disabled={regionsLoading}
            onChange={(e) => {
              const v = e.target.value;
              applyInterregionalFromIds({
                ...irIds,
                toRegionId: v,
                toDistrictId: '',
              });
            }}
          >
            <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.center})
              </option>
            ))}
          </select>
        </div>
        <div className="driver-service__field">
          <label htmlFor={`${idPrefix}ds-to-d`}>{t('driverService.toD')}</label>
          <select
            id={`${idPrefix}ds-to-d`}
            className="driver-service__select"
            value={irIds.toDistrictId}
            disabled={!toRegion}
            onChange={(e) => {
              const v = e.target.value;
              applyInterregionalFromIds({
                ...irIds,
                toDistrictId: v,
              });
            }}
          >
            <option value="">{t('driverService.toDEmpty')}</option>
            {(toRegion?.districts ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {driverData?.serviceRouteLabel && (
          <p className="driver-service__summary">{driverData.serviceRouteLabel}</p>
        )}
        <DriverTripTiming driverData={driverData} onDriverServiceChange={onDriverServiceChange} />
      </div>
    );
  }

  return (
    <div className={`driver-service ${embeddedInModal ? 'driver-service--embedded-modal' : ''}`}>
      {!embeddedInModal && (
        <>
          <h3 className="driver-service__title">{t('driverService.title')}</h3>
          <p className="driver-service__intro">{t('driverService.intro')}</p>
        </>
      )}

      <div
        className={`driver-service__kind ${embeddedInModal ? 'driver-service__kind--pills' : ''}`}
        role="group"
        aria-label={t('driverService.modeGroup')}
      >
        {embeddedInModal ? (
          <>
            <button
              type="button"
              className={`driver-service__pill ${mode === 'city' ? 'driver-service__pill--on' : ''}`}
              onClick={() => handleModeChange('city')}
            >
              {t('driverService.cityPill')}
            </button>
            <button
              type="button"
              className={`driver-service__pill ${mode === 'interregional' ? 'driver-service__pill--on' : ''}`}
              onClick={() => handleModeChange('interregional')}
            >
              {t('driverService.irPill')}
            </button>
          </>
        ) : (
          <>
            <label className="driver-service__kind-option">
              <input
                type="radio"
                name="driverServiceMode"
                checked={mode === 'city'}
                onChange={() => handleModeChange('city')}
              />
              <span>{t('driverService.cityRadio')}</span>
            </label>
            <label className="driver-service__kind-option">
              <input
                type="radio"
                name="driverServiceMode"
                checked={mode === 'interregional'}
                onChange={() => handleModeChange('interregional')}
              />
              <span>{t('driverService.irRadio')}</span>
            </label>
          </>
        )}
      </div>

      {mode === 'city' && (
        <>
          <p className="driver-service__hint">{t('driverService.cityHint')}</p>
          <DriverTripTiming driverData={driverData} onDriverServiceChange={onDriverServiceChange} />
        </>
      )}

      {mode === 'interregional' && (
        <>
          <p className="driver-service__hint">{t('driverService.irHint')}</p>
          <button
            type="button"
            className="driver-service__swap"
            onClick={swapInterregionalRoute}
            disabled={!irIds.fromRegionId && !irIds.toRegionId}
          >
            {t('driverService.swap')}
          </button>
          <div className="driver-service__field">
            <label htmlFor={`${idPrefix}ds-from-r`}>{t('driverService.fromR')}</label>
            <select
              id={`${idPrefix}ds-from-r`}
              className="driver-service__select"
              value={irIds.fromRegionId}
              disabled={regionsLoading}
              onChange={(e) => {
                const v = e.target.value;
                applyInterregionalFromIds({
                  ...irIds,
                  fromRegionId: v,
                  fromDistrictId: '',
                });
              }}
            >
              <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.center})
                </option>
              ))}
            </select>
          </div>
          <div className="driver-service__field">
            <label htmlFor={`${idPrefix}ds-from-d`}>{t('driverService.fromD')}</label>
            <select
              id={`${idPrefix}ds-from-d`}
              className="driver-service__select"
              value={irIds.fromDistrictId}
              disabled={!fromRegion}
              onChange={(e) => {
                const v = e.target.value;
                applyInterregionalFromIds({
                  ...irIds,
                  fromDistrictId: v,
                });
              }}
            >
              <option value="">{t('clientOrder.pick')}</option>
              {(fromRegion?.districts ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="driver-service__field">
            <label htmlFor={`${idPrefix}ds-to-r`}>{t('driverService.toR')}</label>
            <select
              id={`${idPrefix}ds-to-r`}
              className="driver-service__select"
              value={irIds.toRegionId}
              disabled={regionsLoading}
              onChange={(e) => {
                const v = e.target.value;
                applyInterregionalFromIds({
                  ...irIds,
                  toRegionId: v,
                  toDistrictId: '',
                });
              }}
            >
              <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.center})
                </option>
              ))}
            </select>
          </div>
          <div className="driver-service__field">
            <label htmlFor={`${idPrefix}ds-to-d`}>{t('driverService.toD')}</label>
            <select
              id={`${idPrefix}ds-to-d`}
              className="driver-service__select"
              value={irIds.toDistrictId}
              disabled={!toRegion}
              onChange={(e) => {
                const v = e.target.value;
                applyInterregionalFromIds({
                  ...irIds,
                  toDistrictId: v,
                });
              }}
            >
              <option value="">{t('driverService.toDEmpty')}</option>
              {(toRegion?.districts ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          {driverData?.serviceRouteLabel && (
            <p className="driver-service__summary">{driverData.serviceRouteLabel}</p>
          )}
          <DriverTripTiming driverData={driverData} onDriverServiceChange={onDriverServiceChange} />
        </>
      )}
    </div>
  );
}
