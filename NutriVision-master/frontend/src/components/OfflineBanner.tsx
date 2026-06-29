import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div role="alert" aria-live="assertive" style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      backgroundColor: "#EF4444",
      color: "#fff",
      padding: "10px 16px",
      textAlign: "center",
      fontSize: 13,
      fontWeight: 500,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}>
      <span aria-hidden="true">📡</span>
      <span>No internet connection — showing cached data</span>
    </div>
  );
}
