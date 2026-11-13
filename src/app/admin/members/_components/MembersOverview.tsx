"use client";

import type * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import ClubFinancePanel from "@/app/admin/members/_components/ClubFinancePanel";
import ClubSubscriptionSummary from "@/app/admin/members/_components/ClubSubscriptionSummary";
import { PlayerCard } from "./PlayerCard";
import {
  ArrowLeftIcon,
  SearchIcon,
  XIcon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  BellOffIcon,
  SpinnerIcon,
  ShareIcon,
  ImportSheetsIcon,
  PhotoImportIcon,
  CalendarIcon,
  ChartColumnIcon,
  PencilIcon,
  ReceiptIcon,
  FileIcon,
  UsersIcon,
  ClipboardListIcon,
  DownloadIcon,
} from "./members-page-icons";
import { type Member } from "../_types/members-page-types";
import { type CoachGroups } from "../_hooks/useCoachGroups";
import { type MembersGuide } from "../_hooks/useMembersGuide";
import { type ClubNotifications } from "../_hooks/useClubNotifications";
import { type MemberManagement } from "../_hooks/useMemberManagement";
import { type ClubSettings } from "../_hooks/useClubSettings";
import { type TrainingGroups } from "../_hooks/useTrainingGroups";
import { type MatchEditorState } from "../_hooks/useMatchEditorState";
import { type CoachGroupAssignments } from "../_hooks/useCoachGroupAssignments";
import { type MemberNotifications } from "../_hooks/useMemberNotifications";
import { type MemberBirthdays } from "../_hooks/useMemberBirthdays";

const STOYCHO_STOEV_ACADEMY_CLUB_ID = "a484e11d-71fc-4472-a61e-22cf14e73fa4";

type MembersOverviewProps = {
  clubNotificationsController: Pick<
    ClubNotifications,
    | "handleOpenClubNotificationsPanel"
    | "clubNotificationsUnreadCount"
    | "isClubPushSupported"
    | "isClubIPhone"
    | "isClubStandalone"
    | "isClubPushSubscribed"
    | "handleDisableClubNotifications"
    | "clubPushBusy"
    | "handleEnableClubNotifications"
    | "setShowClubIphoneGuide"
    | "showClubIphoneGuide"
    | "clubPushStatusMessage"
    | "clubPushErrorMessage"
  >;
  memberManagement: Pick<MemberManagement, "setInactiveActionError" | "openEditMember">;
  trainingGroups: Pick<
    TrainingGroups,
    | "openTrainingGroupModeSettings"
    | "openTrainingGroupCreateModal"
    | "isCustomTrainingGroupMode"
    | "noFreeCustomTrainingGroupColor"
    | "customTrainingGroups"
  >;
  coachGroupManagement: Pick<CoachGroups, "loadCoachGroups" | "setCoachGroupsPanelOpen" | "coachGroups">;
  memberBirthdays: Pick<
    MemberBirthdays,
    "setBirthdayDate" | "setBirthdayMonth" | "setBirthdayTodayIso" | "setSelectedBirthdayDate"
  >;
  matchEditorState: Pick<MatchEditorState, "setMatchHistoryOpen">;
  clubSettings: Pick<ClubSettings, "openPaymentAmountModal" | "openRulesModal" | "openPaymentWorkflowModal">;
  memberNotifications: Pick<
    MemberNotifications,
    | "setNotifyPanelOpen"
    | "setNotifyMessage"
    | "setNotifyImage"
    | "setNotifySelectedIds"
    | "setNotifySearchTerm"
    | "setNotifyGroupFilter"
    | "setNotifyCoachGroupFilter"
    | "setNotifyBusy"
    | "setNotifyError"
    | "setNotifySuccess"
  >;
  membersGuide: Pick<MembersGuide, "setGuideStep" | "setGuideOpen">;
  coachGroupAssignments: Pick<CoachGroupAssignments, "openBulkCoachGroupModal">;
  isAdmin: boolean;
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
  clubId: string;
  isCoach: boolean;
  members: Member[];
  clubLogoUrl: string | null;
  clubName: string;
  currentCoachGroupName: string;
  clubBillingStatus: string;
  coachGroupId: string;
  setImportSheetsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setImportPhotosOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDownloadPlayersExcel: () => void;
  canViewInactiveMembers: boolean;
  refreshMembersList: () => Promise<void>;
  setInactivePlayersOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setReportsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openSchedulerSettings: () => Promise<void>;
  canUseSchedule2: boolean;
  openTrainingAttendance: (options?: { hideTeamsTab?: boolean; schedule2?: boolean }) => Promise<void>;
  setAttendanceDashboardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleDownloadMemberLinks: () => Promise<void>;
  canManageMemberActions: boolean;
  isDeletingTeam: boolean;
  setIsTeamDeleteConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  selectedGroup: string;
  setActiveDevicesOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsGroupDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isGroupDropdownOpen: boolean;
  activeMembersCount: number;
  activeMembersByCustomGroup: Record<string, number>;
  activeMembersByGroup: Record<number, number>;
  setSelectedGroup: React.Dispatch<React.SetStateAction<string>>;
  groupOptions: number[];
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  loading: boolean;
  filtered: Member[];
  setSelectedMember: React.Dispatch<React.SetStateAction<Member | null>>;
};

