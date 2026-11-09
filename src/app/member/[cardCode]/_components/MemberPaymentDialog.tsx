"use client";

import {
  type IrisOnlinePayment,
  type MemberProfile,
} from "../_types/member-types";
import {
  MONTH_NAMES_BG,
  MONTH_NAMES_BG_FULL,
  cmpYM,
} from "../_utils/member-display";
import { ChevronIcon, XIcon } from "./MemberIcons";

type Props = {
  paymentModalOpen: boolean;
  paymentLoading: boolean;
  setPaymentModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paymentDeleteConfirmOpen: boolean;
  member: MemberProfile;
  selectedPaymentDeleteMonths: { year: number; month: number }[];
  paymentError: string | null;
  setPaymentDeleteConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPaymentError: React.Dispatch<React.SetStateAction<string | null>>;
  handleDeletePayments: () => Promise<void>;
  paymentModalMode: "create" | "delete";
  isTrainingCreditBasedPayment: boolean;
  remainingTrainingCredits: number;
  isTrainingCreditsThirtyDayPayment: boolean;
  hasActiveTrainingCreditWindow: boolean;
  rollingPaymentWindow: {
    latestPaidStart: Date;
    paidUntil: Date;
    remainingDays: number;
  } | null;
  canManagePayments: boolean;
  paymentTrainingCredits: string;
  setPaymentTrainingCredits: React.Dispatch<React.SetStateAction<string>>;
  hasActiveTrainingCreditsThirtyDayPayment: boolean;
  isRollingThirtyDayPayment: boolean;
  hasActiveRollingPayment: boolean;
  rollingRemainingText: string;
  paymentModalYM: { year: number; month: number };
  setCalendarYear: React.Dispatch<React.SetStateAction<number>>;
  calendarYear: number;
  getMonthState: (ym: {
    year: number;
    month: number;
  }) =>
    | "disabled"
    | "paid"
    | "waived"
    | "deleteSelected"
    | "selected"
    | "next"
    | "available";
  selectedYM: { year: number; month: number } | null;
  handleMonthClick: (ym: { year: number; month: number }) => void;
  irisPayment: IrisOnlinePayment | null;
  handleIrisStatusCheck: () => Promise<void>;
  irisStatusLoading: boolean;
  viewerRoleChecked: boolean;
  handleIrisPayment: () => Promise<void>;
  irisPaymentLoading: boolean;
  handlePayment: () => Promise<void>;
};

