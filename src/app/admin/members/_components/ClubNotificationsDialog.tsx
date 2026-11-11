"use client";

import { NotificationImage } from "@/components/NotificationImage";
import { NotificationText } from "@/components/NotificationText";
import { XIcon } from "./members-page-icons";
import { type ClubNotifications } from "../_hooks/useClubNotifications";

type ClubNotificationsDialogProps = {
  clubNotificationsController: Pick<
    ClubNotifications,
    | "clubNotificationsPanelOpen"
    | "setClubNotificationsPanelOpen"
    | "clubNotificationsLoading"
    | "clubNotifications"
    | "clubNotificationsDateFilter"
    | "setClubNotificationsDateFilter"
    | "clubNotificationsScopeType"
    | "setClubNotificationsScopeType"
    | "setClubNotificationsScopeValue"
    | "clubNotificationsScopeValue"
    | "clubNotificationTeamGroups"
    | "clubNotificationTrainingGroups"
    | "filteredClubNotifications"
  >;
  todayIsoDate: string;
};

export function ClubNotificationsDialog({
  clubNotificationsController,
  todayIsoDate,
}: ClubNotificationsDialogProps) {
  const {
    clubNotificationsPanelOpen,
    setClubNotificationsPanelOpen,
    clubNotificationsLoading,
    clubNotifications,
    clubNotificationsDateFilter,
    setClubNotificationsDateFilter,
    clubNotificationsScopeType,
    setClubNotificationsScopeType,
    setClubNotificationsScopeValue,
    clubNotificationsScopeValue,
    clubNotificationTeamGroups,
    clubNotificationTrainingGroups,
    filteredClubNotifications,
  } = clubNotificationsController;
  return (
    <>
      {clubNotificationsPanelOpen ? (
        <div
          className="amp-overlay amp-overlay--member-notifications"
          onClick={() => setClubNotificationsPanelOpen(false)}
        >
          <div className="amp-modal amp-modal--member-notifications" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">
                {
                  "\u0418\u0437\u0432\u0435\u0441\u0442\u0438\u044f \u0437\u0430 \u0442\u0440\u0435\u043d\u044c\u043e\u0440\u0438"
                }
              </span>
              <button
                className="amp-modal-close"
                onClick={() => setClubNotificationsPanelOpen(false)}
                aria-label={"\u0417\u0430\u0442\u0432\u043e\u0440\u0438"}
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              {clubNotificationsLoading ? (
                <p className="amp-empty amp-empty--modal">
                  {"\u0417\u0430\u0440\u0435\u0436\u0434\u0430\u043d\u0435..."}
                </p>
              ) : clubNotifications.length === 0 ? (
                <p className="amp-empty amp-empty--modal">
                  {"\u041d\u044f\u043c\u0430 \u0438\u0437\u0432\u0435\u0441\u0442\u0438\u044f"}
                </p>
              ) : (
                <>
                  <div className="amp-notification-filters">
                    <label className="amp-notification-filter amp-notification-filter--date">
                      <span>{"\u0414\u0430\u0442\u0430"}</span>
                      <div className="amp-notification-date-row">
                        <button
                          type="button"
                          className={`amp-btn amp-btn--ghost amp-notification-date-all-btn${
                            clubNotificationsDateFilter ? "" : " amp-notification-date-all-btn--active"
                          }`}
                          onClick={() => setClubNotificationsDateFilter("")}
                        >
                          {"\u0412\u0441\u0438\u0447\u043a\u0438"}
                        </button>
                        <input
                          type="date"
                          className="amp-edit-input amp-notification-date-input"
                          value={clubNotificationsDateFilter}
                          max={todayIsoDate}
                          onChange={(event) => setClubNotificationsDateFilter(event.target.value)}
                        />
                      </div>
                    </label>
                    <label className="amp-notification-filter">
                      <span>{"\u0424\u0438\u043b\u0442\u044a\u0440 \u043f\u043e"}</span>
                      <select
                        className="amp-edit-input"
                        value={clubNotificationsScopeType}
                        onChange={(event) => {
                          const val = event.target.value;
                          const nextType =
                            val === "trainingGroup" ? "trainingGroup" : val === "admin" ? "admin" : "team";
                          setClubNotificationsScopeType(nextType);
                          setClubNotificationsScopeValue("all");
                        }}
                      >
                        <option value="team">{"\u041e\u0442\u0431\u043e\u0440"}</option>
                        <option value="trainingGroup">
                          {"\u0421\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440"}
                        </option>
                        <option value="admin">{"\u0410\u0434\u043c\u0438\u043d"}</option>
                      </select>
                    </label>
                    {clubNotificationsScopeType !== "admin" && (
                      <label className="amp-notification-filter">
                        <span>
                          {clubNotificationsScopeType === "team"
                            ? "\u0418\u0437\u0431\u0435\u0440\u0438 \u043e\u0442\u0431\u043e\u0440"
                            : "\u0418\u0437\u0431\u0435\u0440\u0438 \u0441\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440"}
                        </span>
                        <select
                          className="amp-edit-input"
                          value={clubNotificationsScopeValue}
                          onChange={(event) => setClubNotificationsScopeValue(event.target.value)}
                        >
                          <option value="all">{"\u0412\u0441\u0438\u0447\u043a\u0438"}</option>
                          {clubNotificationsScopeType === "team"
                            ? clubNotificationTeamGroups.map((group) => (
                                <option key={group} value={String(group)}>
                                  {group}
                                </option>
                              ))
                            : clubNotificationTrainingGroups.map((group) => (
                                <option key={group.id} value={group.id}>
                                  {group.name}
                                </option>
                              ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {filteredClubNotifications.length === 0 ? (
                    <p className="amp-empty amp-empty--modal">
                      {
                        "\u041d\u044f\u043c\u0430 \u0438\u0437\u0432\u0435\u0441\u0442\u0438\u044f \u0437\u0430 \u0438\u0437\u0431\u0440\u0430\u043d\u0438\u0442\u0435 \u0444\u0438\u043b\u0442\u0440\u0438"
                      }
                    </p>
                  ) : (
                    <div className="amp-member-notifications-list">
                      {filteredClubNotifications.map((notif) => (
                        <article
                          key={notif.id}
                          className={`amp-member-notification-item${notif.readAt ? "" : " amp-member-notification-item--unread"}`}
                        >
                          <div className="amp-member-notification-head">
                            <h3>{notif.title}</h3>
                            {!notif.readAt ? (
                              <span
                                className="amp-member-notification-new"
                                aria-label={"\u041d\u043e\u0432\u043e"}
                              />
                            ) : null}
                          </div>
                          {notif.type === "admin_message" || notif.type === "myteam_message" ? (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background: "rgba(201,168,76,0.15)",
                                color: "var(--accent-gold-color)",
                                marginBottom: "6px",
                              }}
                            >
                              {notif.type === "myteam_message"
                                ? "MYTEAM7"
                                : "\u0410\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440"}
                            </span>
                          ) : null}
                          <p>
                            <NotificationText text={notif.body} />
                          </p>
                          <NotificationImage src={notif.imageUrl} />
                          <div className="amp-member-notification-meta">
                            {typeof notif.teamGroup === "number" ? (
                              <span>
                                {"\u041e\u0442\u0431\u043e\u0440: "}
                                {notif.teamGroup}
                              </span>
                            ) : null}
                            {Array.isArray(notif.trainingGroups) && notif.trainingGroups.length > 0 ? (
                              <span>
                                {"\u0421\u0431\u043e\u0440\u0435\u043d \u043e\u0442\u0431\u043e\u0440: "}
                                {notif.trainingGroups.map((group) => group.name).join(", ")}
                              </span>
                            ) : null}
                          </div>
                          <time dateTime={notif.sentAt}>
                            {new Date(notif.sentAt).toLocaleDateString("bg-BG", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
