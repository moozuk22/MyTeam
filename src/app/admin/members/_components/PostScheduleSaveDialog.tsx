"use client";

import type * as React from "react";
import { XIcon } from "./members-page-icons";

type PostScheduleSaveDialogProps = {
  postTeamGroupSavePromptOpen: boolean;
  setPostTeamGroupSavePromptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  postTeamGroupSavePromptGroupName: string;
  handlePostTeamGroupSavePromptConfirm: () => Promise<void>;
};

export function PostScheduleSaveDialog({
  postTeamGroupSavePromptOpen,
  setPostTeamGroupSavePromptOpen,
  postTeamGroupSavePromptGroupName,
  handlePostTeamGroupSavePromptConfirm,
}: PostScheduleSaveDialogProps) {
  return (
    <>
      {postTeamGroupSavePromptOpen && (
        <div
          className="amp-overlay amp-overlay--confirm"
          style={{ zIndex: 20000 }}
          onClick={() => setPostTeamGroupSavePromptOpen(false)}
        >
          <div className="amp-modal amp-modal--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <h2 className="amp-modal-title">
              <span className="amp-modal-title-gradient">Потвърждение</span>
              <button
                className="amp-modal-close"
                onClick={() => setPostTeamGroupSavePromptOpen(false)}
                aria-label="Затвори"
              >
                <XIcon />
              </button>
            </h2>
            <div className="amp-modal-body">
              <p
                className="amp-lbl"
                style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {`скате ли да направите промени по сборен отбор ${postTeamGroupSavePromptGroupName}?`}
              </p>
              <div className="amp-modal-actions amp-modal-actions--end">
                <button
                  type="button"
                  className="amp-btn amp-btn--ghost"
                  onClick={() => setPostTeamGroupSavePromptOpen(false)}
                >
                  Не
                </button>
                <button
                  type="button"
                  className="amp-btn amp-btn--primary"
                  onClick={() => void handlePostTeamGroupSavePromptConfirm()}
                >
                  Да
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
