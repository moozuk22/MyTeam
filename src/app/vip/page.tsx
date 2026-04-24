// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import "../page.css";
import NavBar from "@/components/NavBar";
import {
  Check, TrendingUp, Users, Activity, Crown, CheckCircle,
  Shield, Zap, Calendar, ArrowDown, CreditCard, ShieldCheck,
  BarChart3
} from "lucide-react";

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
    }, { threshold: 0.05 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-hidden ${active ? "reveal-active" : ""}`}>
      {children}
    </div>
  );
}

export default function VipPage() {
  const [selectedScale, setSelectedScale] = useState(2);

  return (
    <>
      <NavBar />
      <RevealSection>
        <section id="VIP" className="vip-dashboard-section" style={{ scrollMarginTop: "100px", paddingTop: "140px" }}>
          <div className="section-container-wide">

            {/* TOP HEADER */}
            <div className="dashboard-header">
              <h1 className="dashboard-main-title">
                MyTeam7: Софтуерът, който не Ви струва нищо – <br />
                <span className="text-neon">ТОЙ ВИ НОСИ ПРИХОДИ</span>
              </h1>
              <div className="dashboard-stats-bar">
                <div className="dash-stat"><Check size={18} color="var(--neon-green)" /> 100% събираемост на таксите</div>
                <div className="dash-stat"><TrendingUp size={18} color="var(--neon-green)" /> Спестено време и нерви</div>
                <div className="dash-stat"><Users size={18} color="var(--neon-green)" /> Доволни родители, лоялни деца</div>
                <div className="dash-stat"><Activity size={18} color="var(--neon-green)" /> Контрол, прозрачност, растеж</div>
              </div>
            </div>

            <div className="dashboard-main-grid">
              {/* LEFT: MODULES & SCALE */}
              <div className="dash-left-col">
                <div className="left-modules-wrapper">
                  <div className="dash-tag-centered">ГЪВКАВ МОДЕЛ СПОРЕД НУЖДИТЕ НА ВАШИЯ КЛУБ</div>

                  <div className="modules-container">
                    <div className="module-card">
                      <div className="module-header">
                        <div>
                          <h3>БАЗОВ МОДУЛ</h3>
                          <p>Автоматизирани такси и напомняния</p>
                        </div>
                      </div>
                      <div className="module-pricing">
                        <div className="price-crossed">44 € / месец</div>
                        <ArrowDown size={24} className="price-arrow" />
                        <div className="your-profit-badge">ВАШИЯТ ПРИХОД</div>
                        <div className="zero-price">0 €</div>
                        <div className="promo-period">до края на 2026 г.<br /><span className="text-neon">VIP ПРОМОЦИЯ</span></div>
                      </div>
                      <ul className="module-perks" style={{ marginTop: "auto" }}>
                        <li><span className="text-neon">✓</span> Автоматизирано събиране на такси</li>
                        <li><span className="text-neon">✓</span> Интелигентни напомняния</li>
                        <li><span className="text-neon">✓</span> Централизирано управление</li>
                        <li><span className="text-neon">✓</span> Прозрачност и отчетност</li>
                      </ul>
                    </div>

                    <div className="module-plus">+</div>

                    <div className="module-card">
                      <div className="module-header">
                        <div>
                          <h3>ДОПЪЛНИТЕЛЕН МОДУЛ</h3>
                          <p>Интелигентен график</p>
                        </div>
                      </div>
                      <div className="module-pricing">
                        <div className="price-crossed">+9 € / месец</div>
                        <div className="total-label">(Общо 53 €)</div>
                        <ArrowDown size={24} className="price-arrow" />
                        <div className="your-profit-badge">ВАШИЯТ ПРИХОД</div>
                        <div className="plus-profit">+4 € / месец</div>
                        <div className="text-neon" style={{ fontSize: 12, fontWeight: 700 }}>VIP ПРЕФЕРЕНЦИЯ</div>
                      </div>
                      <ul className="module-perks" style={{ marginTop: "auto" }}>
                        <li><span className="text-neon">✓</span> Интелигентен тренировъчен график</li>
                        <li><span className="text-neon">✓</span> Автоматична комуникация</li>
                        <li><span className="text-neon">✓</span> Синхронизация в реално време</li>
                      </ul>
                    </div>
                  </div>

                  <div className="scale-box-integrated">
                    <div className="scale-title">ИЗБЕРЕТЕ СВОЯ МАЩАБ</div>
                    <div className="scale-chips">
                      {["0 - 50 деца", "50 - 100 деца", "100 - 200 деца", "200 - 300 деца", "300+ деца"].map((s, i) => (
                        <button
                          key={i}
                          className={`scale-chip ${selectedScale === i ? "active" : ""}`}
                          onClick={() => setSelectedScale(i)}
                        >
                          <Users size={14} /> {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: VIP CLUB NEON CARD */}
              <div className="dash-right-col">
                <div className="vip-neon-card">
                  <div className="vip-neon-header">
                    <div className="vip-title-with-icon">
                      <Crown size={42} color="var(--neon-green)" />
                      <h2 className="text-neon">VIP CLUB</h2>
                    </div>
                    <p className="text-neon" style={{ color: "var(--neon-green)", opacity: 1 }}>Ексклузивно за първите 10 клуба</p>
                  </div>

                  <div className="vip-rows-v2">
                    <div className="vip-row-v2">
                      <div className="v-icon-col">
                        <div className="v-icon-circle"><CheckCircle size={22} color="var(--neon-green)" /></div>
                      </div>
                      <div className="v-info-col">
                        <div className="v-label">Такса за внедряване</div>
                        <div className="v-price-old-red">0 €</div>
                      </div>
                      <div className="v-separator-line" style={{ width: 1.5, height: 36, background: "var(--neon-green)", opacity: 0.3, marginRight: 66 }}></div>
                      <div className="v-value-col">
                        <div className="v-val">0 €</div>
                        <div className="v-sub-badge">НАПЪЛНО БЕЗПЛАТНО</div>
                      </div>
                    </div>

                    <div className="vip-row-v2">
                      <div className="v-icon-col">
                        <div className="v-icon-box"><Calendar size={22} color="var(--neon-green)" /></div>
                      </div>
                      <div className="v-info-col">
                        <div className="v-label">Месечен абонамент за базовия пакет</div>
                        <div className="v-price-old-red">44 € / месец</div>
                      </div>
                      <div className="v-separator-line" style={{ width: 1.5, height: 36, background: "var(--neon-green)", opacity: 0.3, marginRight: 66 }}></div>
                      <div className="v-value-col">
                        <div className="v-val">0 €</div>
                        <div className="v-sub-green" style={{ fontSize: 11, fontWeight: 700, color: "var(--neon-green)", marginTop: 4 }}>до края на 2026 г.</div>
                      </div>
                    </div>

                    <div className="vip-row-v2">
                      <div className="v-icon-col">
                        <Shield size={24} color="var(--neon-green)" />
                      </div>
                      <div className="v-info-col">
                        <div className="v-label">Доживотна гаранция за <br /> най-ниска цена</div>
                      </div>
                      <div className="v-separator-line" style={{ width: 1.5, height: 36, background: "var(--neon-green)", opacity: 0.3, marginRight: 66 }}></div>
                      <div className="v-value-col">
                        <div className="v-status-label text-neon">ГАРАНТИРАНО</div>
                      </div>
                    </div>

                    <div className="vip-row-v2">
                      <div className="v-icon-col">
                        <Users size={24} color="var(--neon-green)" />
                      </div>
                      <div className="v-info-col">
                        <div className="v-label">Моделиране по задание според <br /> Вашия начин на работа</div>
                      </div>
                      <div className="v-separator-line" style={{ width: 1.5, height: 36, background: "var(--neon-green)", opacity: 0.3, marginRight: 66 }}></div>
                      <div className="v-value-col">
                        <div className="v-status-label text-neon">ПЕРСОНАЛИЗИРАНО</div>
                      </div>
                    </div>

                    <div className="vip-row-v2">
                      <div className="v-icon-col">
                        <Zap size={24} color="var(--neon-green)" />
                      </div>
                      <div className="v-info-col">
                        <div className="v-label">Приоритетна поддръжка <br /> и развитие</div>
                      </div>
                      <div className="v-separator-line" style={{ width: 1.5, height: 36, background: "var(--neon-green)", opacity: 0.3, marginRight: 66 }}></div>
                      <div className="v-value-col">
                        <div className="v-status-label text-neon">VIP ПОДДРЪЖКА</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM: SMART CARD & REAL BENEFITS */}
            <div className="dashboard-bottom">

              {/* SMART CARD BOX */}
              <div className="smart-card-box-v3">
                <div className="card-tag">ЕДИНСТВЕНАТА ТЕКУЩА ИНВЕСТИЦИЯ</div>

                <div className="new-div">
                  <div className="card-visual-side">
                    <div className="debit-card-mockup-v2">
                      <img src="/myteam-logo.png" alt="MyTeam" className="card-logo-large" />
                      <div className="card-footer-info-v2">
                        <span className="card-holder-white">SMART CARD</span>
                        <div className="nfc-waves-only">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                            <path d="M12 8a5 5 0 0 1 0 8" />
                            <path d="M16 6a9 9 0 0 1 0 12" />
                            <path d="M20 4a13 13 0 0 1 0 16" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-content-side">
                    <div className="side-info-row">
                      <div className="price-info-col-v2">
                        <h3 className="card-title-compact">СМАРТ КАРТИ<br />MyTeam</h3>
                        <div className="price-medium">15 € / 20 €</div>
                        <div className="price-sub-label">еднократно</div>
                      </div>

                      <div className="perks-info-col">
                        <ul className="card-check-list">
                          <li><Check size={14} className="text-neon" /> 10% отстъпка в Sport Depot и партньори</li>
                          <li><Check size={14} className="text-neon" /> Картата се изплаща сама чрез отстъпки</li>
                          <li><Check size={14} className="text-neon" /> Повишава ангажираността и лоялността</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* REAL BENEFITS BOX */}
              <div className="real-benefits-card">
                <div className="benefits-text-side">
                  <div className="card-tag">КАКВО ПОЛУЧАВАТЕ РЕАЛНО</div>
                  <ul className="benefits-icon-list">
                    <li><div className="b-icon-bg"><Calendar size={14} /></div> MyTeam7 поема „черната работа"</li>
                    <li><div className="b-icon-bg"><TrendingUp size={14} /></div> 100% контрол върху приходите</li>
                    <li><div className="b-icon-bg"><BarChart3 size={14} /></div> Предвидим растеж на клуба</li>
                    <li><div className="b-icon-bg"><ShieldCheck size={14} /></div> Освободено време за тренировките</li>
                  </ul>
                </div>
                <div className="benefits-image-side">
                  <div className="coach-fade-overlay"></div>
                  <img src="/coach.png" alt="Coach" className="coach-img" style={{ position: "absolute", left: "180px" }} />
                </div>
              </div>

            </div>

            {/* DASHBOARD FOOTER BAR */}
            <div className="dashboard-footer">
              <div className="footer-left">
                ВЪПРОСЪТ НЕ Е „КОЛКО СТРУВА MyTeam7?"<br />
                <span className="text-neon">ВЪПРОСЪТ Е: КОЛКО ГУБИТЕ БЕЗ НЕГО?</span>
              </div>
              <div className="footer-mid">
                <div className="footer-item"><Activity size={16} /> НЯМА ХАОС</div>
                <div className="footer-item"><CreditCard size={16} /> НЯМА ПРОПУСНАТИ ПЛАЩАНИЯ</div>
                <div className="footer-item"><Users size={16} /> НЯМА ИЗЛИШНА АДМИНИСТРАЦИЯ</div>
              </div>
              <div className="footer-right">
                ИМА КОНТРОЛ, РАСТЕЖ И СИГУРНИ ПРИХОДИ.
              </div>
            </div>

          </div>
        </section>
      </RevealSection>
    </>
  );
}
