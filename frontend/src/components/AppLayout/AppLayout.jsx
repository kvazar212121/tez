import { useLocale } from '../../i18n/LocaleContext';
import BottomOverlay from '../BottomOverlay/BottomOverlay';
import LanguageToggle from '../LanguageToggle/LanguageToggle';
import DriverRouteCompact from '../DriverRouteCompact/DriverRouteCompact';
import ClientOrderModal from '../ClientOrderModal/ClientOrderModal';
import DriverRegistration from '../DriverRegistration/DriverRegistration';
import MapSection from '../MapSection/MapSection';
import PermissionScreen from '../PermissionScreen/PermissionScreen';
import PostRegistrationModal from '../PostRegistrationModal/PostRegistrationModal';
import ProfileButton from '../ProfileButton/ProfileButton';
import ProfileScreen from '../ProfileScreen/ProfileScreen';
import RoleModal from '../RoleModal/RoleModal';
import StatusBadge from '../StatusBadge/StatusBadge';
import ClientOrderCompact from '../ClientOrderCompact/ClientOrderCompact';
import ClientActiveNotice from '../ClientActiveNotice/ClientActiveNotice';
import DriverActiveNotice from '../DriverActiveNotice/DriverActiveNotice';
import { packDriverService } from '../../orderRouteUtils';

/**
 * Asosiy UI: xarita, modallar, pastki panel — holat `useTaxiAppState` dan keladi.
 */
export default function AppLayout({
  status,
  role,
  location,
  hasLocation,
  gpsError,
  profileOpen,
  driverDbId,
  postRegNoticeOpen,
  setPostRegNoticeOpen,
  clientActiveNoticeOpen,
  setClientActiveNoticeOpen,
  driverActiveNoticeOpen,
  setDriverActiveNoticeOpen,
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
  toggleDriverAccepting,
  toggleClientOrderActive,
  telegramUser,
  isTelegram,
}) {
  const { t } = useLocale();

  return (
    <>
      {!hasLocation && <PermissionScreen onRequestGPS={requestGPS} gpsError={gpsError} />}

      {hasLocation && role === 'driver' && !isDriverRegistered && (
        <DriverRegistration
          driverData={driverData}
          onDriverDataChange={setDriverData}
          onSubmit={handleDriverRegSubmit}
          onBack={() => setRole(null)}
        />
      )}

      {hasLocation && !role && <RoleModal onSelectRole={selectRole} />}

      {postRegNoticeOpen && (
        <PostRegistrationModal onDismiss={() => setPostRegNoticeOpen(false)} />
      )}
      
      {clientActiveNoticeOpen && (
        <ClientActiveNotice onDismiss={() => setClientActiveNoticeOpen(false)} />
      )}

      {driverActiveNoticeOpen && (
        <DriverActiveNotice onDismiss={() => setDriverActiveNoticeOpen(false)} />
      )}

      {clientOrderOpen && role === 'client' && (
        <ClientOrderModal
          initialOrder={clientOrder}
          onSave={handleSaveClientOrder}
          onClose={() => setClientOrderOpen(false)}
        />
      )}

      <LanguageToggle />

      {role &&
        (role === 'client' || (role === 'driver' && isDriverRegistered)) &&
        showMainChrome && <ProfileButton role={role} onClick={() => setProfileOpen(true)} />}

      {profileOpen && role && (role === 'client' || (role === 'driver' && isDriverRegistered)) && (
        <ProfileScreen
          role={role}
          driverData={driverData}
          driverDbId={driverDbId}
          telegramUser={telegramUser}
          onClose={closeProfile}
          onLogout={handleLogout}
          onDeleteAccount={role === 'driver' && driverDbId != null ? handleDeleteAccount : null}
          onDriverProfileSync={mergeDriverProfile}
        />
      )}

      <StatusBadge status={status} />

      <MapSection
        location={location}
        hasLocation={hasLocation}
        role={role}
        isDriverRegistered={isDriverRegistered}
        otherUsers={mergedMapUsers}
        myClientOrder={role === 'client' ? clientOrder : undefined}
        myDriverService={
          role === 'driver' && isDriverRegistered ? packDriverService(driverData) : undefined
        }
        routeOffers={routeOffersForMap}
        clientNeedsRoute={false}
      />

      {showMainChrome && (
        <BottomOverlay
          title={overlayTitle}
          subtitle={overlaySubtitle}
          actionLabel={overlayAction}
          driverSlot={
            role === 'driver' && isDriverRegistered ? (
              <DriverRouteCompact
                driverData={driverData}
                onDriverServiceChange={mergeDriverProfile}
                activityOn={driverData.acceptingClients !== false}
                onToggleActivity={toggleDriverAccepting}
              />
            ) : null
          }
          clientSlot={
            role === 'client' && clientRouteReady ? (
              <ClientOrderCompact
                isActive={clientOrder.isActive !== false}
                onToggleActive={toggleClientOrderActive}
              />
            ) : null
          }
          onEditOrder={role === 'client' && clientRouteReady ? () => setClientOrderOpen(true) : undefined}
          editOrderLabel={t('bottom.editOrder')}
          onPrimaryAction={
            role === 'driver'
              ? undefined
              : !clientRouteReady
              ? () => setClientOrderOpen(true)
              : undefined
          }
        />
      )}
    </>
  );
}
