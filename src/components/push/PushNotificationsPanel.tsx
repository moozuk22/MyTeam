"use client";

import { IPhonePushGuide } from "./IPhonePushGuide";
import { usePushSubscription } from "./usePushSubscription";

interface PushNotificationsPanelProps {
  cardCode: string;
}

export function PushNotificationsPanel({
  cardCode,
}: PushNotificationsPanelProps) {
  const {
    permission,
    isSupported,
    isSubscribed,
    isBusy,
    statusMessage,
    errorMessage,
    isIPhoneSafari,
    isStandalone,
    handleEnableNotifications,
    handleDisableNotifications,
  } = usePushSubscription(cardCode);
  return (
    <div
      className="card mb-6"
      style={{
        textAlign: "left",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
      }}
    >
      {!isSupported && (
        <div className="alert alert-warning" style={{ marginTop: "8px" }}>
          Този браузър не поддържа push известия. Нужни са HTTPS, Service Worker
          и Push API.
        </div>
      )}

      {isSupported && permission === "default" && (
        <p className="text-secondary" style={{ fontSize: "14px" }}>
          Натиснете бутона, за да разрешите известия за тази карта.
        </p>
      )}

      {isSupported && permission === "denied" && (
        <div className="alert alert-warning" style={{ marginTop: "8px" }}>
          Известията са блокирани. Разрешете ги от настройките на браузъра за
          този сайт.
        </div>
      )}

      {isSupported && permission === "granted" && isSubscribed && (
        <div className="alert alert-success" style={{ marginTop: "8px" }}>
          Известията са активни за това устройство.
        </div>
      )}

      {isIPhoneSafari && !isStandalone && <IPhonePushGuide />}

      {statusMessage && (
        <p
          className="text-secondary"
          style={{ marginTop: "10px", fontSize: "13px" }}
        >
          {statusMessage}
        </p>
      )}

      {errorMessage && (
        <p
          className="text-secondary"
          style={{ marginTop: "10px", fontSize: "13px", color: "var(--error)" }}
        >
          {errorMessage}
        </p>
      )}

      {isSupported && (
        <div
          className="flex items-center justify-center gap-3 mt-4"
          style={{ flexWrap: "wrap" }}
        >
          {!isSubscribed && (
            <>
              <p
                className="text-secondary"
                style={{
                  width: "100%",
                  textAlign: "center",
                  margin: "0 0 8px",
                  fontSize: "13px",
                }}
              >
                Разрешете известията за напомняния за тренировки и информация за
                посещения.
              </p>
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="btn btn-primary"
                disabled={isBusy || permission === "denied" || isSubscribed}
                style={{
                  background:
                    "linear-gradient(135deg, rgb(201, 168, 76), rgb(232, 201, 109), rgb(201, 168, 76))",
                  color: "#000000",
                  border: "2px solid rgb(201, 168, 76)",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "600",
                  borderRadius: "12px",
                  boxShadow:
                    "0 4px 20px rgba(201, 168, 76, 0.4), 0 0 20px rgba(201, 168, 76, 0.2)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  transition: "all 0.3s ease",
                  transform: "scale(1.05)",
                  minWidth: "200px",
                  position: "relative",
                  overflow: "hidden",
                  animation: "ripple 3s ease infinite",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.08)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 30px rgba(201, 168, 76, 0.6), 0 0 30px rgba(201, 168, 76, 0.3)";
                  e.currentTarget.style.animation = "none";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 20px rgba(201, 168, 76, 0.4), 0 0 20px rgba(201, 168, 76, 0.2)";
                  e.currentTarget.style.animation = "ripple 3s ease infinite";
                }}
              >
                {isBusy ? "Please wait..." : "Позволи известия"}
                <style jsx>{`
                  @keyframes ripple {
                    0% {
                      box-shadow:
                        0 0 0 0 rgba(201, 168, 76, 0.7),
                        0 0 0 0 rgba(201, 168, 76, 0.5),
                        0 0 0 0 rgba(201, 168, 76, 0.3),
                        0 4px 20px rgba(201, 168, 76, 0.4);
                    }
                    50% {
                      box-shadow:
                        0 0 0 10px rgba(201, 168, 76, 0),
                        0 0 0 20px rgba(201, 168, 76, 0),
                        0 0 0 30px rgba(201, 168, 76, 0),
                        0 4px 20px rgba(201, 168, 76, 0.4);
                    }
                    100% {
                      box-shadow:
                        0 0 0 0 rgba(201, 168, 76, 0),
                        0 0 0 0 rgba(201, 168, 76, 0),
                        0 0 0 0 rgba(201, 168, 76, 0),
                        0 4px 20px rgba(201, 168, 76, 0.4);
                    }
                  }
                `}</style>
              </button>
            </>
          )}

          {isSubscribed && (
            <button
              type="button"
              onClick={handleDisableNotifications}
              className="btn btn-secondary"
              disabled={isBusy}
            >
              Блокирай известията
            </button>
          )}
        </div>
      )}
    </div>
  );
}
