"use client";

import { XIcon } from "./members-page-icons";
import { type ClubSettings } from "../_hooks/useClubSettings";

type PaymentWorkflowDialogProps = {
  clubSettings: Pick<
    ClubSettings,
    | "paymentWorkflowModalOpen"
    | "closePaymentWorkflowModal"
    | "paymentWorkflowSaving"
    | "paymentWorkflowDraft"
    | "setPaymentWorkflowDraft"
    | "setPaymentWorkflowError"
    | "setPaymentWorkflowSuccess"
    | "paymentWorkflowError"
    | "paymentWorkflowSuccess"
    | "handleSavePaymentWorkflow"
  >;
  isAdmin: boolean;
  clubId: string;
};

export function PaymentWorkflowDialog({ clubSettings, isAdmin, clubId }: PaymentWorkflowDialogProps) {
  const {
    paymentWorkflowModalOpen,
    closePaymentWorkflowModal,
    paymentWorkflowSaving,
    paymentWorkflowDraft,
    setPaymentWorkflowDraft,
    setPaymentWorkflowError,
    setPaymentWorkflowSuccess,
    paymentWorkflowError,
    paymentWorkflowSuccess,
    handleSavePaymentWorkflow,
  } = clubSettings;
  return (
    <>
      {paymentWorkflowModalOpen && isAdmin && clubId && (
        <div className="amp-overlay" onClick={closePaymentWorkflowModal}>
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Метод на плащане</span>
              <button
                className="amp-modal-close"
                onClick={closePaymentWorkflowModal}
                aria-label="Затвори"
                disabled={paymentWorkflowSaving}
              >
                <XIcon />
              </button>
            </h2>

            <div className="amp-modal-body">
              <div className="amp-payment-workflow-picker" role="radiogroup" aria-label="Метод за плащане">
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentWorkflowDraft === "calendar_month"}
                  className={`amp-payment-workflow-option${paymentWorkflowDraft === "calendar_month" ? " is-selected" : ""}`}
                  onClick={() => {
                    setPaymentWorkflowDraft("calendar_month");
                    setPaymentWorkflowError("");
                    setPaymentWorkflowSuccess("");
                  }}
                  disabled={paymentWorkflowSaving}
                >
                  <span className="amp-payment-workflow-check" aria-hidden="true" />
                  <span className="amp-payment-workflow-copy">
                    <span className="amp-payment-workflow-title">Календарен месец</span>
                    <span className="amp-payment-workflow-desc">
                      Плащанията се отчитат по месеци. Състезателят е платен за избрания календарен месец, а
                      статусът се изчислява спрямо текущия и предходния месец.
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentWorkflowDraft === "rolling_30_days"}
                  className={`amp-payment-workflow-option${paymentWorkflowDraft === "rolling_30_days" ? " is-selected" : ""}`}
                  onClick={() => {
                    setPaymentWorkflowDraft("rolling_30_days");
                    setPaymentWorkflowError("");
                    setPaymentWorkflowSuccess("");
                  }}
                  disabled={paymentWorkflowSaving}
                >
                  <span className="amp-payment-workflow-check" aria-hidden="true" />
                  <span className="amp-payment-workflow-copy">
                    <span className="amp-payment-workflow-title">30 дни от датата на плащане</span>
                    <span className="amp-payment-workflow-desc">
                      Всяко плащане важи 30 дни от деня, в който е отчетено. Ако остават активни дни,
                      треньорът вижда колко дни остават и не може да отчете ново плащане.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentWorkflowDraft === "training_credits"}
                  className={`amp-payment-workflow-option${paymentWorkflowDraft === "training_credits" ? " is-selected" : ""}`}
                  onClick={() => {
                    setPaymentWorkflowDraft("training_credits");
                    setPaymentWorkflowError("");
                    setPaymentWorkflowSuccess("");
                  }}
                  disabled={paymentWorkflowSaving}
                >
                  <span className="amp-payment-workflow-check" aria-hidden="true" />
                  <span className="amp-payment-workflow-copy">
                    <span className="amp-payment-workflow-title">Брой тренировки</span>
                    <span className="amp-payment-workflow-desc">
                      Треньорът задава колко тренировки остават при плащане. Всяко чекиране намалява броя с 1.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={paymentWorkflowDraft === "training_credits_30_days"}
                  className={`amp-payment-workflow-option${paymentWorkflowDraft === "training_credits_30_days" ? " is-selected" : ""}`}
                  onClick={() => {
                    setPaymentWorkflowDraft("training_credits_30_days");
                    setPaymentWorkflowError("");
                    setPaymentWorkflowSuccess("");
                  }}
                  disabled={paymentWorkflowSaving}
                >
                  <span className="amp-payment-workflow-check" aria-hidden="true" />
                  <span className="amp-payment-workflow-copy">
                    <span className="amp-payment-workflow-title">Брой тренировки за 30 дни</span>
                    <span className="amp-payment-workflow-desc">
                      Плащането задава брой тренировки и 30-дневен срок. Играчът е просрочен, когато изтече
                      срокът или тренировките станат 0.
                    </span>
                  </span>
                </button>
              </div>

              <p className="amp-payment-workflow-note">
                Избраният метод се прилага за всички състезатели в клуба.
              </p>

              {paymentWorkflowError && <p className="amp-confirm-error">{paymentWorkflowError}</p>}
              {paymentWorkflowSuccess && <p className="amp-confirm-success">{paymentWorkflowSuccess}</p>}

              <div className="amp-modal-actions">
                <button
                  className="amp-btn amp-btn--ghost"
                  type="button"
                  onClick={closePaymentWorkflowModal}
                  disabled={paymentWorkflowSaving}
                >
                  Отказ
                </button>
                <button
                  className="amp-btn amp-btn--primary"
                  type="button"
                  onClick={handleSavePaymentWorkflow}
                  disabled={paymentWorkflowSaving}
                >
                  {paymentWorkflowSaving ? "Запазване..." : "Запази"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
