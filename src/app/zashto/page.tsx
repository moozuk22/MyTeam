// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import "../page.css";
import NavBar from "@/components/NavBar";

import { ArrowRight } from "lucide-react";

function RevealSection({ children }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        obs.unobserve(el);
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-hidden ${active ? "reveal-active" : ""}`}>
      {children}
    </div>
  );
}

export default function ZashtoPage() {
  return (
    <>
      <NavBar />
      <RevealSection>
        <section id="Защо" className="why-section" style={{ scrollMarginTop: "100px", paddingTop: "140px", minHeight: "100vh", paddingBottom: "100px" }}>
          <div className="section-container-wide">
            <div className="section-header-centered">
              <div className="section-tag-light">ИСТОРИЯТА ЗАД ПРОДУКТА</div>
              <h2 className="section-title-premium">Вдъхновен от терена,<br />създаден от професионалисти.</h2>
              <div className="section-divider-center" />
            </div>

            <div className="why-grid" style={{ marginBottom: 80 }}>
              <div className="why-text-col">
                <p className="why-p-main">
                  MyTeam7 не е просто софтуерна система. Той е дигиталното отражение на <strong>10 години опит</strong> в професионалния футбол (А група) и ежедневното управление на най-развитата школа за Belly Dance и шоу програми в Пловдив – <strong>Dalida Dance</strong>.
                </p>
                <p className="why-p-sub">
                  Продуктът е изграден по модела на нашия „Първи пилот" – треньор с десетилетен стаж в елитния спорт, който познава административния хаос от първо лице. Взехме неговата доказана методология и я съчетахме с реалните бизнес решения!
                </p>
                <div className="why-quote-box">
                  <p className="why-quote-text">
                    "Ние бяхме в капана на хартиените дневници, изгубената информация и безкрайните Viber групи - и създадохме изход. MyTeam е проектиран от хора, които са били точно там, където сте Вие сега."
                  </p>
                </div>
              </div>
              <div className="why-visual-col">
                <div className="why-image-card" style={{ background: "url('/professional_pitch_history.png') center/cover" }} />
                <div className="why-experience-badge">
                  <div className="badge-icon">🏆</div>
                  <div className="badge-content">
                    <div className="badge-title">10 ГОДИНИ</div>
                    <div className="badge-subtitle">В ЕЛИТНИЯ СПОРТ</div>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA SECTION */}
            <div style={{ textAlign: "center", marginTop: 40 }}>
              <a href="/#Контакт" className="vip-main-cta-btn" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "14px",
                background: "var(--neon-green)",
                color: "#000",
                padding: "20px 48px",
                borderRadius: "16px",
                fontSize: "18px",
                fontWeight: 900,
                textDecoration: "none",
                transition: "all 0.3s ease",
                boxShadow: "0 10px 30px rgba(57, 255, 20, 0.3)",
                textTransform: "uppercase"
              }}>
                Започнете безплатно сега
                <ArrowRight size={22} />
              </a>
            </div>

          </div>
        </section>
      </RevealSection>
    </>
  );
}
