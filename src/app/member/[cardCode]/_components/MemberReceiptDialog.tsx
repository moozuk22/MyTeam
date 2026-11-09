"use client";

import { type MemberProfile } from "../_types/member-types";
import { PrinterIcon, XIcon } from "./MemberIcons";

type Props = {
  selectedReceipt: { id: string; paidFor: string; paidAt: string } | null;
  setSelectedReceipt: React.Dispatch<
    React.SetStateAction<{ id: string; paidFor: string; paidAt: string } | null>
  >;
  member: MemberProfile;
  formatReceiptPeriod: (value: string) => string;
  handlePrintReceipt: () => void;
};

export function MemberReceiptDialog({
  selectedReceipt,
  setSelectedReceipt,
  member,
  formatReceiptPeriod,
  handlePrintReceipt,
}: Props) {
  return (
    <>
      {selectedReceipt && (
        <div
          className="receipt-overlay"
          onClick={() => setSelectedReceipt(null)}
        >
          <div className="receipt-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              className="receipt-close"
              onClick={() => setSelectedReceipt(null)}
              aria-label="Затвори"
            >
              <XIcon size={14} />
            </button>

            <div id="receipt-print-area" className="receipt-card">
              <div className="receipt-head">
                <h2 className="receipt-title">{member.clubName || "Клуб"}</h2>
                <p className="receipt-sub">Разписка за членски внос</p>
              </div>

              <hr className="receipt-sep" />

              <div className="receipt-fields">
                <div className="receipt-row">
                  <span className="receipt-lbl">Състезател:</span>
                  <span className="receipt-val">{member.name}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-lbl">Период:</span>
                  <span className="receipt-val">
                    {formatReceiptPeriod(selectedReceipt.paidFor)}
                  </span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-lbl">Дата на плащане:</span>
                  <span className="receipt-val">
                    {new Date(selectedReceipt.paidAt).toLocaleDateString(
                      "bg-BG",
                    )}
                  </span>
                </div>
              </div>

              <hr className="receipt-sep" />

              <div className="receipt-stamp-wrap">
                <div className="receipt-stamp">ПЛАТЕНО</div>
              </div>

              <div className="receipt-actions">
                <button
                  className="receipt-action-btn"
                  onClick={handlePrintReceipt}
                >
                  <PrinterIcon size={14} />
                  Принтирай / Запази
                </button>
                <button
                  className="receipt-action-btn"
                  onClick={() => setSelectedReceipt(null)}
                >
                  <XIcon size={14} />
                  Затвори
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
