import { useCallback, useEffect, useMemo, useState } from 'react';
import regionsSeed from '@regions';
import { API_BASE_URL } from '../../config';
import { useLocale } from '../../i18n/LocaleContext';
import { buildSyntheticRegionsFromSeed, interregionalFromToText } from '../../orderRouteUtils';
import ButtonPrimary from '../ButtonPrimary/ButtonPrimary';
import './ClientOrderModal.css';

function emptyInterregionalIds() {
  return {
    fromRegionId: '',
    fromDistrictId: '',
    toRegionId: '',
    toDistrictId: '',
  };
}

function deriveInterregionalIds(regions, initialOrder) {
  if (!regions.length || initialOrder?.orderKind !== 'interregional') {
    return emptyInterregionalIds();
  }
  const hasIds =
    initialOrder.fromRegionId != null &&
    initialOrder.fromDistrictId != null &&
    initialOrder.toRegionId != null &&
    initialOrder.toDistrictId != null;
  if (hasIds) {
    return {
      fromRegionId: String(initialOrder.fromRegionId),
      fromDistrictId: String(initialOrder.fromDistrictId),
      toRegionId: String(initialOrder.toRegionId),
      toDistrictId: String(initialOrder.toDistrictId),
    };
  }
  const fr = regions.find((r) => r.name === initialOrder.fromRegionName);
  const tr = regions.find((r) => r.name === initialOrder.toRegionName);
  const fd = fr?.districts?.find((d) => d.name === initialOrder.fromDistrictName);
  const td = tr?.districts?.find((d) => d.name === initialOrder.toDistrictName);
  if (fr && fd && tr && td) {
    return {
      fromRegionId: String(fr.id),
      fromDistrictId: String(fd.id),
      toRegionId: String(tr.id),
      toDistrictId: String(td.id),
    };
  }
  return emptyInterregionalIds();
}

