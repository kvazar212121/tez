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
        clientNeedsRoute={role === 'client' && !clientRouteReady}
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
          onEditOrder={role === 'client' ? () => setClientOrderOpen(true) : undefined}
          editOrderLabel={t('bottom.editOrder')}
        />
      )}
    </>
  );
}