export function MemberPaymentDialog({
  paymentModalOpen,
  paymentLoading,
  setPaymentModalOpen,
  paymentDeleteConfirmOpen,
  member,
  selectedPaymentDeleteMonths,
  paymentError,
  setPaymentDeleteConfirmOpen,
  setPaymentError,
  handleDeletePayments,
  paymentModalMode,
  isTrainingCreditBasedPayment,
  remainingTrainingCredits,
  isTrainingCreditsThirtyDayPayment,
  hasActiveTrainingCreditWindow,
  rollingPaymentWindow,
  canManagePayments,
  paymentTrainingCredits,
  setPaymentTrainingCredits,
  hasActiveTrainingCreditsThirtyDayPayment,
  isRollingThirtyDayPayment,
  hasActiveRollingPayment,
  rollingRemainingText,
  paymentModalYM,
  setCalendarYear,
  calendarYear,
  getMonthState,
  selectedYM,
  handleMonthClick,
  irisPayment,
  handleIrisStatusCheck,
  irisStatusLoading,
  viewerRoleChecked,
  handleIrisPayment,
  irisPaymentLoading,
  handlePayment,
}: Props) {
  return (
    <>
      {paymentModalOpen && (
        <div
          className="pm-overlay"
          onClick={() => !paymentLoading && setPaymentModalOpen(false)}
        >
          <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="pm-close"
              onClick={() => setPaymentModalOpen(false)}
              disabled={paymentLoading}
              aria-label="Затвори"
            >
              <XIcon size={16} />
            </button>

            {paymentDeleteConfirmOpen ? (
              <div
                role="alertdialog"
                aria-labelledby="payment-delete-confirm-title"
                aria-describedby="payment-delete-confirm-description"
              >
                <div className="pm-header">
                  <div>
                    <h2 className="pm-title" id="payment-delete-confirm-title">
                      Потвърждение за изтриване
                    </h2>
                    <p className="pm-name">{member.name}</p>
                  </div>
                </div>
                <div className="pm-divider" />
                <div className="pm-delete-confirm-body">
                  <p
                    className="pm-delete-confirm-question"
                    id="payment-delete-confirm-description"
                  >
                    Сигурни ли сте, че искате да изтриете избраните плащания?
                  </p>
                  <div
                    className="pm-delete-confirm-months"
                    aria-label="Избрани месеци за изтриване"
                  >
                    {selectedPaymentDeleteMonths.map((item) => (
                      <span
                        className="pm-delete-confirm-month"
                        key={`${item.year}-${item.month}`}
                      >
                        {MONTH_NAMES_BG_FULL[item.month]} {item.year}
                      </span>
                    ))}
                  </div>
                </div>
                {paymentError && <div className="pm-error">{paymentError}</div>}
                <div className="pm-divider" />
                <div className="pm-actions">
                  <button
                    className="pm-btn pm-btn--cancel"
                    autoFocus
                    disabled={paymentLoading}
                    onClick={() => {
                      setPaymentDeleteConfirmOpen(false);
                      setPaymentError(null);
                    }}
                  >
                    Отказ
                  </button>
                  <button
                    className="pm-btn pm-btn--danger"
                    disabled={paymentLoading}
                    onClick={handleDeletePayments}
                  >
                    {paymentLoading ? "Изтриване..." : "Да, изтрий"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="pm-header">
                  <div className="pm-title-icon">⚽</div>
                  <div>
                    <h2 className="pm-title">
                      {paymentModalMode === "delete"
                        ? "Изтриване на плащане"
                        : "Плащане"}
                    </h2>
                    <p className="pm-name">{member.name}</p>
                  </div>
                </div>

                <div className="pm-divider" />

                {isTrainingCreditBasedPayment ? (
                  <div className="pm-training-credit-panel">
                    <div
                      className={`pm-training-credit-balance${remainingTrainingCredits <= 0 ? " pm-training-credit-balance--empty" : ""}`}
                    >
                      <span className="pm-training-credit-balance-label">
                        Оставащи тренировки
                      </span>
                      <span className="pm-training-credit-balance-value">
                        {remainingTrainingCredits}
                      </span>
                    </div>
                    {isTrainingCreditsThirtyDayPayment && (
                      <div
                        className={`pm-training-credit-balance${!hasActiveTrainingCreditWindow ? " pm-training-credit-balance--empty" : ""}`}
                      >
                        <span className="pm-training-credit-balance-label">
                          Оставащи дни
                        </span>
                        <span className="pm-training-credit-balance-value">
                          {rollingPaymentWindow?.remainingDays ?? 0}
                        </span>
                      </div>
                    )}
                    {canManagePayments && (
                      <>
                        <label
                          className="pm-training-credit-label"
                          htmlFor="paymentTrainingCredits"
                        >
                          Нов брой тренировки
                        </label>
                        <input
                          id="paymentTrainingCredits"
                          className="pm-training-credit-input"
                          type="number"
                          min="1"
                          max="999"
                          inputMode="numeric"
                          value={paymentTrainingCredits}
                          onChange={(event) => {
                            setPaymentTrainingCredits(event.target.value);
                            setPaymentError(null);
                          }}
                          placeholder="Напр. 8"
                          disabled={paymentLoading}
                        />
                      </>
                    )}
                    <p className="pm-training-credit-help">
                      {hasActiveTrainingCreditsThirtyDayPayment
                        ? "Новото плащане е достъпно, когато тренировките станат 0 или 30-дневният срок изтече."
                        : !canManagePayments
                          ? `При онлайн плащане ще бъдат добавени ${member.defaultOnlineTrainingCredits ?? 0} тренировки.`
                          : isTrainingCreditsThirtyDayPayment
                            ? "При потвърждение тренировките ще се заменят с този брой и ще важат 30 дни от днес."
                            : "При потвърждение оставащите тренировки ще се заменят с този брой."}
                    </p>
                  </div>
                ) : isRollingThirtyDayPayment ? (
                  <div
                    className={`pm-info-row pm-info-row--rolling${hasActiveRollingPayment ? " pm-info-row--locked" : ""}`}
                  >
                    <span className="pm-info-lbl">
                      {paymentModalMode === "delete"
                        ? "Плащания по дата"
                        : "30-дневен период"}
                    </span>
                    {paymentModalMode === "delete" ? (
                      <span className="pm-info-val pm-info-val--muted">
                        Изтриването се управлява от платените дати по-долу.
                      </span>
                    ) : hasActiveRollingPayment && rollingPaymentWindow ? (
                      <span className="pm-rolling-status">
                        <strong>{rollingRemainingText} остават</strong>
                        <span>
                          Платено до{" "}
                          {rollingPaymentWindow.paidUntil.toLocaleDateString(
                            "bg-BG",
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className="pm-rolling-status">
                        <strong>Готово за плащане</strong>
                        <span>
                          Новото плащане ще важи 30 дни от днешната дата.
                        </span>
                      </span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="pm-info-row">
                      <span className="pm-info-lbl">
                        {paymentModalMode === "delete"
                          ? "Изберете платени месеци:"
                          : "Следващ дължим месец:"}
                      </span>
                      <span className="pm-info-val">
                        {paymentModalMode === "delete"
                          ? "Може да изберете един или повече"
                          : `${MONTH_NAMES_BG_FULL[paymentModalYM.month]} ${paymentModalYM.year}`}
                      </span>
                    </div>

                    {/* Year nav */}
                    <div className="pm-year-nav">
                      <button
                        className="pm-year-btn"
                        onClick={() => setCalendarYear((y) => y - 1)}
                      >
                        <ChevronIcon direction="left" />
                      </button>
                      <span className="pm-year-label">{calendarYear}</span>
                      <button
                        className="pm-year-btn"
                        onClick={() => setCalendarYear((y) => y + 1)}
                      >
                        <ChevronIcon direction="right" />
                      </button>
                    </div>

                    {/* Month grid */}
                    <div className="pm-months-grid">
                      {MONTH_NAMES_BG.map((name, i) => {
                        const ym = { year: calendarYear, month: i };
                        const state = getMonthState(ym);
                        const inAdvanceRange =
                          !!selectedYM &&
                          cmpYM(ym, paymentModalYM) >= 0 &&
                          cmpYM(ym, selectedYM) <= 0 &&
                          state !== "paid" &&
                          state !== "waived" &&
                          state !== "deleteSelected" &&
                          state !== "selected";
                        return (
                          <button
                            key={i}
                            className={`pm-month-btn pm-month-btn--${state}${inAdvanceRange ? " pm-month-btn--range" : ""}`}
                            onClick={() => handleMonthClick(ym)}
                            disabled={
                              state === "waived" ||
                              state === "disabled" ||
                              (paymentModalMode === "create" &&
                                state === "paid")
                            }
                            title={
                              state === "disabled"
                                ? "Платете първо предишните месеци"
                                : state === "paid"
                                  ? paymentModalMode === "delete"
                                    ? "Изберете за изтриване"
                                    : "Вече платено"
                                  : state === "waived"
                                    ? "Освободен месец (пауза)"
                                    : undefined
                            }
                          >
                            {name}
                            {(state === "paid" ||
                              state === "deleteSelected") && (
                              <span className="pm-paid-dot" />
                            )}
                            {state === "waived" && (
                              <span className="pm-waived-dot" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected summary */}
                    {selectedPaymentDeleteMonths.length > 0 ? (
                      <div className="pm-selected-summary pm-selected-summary--delete">
                        <span className="pm-selected-lbl">За изтриване:</span>
                        <span className="pm-selected-val">
                          {selectedPaymentDeleteMonths
                            .slice()
                            .sort((a, b) => cmpYM(a, b))
                            .map(
                              (item) =>
                                `${MONTH_NAMES_BG_FULL[item.month]} ${item.year}`,
                            )
                            .join(", ")}
                        </span>
                      </div>
                    ) : (
                      selectedYM && (
                        <div className="pm-selected-summary">
                          <span className="pm-selected-lbl">Избрано:</span>
                          <span className="pm-selected-val">
                            {cmpYM(selectedYM, paymentModalYM) > 0
                              ? `${MONTH_NAMES_BG_FULL[paymentModalYM.month]} ${paymentModalYM.year} - ${MONTH_NAMES_BG_FULL[selectedYM.month]} ${selectedYM.year}`
                              : `${MONTH_NAMES_BG_FULL[selectedYM.month]} ${selectedYM.year}`}
                          </span>
                        </div>
                      )
                    )}
                  </>
                )}

                {irisPayment && (
                  <div className="pm-iris-panel">
                    <div className="pm-iris-head">
                      <span className="pm-iris-title">IRISPay</span>
                      <span
                        className={`pm-iris-status pm-iris-status--${irisPayment.status.toLowerCase()}`}
                      >
                        {irisPayment.status === "CONFIRMED"
                          ? "Потвърдено"
                          : irisPayment.status === "FAILED"
                            ? "Неуспешно"
                            : "Очаква плащане"}
                      </span>
                    </div>
                    <div className="pm-iris-amount">
                      {irisPayment.amount} {irisPayment.currency}
                    </div>
                    <img
                      className="pm-iris-qr"
                      src={irisPayment.qrUrl}
                      alt="IRISPay QR код"
                    />
                    <div className="pm-iris-actions">
                      <a
                        className="pm-btn pm-btn--submit pm-iris-link"
                        href={
                          irisPayment.shortPaymentLink ||
                          irisPayment.paymentLink
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Отвори плащане
                      </a>
                      <button
                        className="pm-btn pm-btn--cancel"
                        onClick={handleIrisStatusCheck}
                        disabled={irisStatusLoading}
                      >
                        {irisStatusLoading ? "Проверка..." : "Провери статус"}
                      </button>
                    </div>
                  </div>
                )}

                {paymentError && <div className="pm-error">{paymentError}</div>}

                <div className="pm-divider" />

                <div className="pm-actions">
                  <button
                    className="pm-btn pm-btn--cancel"
                    onClick={() => setPaymentModalOpen(false)}
                  >
                    Отказ
                  </button>
                  {selectedPaymentDeleteMonths.length > 0 && (
                    <button
                      className="pm-btn pm-btn--danger"
                      onClick={() => {
                        setPaymentError(null);
                        setPaymentDeleteConfirmOpen(true);
                      }}
                      disabled={paymentLoading}
                    >
                      {paymentLoading ? "Изтриване..." : "Изтрий плащания"}
                    </button>
                  )}
                  {paymentModalMode === "create" && (
                    <>
                      {viewerRoleChecked && member.onlinePaymentEnabled && (
                        <button
                          className="pm-btn pm-btn--submit"
                          onClick={handleIrisPayment}
                          disabled={
                            !selectedYM ||
                            irisPaymentLoading ||
                            paymentLoading ||
                            selectedPaymentDeleteMonths.length > 0 ||
                            hasActiveRollingPayment ||
                            hasActiveTrainingCreditsThirtyDayPayment ||
                            (isTrainingCreditBasedPayment &&
                              Number(
                                member.defaultOnlineTrainingCredits ?? 0,
                              ) <= 0)
                          }
                        >
                          {irisPaymentLoading ? "Създаване..." : "Плати онлайн"}
                        </button>
                      )}
                      {canManagePayments && (
                        <button
                          className="pm-btn pm-btn--submit"
                          onClick={handlePayment}
                          disabled={
                            !selectedYM ||
                            paymentLoading ||
                            selectedPaymentDeleteMonths.length > 0 ||
                            hasActiveRollingPayment ||
                            hasActiveTrainingCreditsThirtyDayPayment ||
                            (isTrainingCreditBasedPayment &&
                              (!Number.isInteger(
                                Number(paymentTrainingCredits),
                              ) ||
                                Number(paymentTrainingCredits) < 1))
                          }
                          title={
                            hasActiveRollingPayment
                              ? `Остават ${rollingRemainingText}`
                              : hasActiveTrainingCreditsThirtyDayPayment
                                ? `Остават ${remainingTrainingCredits} тренировки и ${rollingRemainingText}`
                                : undefined
                          }
                        >
                          {paymentLoading ? "Обработка..." : "Потвърди плащане"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