export function MembersOverview({
  clubNotificationsController,
  memberManagement,
  trainingGroups,
  coachGroupManagement,
  memberBirthdays,
  matchEditorState,
  clubSettings,
  memberNotifications,
  membersGuide,
  coachGroupAssignments,
  isAdmin,
  searchParams,
  router,
  clubId,
  isCoach,
  members,
  clubLogoUrl,
  clubName,
  currentCoachGroupName,
  clubBillingStatus,
  coachGroupId,
  setImportSheetsOpen,
  setImportPhotosOpen,
  handleDownloadPlayersExcel,
  canViewInactiveMembers,
  refreshMembersList,
  setInactivePlayersOpen,
  setReportsOpen,
  openSchedulerSettings,
  canUseSchedule2,
  openTrainingAttendance,
  setAttendanceDashboardOpen,
  handleDownloadMemberLinks,
  canManageMemberActions,
  isDeletingTeam,
  setIsTeamDeleteConfirmOpen,
  searchTerm,
  selectedGroup,
  setActiveDevicesOpen,
  setIsGroupDropdownOpen,
  isGroupDropdownOpen,
  activeMembersCount,
  activeMembersByCustomGroup,
  activeMembersByGroup,
  setSelectedGroup,
  groupOptions,
  setSearchTerm,
  loading,
  filtered,
  setSelectedMember,
}: MembersOverviewProps) {
  const {
    handleOpenClubNotificationsPanel,
    clubNotificationsUnreadCount,
    isClubPushSupported,
    isClubIPhone,
    isClubStandalone,
    isClubPushSubscribed,
    handleDisableClubNotifications,
    clubPushBusy,
    handleEnableClubNotifications,
    setShowClubIphoneGuide,
    showClubIphoneGuide,
    clubPushStatusMessage,
    clubPushErrorMessage,
  } = clubNotificationsController;
  const { setInactiveActionError, openEditMember } = memberManagement;
  const {
    openTrainingGroupModeSettings,
    openTrainingGroupCreateModal,
    isCustomTrainingGroupMode,
    noFreeCustomTrainingGroupColor,
    customTrainingGroups,
  } = trainingGroups;
  const { loadCoachGroups, setCoachGroupsPanelOpen, coachGroups } = coachGroupManagement;
  const { setBirthdayDate, setBirthdayMonth, setBirthdayTodayIso, setSelectedBirthdayDate } = memberBirthdays;
  const { setMatchHistoryOpen } = matchEditorState;
  const { openPaymentAmountModal, openRulesModal, openPaymentWorkflowModal } = clubSettings;
  const {
    setNotifyPanelOpen,
    setNotifyMessage,
    setNotifyImage,
    setNotifySelectedIds,
    setNotifySearchTerm,
    setNotifyGroupFilter,
    setNotifyCoachGroupFilter,
    setNotifyBusy,
    setNotifyError,
    setNotifySuccess,
  } = memberNotifications;
  const { setGuideStep, setGuideOpen } = membersGuide;
  const { openBulkCoachGroupModal } = coachGroupAssignments;
  const showBackButton = isAdmin || (isCoach && Boolean(coachGroupId) && clubId === STOYCHO_STOEV_ACADEMY_CLUB_ID);

  return (
    <>
      <div className="amp-inner">
        <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
          {showBackButton && (
            <button
              className="amp-back-btn amp-btn--compact"
              onClick={() => {
                if (searchParams.has("coachGroupId")) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("coachGroupId");
                  const query = params.toString();
                  router.push(`/admin/members${query ? `?${query}` : ""}`);
                  return;
                }
                router.push("/admin/players");
              }}
            >
              <ArrowLeftIcon />
              <span>Назад</span>
            </button>
          )}
          <div style={{ marginLeft: "auto" }}>
            <AdminLogoutButton />
          </div>
        </div>

        {clubId && !searchParams.has("coachGroupId") && (
          <ClubSubscriptionSummary key={clubId} clubId={clubId} />
        )}

        {clubId && !searchParams.has("coachGroupId") && (isAdmin || isCoach) && (
          <ClubFinancePanel key={`finance-${clubId}`} clubId={clubId} revision={members} compact />
        )}

        {/* ── Page header ── */}
        <div className="amp-header">
          <h1 className="amp-title">Списък състезатели</h1>
          <p className="amp-subtitle">Търсене, филтриране и ръчно отбелязване на плащания</p>
          <div className="amp-title-line" />
        </div>

        <div className="amp-club-info">
          <div className="amp-club-info-left">
            {clubLogoUrl ? (
              <img src={clubLogoUrl} alt={clubName} className="amp-club-logo" />
            ) : (
              <div className="amp-club-icon">🏆</div>
            )}
            <h2 className="amp-club-name">
              {clubName}
              {currentCoachGroupName && <span>{` - ${currentCoachGroupName}`}</span>}
              {isAdmin && clubId && clubBillingStatus && (
                <span className={`amp-billing-badge amp-billing-badge--${clubBillingStatus}`}>
                  {clubBillingStatus === "active" ? "Активен" : "Демо"}
                </span>
              )}
            </h2>
          </div>
          {clubId && (
            <div className="amp-modal-title-actions">
              <button
                className="amp-member-bell-btn"
                type="button"
                onClick={() => void handleOpenClubNotificationsPanel()}
                aria-label="All coach notifications"
              >
                <BellIcon />
                {clubNotificationsUnreadCount > 0 ? (
                  <span className="amp-member-bell-dot">
                    {clubNotificationsUnreadCount > 99 ? "99+" : clubNotificationsUnreadCount}
                  </span>
                ) : null}
              </button>
            </div>
          )}
        </div>

        {/* ── Buttons grid ── */}
        <div className="amp-buttons-grid">
          {(isAdmin || (isCoach && coachGroupId)) && (
            <button
              className="amp-add-btn"
              onClick={() =>
                router.push(
                  `/admin/members/add?clubId=${encodeURIComponent(clubId)}${coachGroupId ? `&coachGroupId=${encodeURIComponent(coachGroupId)}` : ""}`,
                )
              }
            >
              <PlusIcon />
              Добави състезател
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-import-sheets-btn amp-btn--compact"
              onClick={() => setImportSheetsOpen(true)}
              type="button"
            >
              <ImportSheetsIcon />
              <span>Импорт</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-import-sheets-btn amp-btn--compact"
              onClick={() => setImportPhotosOpen(true)}
              type="button"
            >
              <PhotoImportIcon />
              <span>Снимки</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-import-sheets-btn amp-btn--compact"
              onClick={handleDownloadPlayersExcel}
              type="button"
            >
              <DownloadIcon />
              <span>Excel</span>
            </button>
          )}
          {canViewInactiveMembers && (
            <button
              className="amp-inactive-toggle-btn amp-btn--compact"
              onClick={async () => {
                setInactiveActionError("");
                await refreshMembersList();
                setInactivePlayersOpen(true);
              }}
              type="button"
            >
              <UsersIcon />
              <span>Неактивни</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={openTrainingGroupModeSettings}
              type="button"
            >
              <UsersIcon />
              <span>Групи</span>
            </button>
          )}
          {(isAdmin || isCoach) && clubId && !coachGroupId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={() => {
                void loadCoachGroups();
                setCoachGroupsPanelOpen(true);
              }}
              type="button"
            >
              <UsersIcon />
              <span>Треньори</span>
            </button>
          )}
          {(isAdmin || (isCoach && coachGroupId)) && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={openTrainingGroupCreateModal}
              type="button"
              disabled={isCustomTrainingGroupMode && noFreeCustomTrainingGroupColor}
              title={
                isCustomTrainingGroupMode && noFreeCustomTrainingGroupColor
                  ? "Всички цветове са заети"
                  : undefined
              }
            >
              <PlusIcon />
              <span>Създай / редактирай група</span>
            </button>
          )}
          <button className="amp-reports-btn amp-btn--compact" onClick={() => setReportsOpen(true)}>
            <ChartColumnIcon size={16} />
            <span>Отчети</span>
          </button>
          {(isAdmin || isCoach) && clubId && (
            <>
              {isAdmin && (
                <button
                  className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                  onClick={() => void openSchedulerSettings()}
                  type="button"
                >
                  <CalendarIcon />
                  <span>Напомняния</span>
                </button>
              )}
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => {
                  if (coachGroupId) {
                    void openTrainingAttendance();
                  } else if (coachGroups.length >= 1) {
                    void openTrainingAttendance({ hideTeamsTab: true });
                  } else {
                    void openTrainingAttendance();
                  }
                }}
                type="button"
              >
                <UsersIcon />
                <span>График</span>
              </button>
              {isAdmin && canUseSchedule2 && (
                <button
                  className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                  onClick={() => void openTrainingAttendance({ schedule2: true })}
                  type="button"
                >
                  <CalendarIcon />
                  <span>График 2</span>
                </button>
              )}
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => setAttendanceDashboardOpen(true)}
                type="button"
              >
                <ClipboardListIcon />
                <span>Присъствия</span>
              </button>
              {clubId && (
                <button
                  className="amp-reports-btn amp-btn--compact"
                  type="button"
                  onClick={() => {
                    const parts = new Intl.DateTimeFormat("en-GB", {
                      timeZone: "Europe/Sofia",
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).formatToParts(new Date());
                    setBirthdayDate(
                      `${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`,
                    );
                    setBirthdayMonth(
                      `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`,
                    );
                    setBirthdayTodayIso(
                      `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`,
                    );
                    setSelectedBirthdayDate(null);
                    void refreshMembersList();
                  }}
                >
                  <span aria-hidden="true">🎂</span>
                  <span>Рожденици</span>
                </button>
              )}
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => setMatchHistoryOpen(true)}
                type="button"
              >
                <CalendarIcon />
                <span>История на мачовете</span>
              </button>
              {isAdmin && (
                <button
                  className="amp-btn amp-btn--ghost amp-btn--compact amp-training-plans-btn"
                  onClick={() => router.push(`/admin/training-plans?clubId=${encodeURIComponent(clubId)}`)}
                  type="button"
                >
                  <ClipboardListIcon />
                  <span>Планове за тренировки</span>
                </button>
              )}
              {isAdmin && (
                <button
                  className="amp-download-links-btn amp-btn--compact"
                  onClick={() => void handleDownloadMemberLinks()}
                  type="button"
                >
                  <DownloadIcon />
                  <span>Линкове</span>
                </button>
              )}
            </>
          )}
          {(isAdmin || isCoach) && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={openPaymentAmountModal}
              type="button"
            >
              <ReceiptIcon size={16} />
              <span>Месечна такса</span>
            </button>
          )}
          {(isAdmin || isCoach) && clubId === "0d877238-6f51-4ffe-b04f-d285904f5c8b" && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={() => void openRulesModal()}
              type="button"
            >
              <FileIcon size={16} />
              <span>Правилник</span>
            </button>
          )}
          {isAdmin && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              onClick={openPaymentWorkflowModal}
              type="button"
            >
              <ReceiptIcon size={16} />
              <span>Метод плащане</span>
            </button>
          )}
          {isAdmin && clubId && (
            <>
              <button
                className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
                onClick={() => router.push(`/admin/clubs/${encodeURIComponent(clubId)}/billing`)}
                type="button"
              >
                <span>Такси</span>
              </button>
              {canManageMemberActions && !coachGroupId && (
                <>
                  <button
                    className="amp-edit-team-btn amp-btn--compact"
                    onClick={() => router.push(`/admin/teams/${encodeURIComponent(clubId)}/edit`)}
                    disabled={isDeletingTeam}
                  >
                    <PencilIcon size={14} />
                    <span>Редактирай</span>
                  </button>
                  <button
                    className="amp-delete-team-btn amp-btn--compact"
                    onClick={() => setIsTeamDeleteConfirmOpen(true)}
                    disabled={isDeletingTeam}
                    type="button"
                  >
                    <TrashIcon />
                    <span>Изтрий</span>
                  </button>
                </>
              )}
            </>
          )}
          {(isAdmin || isCoach) && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              type="button"
              onClick={() => {
                setNotifyPanelOpen(true);
                setNotifyMessage("");
                setNotifyImage(null);
                setNotifySelectedIds(new Set());
                setNotifySearchTerm(searchTerm);
                setNotifyGroupFilter(selectedGroup);
                setNotifyCoachGroupFilter("");
                setNotifyBusy(false);
                setNotifyError("");
                setNotifySuccess("");
              }}
            >
              <BellIcon />
              <span>Съобщение</span>
            </button>
          )}
          {(isAdmin || isCoach) && clubId && (
            <button
              className="amp-download-links-btn amp-scheduler-settings-btn amp-btn--compact"
              type="button"
              onClick={() => setActiveDevicesOpen(true)}
            >
              <span>Активирани известия</span>
            </button>
          )}
          <button
            className="amp-guide-btn amp-btn--compact"
            type="button"
            onClick={() => {
              setGuideStep(0);
              setGuideOpen(true);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <circle cx="12" cy="17" r="0.5" fill="currentColor" />
            </svg>
            <span>Наръчник</span>
          </button>
        </div>
        {(isClubPushSupported || (isClubIPhone && !isClubStandalone)) && clubId && (
          <>
            {isClubPushSubscribed && (
              <div className="push-enabled-banner">
                <span className="push-enabled-check" aria-hidden="true">
                  ✓
                </span>
                <span className="push-enabled-text">Известията са активирани</span>
              </div>
            )}
            {(!isClubIPhone || isClubStandalone) &&
              (isClubPushSubscribed ? (
                <button
                  className="bell-btn bell-btn--disable"
                  onClick={handleDisableClubNotifications}
                  disabled={clubPushBusy}
                >
                  {clubPushBusy ? <SpinnerIcon /> : <BellOffIcon />}
                  {clubPushBusy ? "Изключване..." : "Изключване на известия"}
                </button>
              ) : (
                <button className="bell-btn" onClick={handleEnableClubNotifications} disabled={clubPushBusy}>
                  {clubPushBusy ? <SpinnerIcon /> : <BellIcon />}
                  {clubPushBusy ? "Активиране..." : "Активиране на известия"}
                </button>
              ))}
            {isClubIPhone && !isClubStandalone && (
              <>
                <button
                  className="add-btn add-btn--white-text"
                  onClick={() => setShowClubIphoneGuide((v) => !v)}
                >
                  <ShareIcon size={16} />
                  Добавете към начален екран
                </button>

                <p className="hint-text">
                  За да активирате известията на iPhone, натиснете бутона Share и изберете &ldquo;Добавяне към
                  начален екран&rdquo;.
                </p>

                {showClubIphoneGuide && (
                  <div className="instr-box">
                    <button
                      className="instr-close"
                      onClick={() => setShowClubIphoneGuide(false)}
                      aria-label="Затвори"
                    >
                      <XIcon />
                    </button>
                    <p className="instr-heading">Как да активирате известия на iPhone:</p>
                    <ol className="instr-list">
                      <li>
                        <span className="step-badge">1</span>
                        <span>
                          Натиснете бутона <ShareIcon size={14} /> <strong>Share</strong> в долната лента на
                          Safari
                        </span>
                      </li>
                      <li>
                        <span className="step-badge">2</span>
                        <span>
                          Превъртете надолу и изберете <PlusIcon />{" "}
                          <strong>&ldquo;Добавяне към начален екран&rdquo;</strong>
                        </span>
                      </li>
                      <li>
                        <span className="step-badge">3</span>
                        <span>
                          Отворете приложението от началния екран и натиснете{" "}
                          <strong>&ldquo;Активиране на известия&rdquo;</strong>
                        </span>
                      </li>
                    </ol>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Content ── */}
        {clubPushStatusMessage && (
          <p className="amp-lbl" style={{ marginTop: "8px" }}>
            {clubPushStatusMessage}
          </p>
        )}
        {clubPushErrorMessage && <p className="amp-confirm-error">{clubPushErrorMessage}</p>}

        <div className="amp-content">
          {/* Coach group page links */}
          {!coachGroupId && coachGroups.length > 0 && (
            <div className="amp-coach-group-nav-list">
              {coachGroups.map((group) => (
                <div key={group.id} className="amp-coach-group-nav-row">
                  <button
                    className="amp-coach-group-nav-btn"
                    onClick={() => {
                      window.location.href = `/admin/members?clubId=${encodeURIComponent(clubId)}&coachGroupId=${encodeURIComponent(group.id)}`;
                    }}
                    type="button"
                  >
                    <span>{group.name}</span>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                  <button
                    className="amp-coach-group-assign-btn"
                    type="button"
                    title="Управление на състезатели"
                    onClick={() => openBulkCoachGroupModal(group.id)}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Group filter dropdown */}
          <div
            className="amp-edit-field"
            style={{ marginBottom: "10px", padding: "0", position: "relative" }}
          >
            <div
              className="amp-edit-input amp-edit-input-text-center"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                position: "relative",
              }}
              onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
            >
              {selectedGroup === "all"
                ? `Всички (${activeMembersCount})`
                : isCustomTrainingGroupMode
                  ? `${customTrainingGroups.find((g) => g.id === selectedGroup)?.name ?? selectedGroup} (${activeMembersByCustomGroup[selectedGroup] ?? 0})`
                  : `${selectedGroup} (${(activeMembersByGroup as Record<string, number>)[selectedGroup] ?? 0})`}
            </div>
            {isGroupDropdownOpen && (
              <>
                <div
                  style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                  onClick={() => setIsGroupDropdownOpen(false)}
                />
                <div
                  className="amp-custom-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    marginTop: "4px",
                    backgroundColor: "#1e1e1e",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "10px",
                    zIndex: 999,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    className={`amp-custom-dropdown-item ${selectedGroup === "all" ? "active" : ""}`}
                    onClick={() => {
                      setSelectedGroup("all");
                      setIsGroupDropdownOpen(false);
                    }}
                  >
                    Всички ({activeMembersCount})
                  </div>
                  {isCustomTrainingGroupMode
                    ? customTrainingGroups
                        .filter((g) => (activeMembersByCustomGroup[g.id] ?? 0) > 0)
                        .map((g) => (
                          <div
                            key={g.id}
                            className={`amp-custom-dropdown-item ${selectedGroup === g.id ? "active" : ""}`}
                            onClick={() => {
                              setSelectedGroup(g.id);
                              setIsGroupDropdownOpen(false);
                            }}
                          >
                            {g.name} ({activeMembersByCustomGroup[g.id] ?? 0})
                          </div>
                        ))
                    : groupOptions.map((g) => (
                        <div
                          key={g}
                          className={`amp-custom-dropdown-item ${selectedGroup === String(g) ? "active" : ""}`}
                          onClick={() => {
                            setSelectedGroup(String(g));
                            setIsGroupDropdownOpen(false);
                          }}
                        >
                          {g} ({(activeMembersByGroup as Record<string, number>)[g] ?? 0})
                        </div>
                      ))}
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="amp-search-wrap">
            <SearchIcon />
            <input
              className="amp-search"
              type="text"
              placeholder="Търси по име или номер..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="amp-search-clear" onClick={() => setSearchTerm("")}>
                <XIcon />
              </button>
            )}
          </div>

          {/* Cards */}
          {loading ? (
            <div className="amp-loading">
              <div className="amp-spinner" />
            </div>
          ) : (
            <div className="amp-cards">
              {filtered.map((m) => (
                <PlayerCard
                  key={m.id}
                  member={m}
                  onClick={() => setSelectedMember(m)}
                  onEdit={openEditMember}
                  coachGroupName={
                    !coachGroupId && m.coachGroupIds.length > 0
                      ? m.coachGroupIds
                          .map((id) => coachGroups.find((g) => g.id === id)?.name ?? "")
                          .filter(Boolean)
                          .join(", ")
                      : null
                  }
                  coachGroupId={coachGroupId || null}
                />
              ))}
              {filtered.length === 0 && <p className="amp-empty">Няма намерени състезатели</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