export default function ClientOrderModal({ initialOrder, onSave, onClose }) {
  const { t } = useLocale();
  const [orderKind, setOrderKind] = useState(() =>
    initialOrder?.orderKind === 'local' ? 'local' : 'interregional',
  );
  const [form, setForm] = useState(() => ({
    from: initialOrder?.from ?? '',
    to: initialOrder?.to ?? '',
    when: initialOrder?.when ?? 'Srochno',
    price: initialOrder?.price ?? 'Kelishiladi',
    phone: initialOrder?.phone ?? '',
    telegram: initialOrder?.telegram ?? '',
    passengerCount: Math.min(8, Math.max(1, Number(initialOrder?.passengerCount) || 1)),
    passengerNotes: initialOrder?.passengerNotes ?? '',
  }));
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  /** Foydalanuvchi tanlagan qiymatlar; null bo‘lsa `derivedIrIds` ishlatiladi */
  const [irOverride, setIrOverride] = useState(null);

  const derivedIrIds = useMemo(
    () => deriveInterregionalIds(regions, initialOrder),
    [regions, initialOrder],
  );
  const irIds = irOverride ?? derivedIrIds;

  const patchIrIds = useCallback(
    (patch) => {
      setIrOverride((prev) => ({ ...(prev ?? derivedIrIds), ...patch }));
    },
    [derivedIrIds],
  );

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));

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

  const handleKindChange = (kind) => {
    setOrderKind(kind);
    setIrOverride(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pc = Math.min(8, Math.max(1, Number(form.passengerCount) || 1));
    const base = {
      when: form.when.trim() || t('clientOrder.defaultWhen'),
      price: form.price.trim() || t('clientOrder.defaultPrice'),
      phone: form.phone.trim(),
      telegram: form.telegram.trim(),
      passengerCount: pc,
      passengerNotes: form.passengerNotes.trim(),
      isActive: initialOrder?.isActive !== false,
    };

    if (orderKind === 'local') {
      onSave({
        orderKind: 'local',
        from: form.from.trim() || t('clientOrder.defaultFrom'),
        to: form.to.trim(),
        ...base,
        fromRegionId: null,
        fromDistrictId: null,
        toRegionId: null,
        toDistrictId: null,
        fromRegionName: null,
        fromDistrictName: null,
        toRegionName: null,
        toDistrictName: null,
      });
      return;
    }

    const fr = regions.find((r) => String(r.id) === irIds.fromRegionId);
    const fd = fr?.districts?.find((d) => String(d.id) === irIds.fromDistrictId);
    const tr = regions.find((r) => String(r.id) === irIds.toRegionId);
    const td = tr?.districts?.find((d) => String(d.id) === irIds.toDistrictId);

    if (!fr || !fd || !tr || !td) {
      alert(t('clientOrder.alertIr'));
      return;
    }

    const { from, to } = interregionalFromToText({
      fromRegionName: fr.name,
      fromDistrictName: fd.name,
      toRegionName: tr.name,
      toDistrictName: td.name,
    });

    onSave({
      orderKind: 'interregional',
      from,
      to,
      ...base,
      fromRegionId: fr.id,
      fromDistrictId: fd.id,
      toRegionId: tr.id,
      toDistrictId: td.id,
      fromRegionName: fr.name,
      fromDistrictName: fd.name,
      toRegionName: tr.name,
      toDistrictName: td.name,
    });
  };

  return (
    <div
      className="client-order-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(ev) => ev.key === 'Escape' && onClose()}
    >
      <div className="client-order-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>{t('clientOrder.title')}</h3>

        <div className="client-order-modal__kind" role="group" aria-label={t('clientOrder.kindLabel')}>
          <label className="client-order-modal__kind-option">
            <input
              type="radio"
              name="orderKind"
              checked={orderKind === 'interregional'}
              onChange={() => handleKindChange('interregional')}
            />
            <span>{t('clientOrder.ir')}</span>
          </label>
          <label className="client-order-modal__kind-option">
            <input
              type="radio"
              name="orderKind"
              checked={orderKind === 'local'}
              onChange={() => handleKindChange('local')}
            />
            <span>{t('clientOrder.local')}</span>
          </label>
        </div>

        <p className="client-order-modal__hint">
          {orderKind === 'local' ? t('clientOrder.hintLocal') : t('clientOrder.hintIr')}
        </p>

        <form onSubmit={handleSubmit}>
          {orderKind === 'local' ? (
            <>
              <div className="client-order-modal__field">
                <label htmlFor="co-from">{t('clientOrder.from')}</label>
                <input
                  id="co-from"
                  value={form.from}
                  onChange={set('from')}
                  placeholder={t('clientOrder.fromPh')}
                />
              </div>
              <div className="client-order-modal__field">
                <label htmlFor="co-to">{t('clientOrder.to')}</label>
                <input
                  id="co-to"
                  value={form.to}
                  onChange={set('to')}
                  placeholder={t('clientOrder.toPh')}
                />
              </div>
            </>
          ) : (
            <>
              <div className="client-order-modal__field">
                <label htmlFor="co-ir-from-r">{t('clientOrder.irFromR')}</label>
                <select
                  id="co-ir-from-r"
                  className="client-order-modal__select"
                  value={irIds.fromRegionId}
                  disabled={regionsLoading}
                  onChange={(e) =>
                    patchIrIds({
                      fromRegionId: e.target.value,
                      fromDistrictId: '',
                    })
                  }
                >
                  <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.center})
                    </option>
                  ))}
                </select>
              </div>
              <div className="client-order-modal__field">
                <label htmlFor="co-ir-from-d">{t('clientOrder.irFromD')}</label>
                <select
                  id="co-ir-from-d"
                  className="client-order-modal__select"
                  value={irIds.fromDistrictId}
                  disabled={!fromRegion}
                  onChange={(e) => patchIrIds({ fromDistrictId: e.target.value })}
                >
                  <option value="">{t('clientOrder.pick')}</option>
                  {(fromRegion?.districts ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="client-order-modal__field">
                <label htmlFor="co-ir-to-r">{t('clientOrder.irToR')}</label>
                <select
                  id="co-ir-to-r"
                  className="client-order-modal__select"
                  value={irIds.toRegionId}
                  disabled={regionsLoading}
                  onChange={(e) =>
                    patchIrIds({
                      toRegionId: e.target.value,
                      toDistrictId: '',
                    })
                  }
                >
                  <option value="">{regionsLoading ? t('clientOrder.loading') : t('clientOrder.pick')}</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.center})
                    </option>
                  ))}
                </select>
              </div>
              <div className="client-order-modal__field">
                <label htmlFor="co-ir-to-d">{t('clientOrder.irToD')}</label>
                <select
                  id="co-ir-to-d"
                  className="client-order-modal__select"
                  value={irIds.toDistrictId}
                  disabled={!toRegion}
                  onChange={(e) => patchIrIds({ toDistrictId: e.target.value })}
                >
                  <option value="">{t('clientOrder.pick')}</option>
                  {(toRegion?.districts ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="client-order-modal__field">
            <label htmlFor="co-when">{t('clientOrder.when')}</label>
            <input
              id="co-when"
              value={form.when}
              onChange={set('when')}
              placeholder={t('clientOrder.whenPh')}
            />
          </div>
          <div className="client-order-modal__field">
            <label htmlFor="co-price">{t('clientOrder.price')}</label>
            <input
              id="co-price"
              value={form.price}
              onChange={set('price')}
              placeholder={t('clientOrder.pricePh')}
            />
          </div>
          <div className="client-order-modal__field">
            <label htmlFor="co-phone">{t('clientOrder.phone')}</label>
            <input
              id="co-phone"
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder={t('clientOrder.phonePh')}
            />
          </div>
          <div className="client-order-modal__field">
            <label htmlFor="co-tg">{t('clientOrder.tg')}</label>
            <input id="co-tg" value={form.telegram} onChange={set('telegram')} placeholder="@username" />
          </div>
          <div className="client-order-modal__field">
            <label htmlFor="co-passengers">{t('clientOrder.passengers')}</label>
            <select
              id="co-passengers"
              className="client-order-modal__select"
              value={String(form.passengerCount)}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, passengerCount: Number(e.target.value) || 1 }))
              }
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {t('orderPopup.people', { n })}
                </option>
              ))}
            </select>
          </div>
          <div className="client-order-modal__field">
            <label htmlFor="co-notes">{t('clientOrder.notes')}</label>
            <textarea
              id="co-notes"
              className="client-order-modal__textarea"
              value={form.passengerNotes}
              onChange={set('passengerNotes')}
              rows={3}
              placeholder={t('clientOrder.notesPh')}
            />
          </div>
          <div className="client-order-modal__actions">
            <button type="button" className="client-order-modal__cancel" onClick={onClose}>
              {t('clientOrder.cancel')}
            </button>
            <div className="client-order-modal__submit-wrap">
              <ButtonPrimary type="submit">{t('clientOrder.save')}</ButtonPrimary>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
