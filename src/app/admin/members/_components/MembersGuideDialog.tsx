"use client";

import { XIcon } from "./members-page-icons";
import { type MembersGuide } from "../_hooks/useMembersGuide";

type MembersGuideDialogProps = {
  membersGuide: Pick<
    MembersGuide,
    | "guideOpen"
    | "setGuideOpen"
    | "guideSteps"
    | "guideStep"
    | "setGuideStep"
    | "setGuideImgExpanded"
    | "guideImgExpanded"
    | "guideImgScale"
    | "guideImgPos"
    | "handleGuideImgTouchStart"
    | "handleGuideImgTouchMove"
    | "handleGuideImgTouchEnd"
    | "setGuideImgScale"
    | "setGuideImgPos"
  >;
};

export function MembersGuideDialog({ membersGuide }: MembersGuideDialogProps) {
  const {
    guideOpen,
    setGuideOpen,
    guideSteps,
    guideStep,
    setGuideStep,
    setGuideImgExpanded,
    guideImgExpanded,
    guideImgScale,
    guideImgPos,
    handleGuideImgTouchStart,
    handleGuideImgTouchMove,
    handleGuideImgTouchEnd,
    setGuideImgScale,
    setGuideImgPos,
  } = membersGuide;
  return (
    <>
      {guideOpen && (
        <div className="amp-overlay" onClick={() => setGuideOpen(false)}>
          <div className="amp-modal amp-modal--guide" onClick={(e) => e.stopPropagation()}>
            <div className="amp-modal-tint" aria-hidden="true" />
            <div className="amp-guide-sidebar">
              <div className="amp-guide-sidebar-title">Наръчник</div>
              {guideSteps.map((step, idx) => (
                <button
                  key={step.id}
                  className={`amp-guide-sidebar-item${idx === guideStep ? " is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setGuideStep(idx);
                    setGuideImgExpanded(false);
                  }}
                >
                  <span className="amp-guide-sidebar-num">{idx + 1}</span>
                  <span className="amp-guide-sidebar-name">{step.title}</span>
                </button>
              ))}
            </div>
            <div className="amp-guide-content">
              <div className="amp-guide-content-header">
                <span className="amp-guide-step-counter">
                  {guideStep + 1} / {guideSteps.length}
                </span>
                <button className="amp-modal-close" onClick={() => setGuideOpen(false)} aria-label="Затвори">
                  <XIcon />
                </button>
              </div>
              <div className="amp-guide-content-scroll">
                <div
                  key={guideSteps[guideStep]?.id}
                  className="amp-guide-step-img-wrap"
                  style={{ display: "none" }}
                >
                  <img
                    src={"/guide/" + (guideSteps[guideStep]?.id ?? "") + ".png"}
                    alt=""
                    className="amp-guide-step-img"
                    onLoad={(e) => {
                      if (e.currentTarget.parentElement)
                        (e.currentTarget.parentElement as HTMLElement).style.display = "flex";
                    }}
                    onError={(e) => {
                      if (e.currentTarget.parentElement)
                        (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                    onClick={() => setGuideImgExpanded(true)}
                  />
                  <span className="amp-guide-step-img-hint">🔍 Кликни за цял екран</span>
                </div>
                {guideImgExpanded && (
                  <div
                    className="amp-guide-lightbox"
                    onClick={() => {
                      if (guideImgScale <= 1) setGuideImgExpanded(false);
                    }}
                  >
                    <img
                      src={"/guide/" + (guideSteps[guideStep]?.id ?? "") + ".png"}
                      alt=""
                      className="amp-guide-lightbox-img"
                      style={{
                        transform: `scale(${guideImgScale}) translate(${guideImgPos.x / guideImgScale}px, ${guideImgPos.y / guideImgScale}px)`,
                      }}
                      onTouchStart={handleGuideImgTouchStart}
                      onTouchMove={handleGuideImgTouchMove}
                      onTouchEnd={handleGuideImgTouchEnd}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (guideImgScale > 1) {
                          setGuideImgScale(1);
                          setGuideImgPos({ x: 0, y: 0 });
                        } else {
                          setGuideImgExpanded(false);
                        }
                      }}
                    />
                    {guideImgScale <= 1 && (
                      <span className="amp-guide-lightbox-hint">
                        Щипни за увеличение · Натисни за затваряне
                      </span>
                    )}
                  </div>
                )}
                <div className="amp-guide-step-body">
                  <div
                    className="amp-guide-step-icon-wrap"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                      __html:
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                        (guideSteps[guideStep]?.icon ?? "") +
                        "</svg>",
                    }}
                  />
                  <div>
                    <h3 className="amp-guide-step-title">{guideSteps[guideStep]?.title}</h3>
                    <p className="amp-guide-step-desc">{guideSteps[guideStep]?.description}</p>
                  </div>
                </div>
              </div>
              <div className="amp-guide-nav">
                <button
                  className="amp-btn amp-btn--ghost amp-btn--compact"
                  type="button"
                  onClick={() => {
                    setGuideStep((s) => Math.max(0, s - 1));
                    setGuideImgExpanded(false);
                  }}
                  disabled={guideStep === 0}
                >
                  ← Назад
                </button>
                {guideStep === guideSteps.length - 1 ? (
                  <button
                    className="amp-btn amp-btn--primary amp-btn--compact"
                    type="button"
                    onClick={() => setGuideOpen(false)}
                  >
                    Готово ✓
                  </button>
                ) : (
                  <button
                    className="amp-btn amp-btn--primary amp-btn--compact"
                    type="button"
                    onClick={() => {
                      setGuideStep((s) => s + 1);
                      setGuideImgExpanded(false);
                    }}
                  >
                    Напред →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
