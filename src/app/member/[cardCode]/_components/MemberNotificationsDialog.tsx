"use client";

import { NotificationImage } from "@/components/NotificationImage";
import { NotificationText } from "@/components/NotificationText";
import { SpinnerIcon, XIcon } from "./MemberIcons";

type Props = {
  canUseNotifications: boolean;
  notificationsPanelOpen: boolean;
  setNotificationsPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  loadingNotifications: boolean;
  notifications: {
    id: string;
    type: string;
    title: string;
    body: string;
    imageUrl?: string | null;
    url?: string | null;
    sentAt: string;
    readAt: string | null;
  }[];
  setBirthdayCardOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function MemberNotificationsDialog({
  canUseNotifications,
  notificationsPanelOpen,
  setNotificationsPanelOpen,
  loadingNotifications,
  notifications,
  setBirthdayCardOpen,
}: Props) {
  return (
    <>
      {canUseNotifications && notificationsPanelOpen && (
        <div
          className="pm-overlay"
          onClick={() => setNotificationsPanelOpen(false)}
        >
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pm-close"
              onClick={() => setNotificationsPanelOpen(false)}
            >
              <XIcon size={16} />
            </button>

            <div className="pm-header">
              <div className="pm-title-icon">🔔</div>
              <div>
                <h2 className="pm-title">Известия</h2>
              </div>
            </div>

            <div className="pm-divider" />

            <div className="member-notifications-scroll">
              {loadingNotifications ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <SpinnerIcon size={24} />
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  Няма известия
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={
                        notif.type === "birthday"
                          ? () => {
                              setNotificationsPanelOpen(false);
                              setBirthdayCardOpen(true);
                            }
                          : undefined
                      }
                      style={{
                        background: notif.readAt
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(50,205,50,0.1)",
                        border: notif.readAt
                          ? "1px solid rgba(255,255,255,0.1)"
                          : "1px solid rgba(50,205,50,0.3)",
                        borderRadius: "8px",
                        padding: "12px",
                        cursor:
                          notif.type === "birthday" ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                          marginBottom: "4px",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "14px",
                            fontWeight: "700",
                            color: notif.readAt
                              ? "rgba(255,255,255,0.9)"
                              : "#32cd32",
                          }}
                        >
                          {notif.title}
                        </h3>
                        {!notif.readAt && (
                          <span
                            style={{
                              background: "#ff3b3b",
                              borderRadius: "999px",
                              width: "8px",
                              height: "8px",
                              display: "block",
                              flexShrink: 0,
                              marginTop: "4px",
                            }}
                          />
                        )}
                      </div>
                      {notif.type === "myteam_message" ||
                      notif.type === "admin_message" ? (
                        <span className="member-notification-myteam-badge">
                          MYTEAM7
                        </span>
                      ) : null}
                      <p
                        style={{
                          margin: "4px 0 8px",
                          fontSize: "13px",
                          color: "rgba(255,255,255,0.7)",
                          lineHeight: "1.4",
                        }}
                      >
                        <NotificationText text={notif.body} />
                      </p>
                      <NotificationImage src={notif.imageUrl} />
                      <p
                        style={{
                          margin: 0,
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
