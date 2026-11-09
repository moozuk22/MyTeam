"use client";

import type { CarouselImage, LandingFeature } from "./_utils/landing-content";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Users, ArrowRight, ArrowDown, Calendar, Check, X as CloseX, PhoneCall, Crown, Puzzle } from "lucide-react";
import ChatBot from "@/components/ChatBot";
import NavBar from "@/components/NavBar";
import { G, B, BG, COMPARISON, PARTNERS, ALL_PARTNERS } from "./_utils/landing-content";
import { LeadForm } from "./_components/LeadForm";
import { SuccessModal } from "./_components/SuccessModal";
import { InfiniteCarousel } from "./_components/InfiniteCarousel";
import { RevealSection } from "./_components/RevealSection";
import { FeaturePopup } from "./_components/FeatureCards";
import { Lightbox, VideoModal } from "./_components/MediaModals";
import "./page.css";

export default function Home() {
  const [subActive, setSubActive] = useState(false);
  const [withSchedule, setWithSchedule] = useState(false);
  const [popup, setPopup] = useState<LandingFeature | null>(null);
  const [expandedImage, setExpandedImage] = useState<CarouselImage | null>(null);
  const [benefitsOpen, setBenefitsOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("video") === "1"
      : false
  );
  const [showDockActions, setShowDockActions] = useState(false);
  const contactRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    };
    const handleGlobalDragStart = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement) e.preventDefault();
    };

    document.addEventListener("contextmenu", handleGlobalContextMenu);
    document.addEventListener("dragstart", handleGlobalDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleGlobalContextMenu);
      document.removeEventListener("dragstart", handleGlobalDragStart);
    };
  }, []);

  useEffect(() => {
    // Record page visit only once per browser session to prevent inflation from refreshes
    if (typeof window !== "undefined" && !sessionStorage.getItem("mt_visit_recorded")) {
      void fetch("/api/page-clicks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "page_visit" })
      });
      sessionStorage.setItem("mt_visit_recorded", "true");
    }
  }, []);

  useEffect(() => {
    if (!contactRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowDockActions(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(contactRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <NavBar />
      {popup && <FeaturePopup feature={popup} onClose={() => setPopup(null)} />}
      {expandedImage && <Lightbox image={expandedImage} onClose={() => setExpandedImage(null)} />}
      {showSuccess && <SuccessModal onClose={() => setShowSuccess(false)} />}
      {showVideoModal && <VideoModal onClose={() => setShowVideoModal(false)} />}

      <RevealSection>
        <section className="hero-section" style={{ minHeight: "100vh", display: "flex", alignItems: "center" }}>
          <div className="hero-grid-bg" />
          <div className="hero-content" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>

            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 64, width: "100%" }} className="hero-split">
              <div className="hero-text-col" style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <h1 className="hero-title" style={{ fontSize: "clamp(32px, 5vw, 48px)" }}>
                  <span className="hero-title-highlight"><span style={{ color: "#fff" }}>My</span>Team</span> – интелигентна платформа за управление на Вашия клуб
                </h1>

                <p className="hero-description" style={{ margin: "0 0 32px 0", maxWidth: 650, textAlign: "center", fontSize: "16px" }}>
                  Проследявайте плащанията, използвайте онлайн график и се възползвайте от специални отстъпки – всичко на едно място.
                </p>

                <div className="hero-actions" style={{ marginTop: 24, gap: 24, display: "flex", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                  <a href="#Контакт" className="hero-btn-primary hero-btn-cta" style={{ padding: "12px 36px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", border: "1px solid rgba(57, 255, 20, 0.3)" }}>
                    <div className="hero-btn-stack" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div className="hero-line-1" style={{ fontSize: "13px", fontWeight: "900", letterSpacing: "0.5px" }}>
                        БЕЗПЛАТНА <span style={{ color: "#000", fontWeight: "900" }}>ВИДЕО</span>
                      </div>
                      <div className="hero-line-2" style={{ fontSize: "13px", fontWeight: "900", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
                        КОНСУЛТАЦИЯ <ArrowRight size={16} />
                      </div>
                    </div>
                  </a>
                  <a href="#Системата" className="hero-btn-secondary" style={{
                    padding: "0 36px",
                    height: "64px",
                    textDecoration: "none",
                    background: "#FF3E3E",
                    color: "#000",
                    fontWeight: "900",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "12px",
                    fontSize: "13px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    boxShadow: "0 8px 20px rgba(255, 62, 62, 0.25)"
                  }}>
                    ВИЖ КАК РАБОТИ <ArrowDown size={18} style={{ marginLeft: 8 }} />
                  </a>
                </div>

                <div className="stats-row" style={{ marginTop: 60, background: "none", border: "none" }}>
                  {[
                    { v: "10 мин.", l: "за настройка" },
                    { v: "100%", l: "платени такси" },
                    { v: "30 дни", l: "безплатен период" }
                  ].map((s, i) => (
                    <div key={i} className="stat-col">
                      <div className="stat-v-hero" style={{ fontFamily: "var(--serif-font)" }}>{s.v}</div>
                      <div className="stat-l-hero">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <div id="Системата" style={{ scrollMarginTop: "140px" }}></div>
      <RevealSection>
        <section id="Интерфейс" className="system-section">
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Системата, която работи!</h2>
          </div>
          <InfiniteCarousel onExpand={setExpandedImage} />
        </section>
      </RevealSection>

      <RevealSection>
        <section style={{ padding: "40px 24px", background: "#070C14", textAlign: "center" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="problem-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 24
            }}>
              {[
                { icon: "📅", title: "Административен хаос", desc: "Хартиените списъци и Excel таблиците водят до системни грешки и загуба на време.", color: "#FFB000" },
                { icon: "💸", title: "Нередовни такси", desc: "Липсата на автоматизация при плащанията, води до неприятни разговори с родителите.", color: "var(--neon-green)" },
                { icon: "📊", title: "Липса на контрол", desc: "Край на нерегламентираните отсъствия от тренировъчния процес.", color: "#0080FF" },
                { icon: "📢", title: "Комуникационен шум", desc: "Чат групите са пълни с излишни съобщения, а важната информация се губи.", color: "#FF3E3E" }
              ].map((p, i) => (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.03)",
                  padding: "28px 20px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.05)",
                  transition: "all 0.3s ease",
                  textAlign: "center"
                }}>
                  <div style={{
                    fontSize: 40,
                    marginBottom: 20,
                    display: "flex",
                    justifyContent: "center",
                    filter: `drop-shadow(0 0 10px ${p.color}44)`
                  }}>{p.icon}</div>
                  <h3 style={{ fontSize: 20, color: "#FF3E3E", marginBottom: 12, fontWeight: 800 }}>{p.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="comparison-section">
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>
              <span style={{ color: "#FF3E3E" }}>Настояще</span> / <span style={{ color: "var(--neon-green)" }}>Бъдеще</span>
            </h2>
          </div>
          <div className="comparison-grid">
            <div className="comparison-col col-before">
              <div className="comp-list">
                {COMPARISON.before.map((item, i) => (
                  <div key={i} className="comp-item">
                    <CloseX size={18} className="comp-icon-x" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="comparison-col col-after">
              <div className="comp-list">
                {COMPARISON.after.map((item, i) => (
                  <div key={i} className="comp-item">
                    <Check size={18} className="comp-icon-v" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      {/* VIP section moved to /vip */}
      {/* Функции section moved to /funkcii */}

      {/* <RevealSection>
        <section id="Цени" className="pricing-section" style={{ scrollMarginTop: "100px" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 className="section-title" style={{ fontFamily: "var(--serif-font)", color: "var(--neon-green)" }}>Преференциални условия за първи потребители.</h2>
            <p style={{ color: "#FF3E3E", fontWeight: 700, marginTop: 10 }}>* Свободни места: 5 от общо 10 отбора</p>
          </div>
          <div className="pricing-grid">
            {[
              { base: 44, count: "До 100 деца" },
              { base: 53, count: "До 200 деца", popular: true },
              { base: 71, count: "Над 300 деца" }
            ].map((plan, i) => (
              <div key={i} className={`pricing-card ${plan.popular ? "pricing-card-popular" : ""}`}>
                {plan.popular && <div className="pricing-badge">НАЙ-ПРЕДПОЧИТАН</div>}
                <h3 className="comp-title">{plan.count}</h3>
                <div className="price-box" style={{ marginBottom: 24 }}>
                  <span className="price-val" style={{ fontSize: 48, fontWeight: 900, color: "#fff" }}>
                    {withSchedule ? plan.base + 9 : plan.base}€
                  </span>
                  <span className="price-unit" style={{ fontSize: 14, opacity: 0.5, marginLeft: 8 }}>/ месец</span>
                </div>
                <div className="comp-list" style={{ marginBottom: 32 }}>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Обучение и интеграция</span></div>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Смарт карти за достъп</span></div>
                  <div className="comp-item"><Check size={16} color="var(--neon-green)" /> <span>Партньорски отстъпки</span></div>
                  {withSchedule && <div className="comp-item" style={{ color: "var(--neon-green)" }}><Check size={16} /> <span>Тренировъчен график</span></div>}
                </div>

                <div
                  className="pricing-schedule-toggle"
                  onClick={() => setWithSchedule(!withSchedule)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: withSchedule ? "rgba(57, 255, 20, 0.1)" : "rgba(255,255,255,0.03)",
                    borderRadius: 12,
                    cursor: "pointer",
                    border: `1px solid ${withSchedule ? "rgba(57, 255, 20, 0.3)" : "rgba(255,255,255,0.05)"}`,
                    transition: "all 0.3s ease"
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 20,
                    background: withSchedule ? "var(--neon-green)" : "rgba(255,255,255,0.1)",
                    borderRadius: 20,
                    position: "relative",
                    transition: "all 0.3s ease"
                  }}>
                    <div style={{
                      width: 14,
                      height: 14,
                      background: withSchedule ? "#000" : "#fff",
                      borderRadius: "50%",
                      position: "absolute",
                      top: 3,
                      left: withSchedule ? 19 : 3,
                      transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: withSchedule ? "var(--neon-green)" : "rgba(255,255,255,0.5)" }}>
                    ТРЕНИРОВЪЧЕН ГРАФИК
                  </span>
                </div>

                <a href="#Контакт" className="nav-demo-btn" style={{
                  width: "100%",
                  background: plan.popular ? "var(--neon-green)" : "none",
                  color: plan.popular ? "#000" : "#fff",
                  border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.2)",
                  textDecoration: "none",
                  textAlign: "center",
                  display: "inline-block"
                }}>
                  {plan.popular ? "30 ДНИ БЕЗ ТАКСА" : "ЗАПОЧНИ СЕГА"}
                </a>
              </div>
            ))}
          </div>
        </section>
      </RevealSection> */}

      <RevealSection>
        <section id="Абонаменти" className="new-pricing-section" style={{ scrollMarginTop: "100px" }}>
          <div className="section-container-wide">
            <h2 style={{ fontSize: 42, fontWeight: 800, textAlign: "center", marginBottom: 8 }}>
              <span style={{ background: "linear-gradient(135deg, #39FF14, #00D4FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Абонаменти</span>
            </h2>
            <p style={{ color: "#FF3E3E", fontWeight: 700, fontSize: 18, textAlign: "center", marginBottom: 20, width: "100%" }}>* Свободни места: 1 от общо 10 отбора</p>
            <div className="new-pricing-grid">

              {/* LEFT: Subscription Levels Table */}
              <div className="pricing-table-container">
                <div className="pricing-table-header">АБОНАМЕНТНИ НИВА</div>
                <table className="pricing-modern-table">
                  <thead>
                    <tr>
                      <th>Категория <br /> (Брой деца)</th>
                      <th>Стандартна месечна такса</th>
                      <th className="vip-column-header">
                        <div className="vip-header-content">
                          <Crown size={50} color="#39FF14" />
                          <div>
                            <div className="vip-title">VIP Цена <br /> <span className="vip-subtitle">(Първи 10 отбора)</span></div>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { cat: "0 - 50 деца", old: "35 €", new: "0 €" },
                      { cat: "50 - 100 деца", old: "44 €", new: "17 €" },
                      { cat: "100 - 200 деца", old: "53 €", new: "26 €" },
                      { cat: "200 - 300 деца", old: "62 €", new: "35 €" },
                      { cat: "Над 300 деца", old: "71 €", new: "44 €" },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td>
                          <div className="cat-cell">
                            <Users size={18} color="rgba(131, 102, 102, 0.7)" />
                            {row.cat}
                          </div>
                        </td>
                        <td><span className="old-price-cell">{row.old}</span></td>
                        <td className="vip-price-cell">{row.new}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pricing-disclaimer">
                  *Преференциалните VIP цени са валидни до края на годината единствено за първите 10 клуба, присъединили се към програмата.
                </p>
              </div>

              {/* RIGHT: Additional Modules */}
              <div className="additional-modules-container">
                <div className="pricing-table-header">ДОПЪЛНИТЕЛНИ МОДУЛИ</div>

                <div className="module-box-v2">
                  <div className="module-icon-v2">
                    <Calendar size={28} color="#39FF14" />
                  </div>
                  <div className="module-info-v2">
                    <div className="module-top-row">
                      <h3>+ Интелигентен тренировъчен график</h3>
                      <div className="module-price-tag">+9 € / месец</div>
                    </div>
                    <p className="module-include-label">Включва:</p>
                    <ul className="module-checklist-v2">
                      <li><Check size={14} /> Онлайн график на тренировките</li>
                      <li><Check size={14} /> Следене на присъствия</li>
                      <li><Check size={14} /> Автоматични известия към родители</li>
                    </ul>
                  </div>
                </div>

                <div className="module-box-v2">
                  <div className="module-icon-v2">
                    <Puzzle size={28} color="#39FF14" />
                  </div>
                  <div className="module-info-v2">
                    <div className="module-top-row">
                      <h3>+ Модул „Разширяване“</h3>
                      <div className="module-offer-text">
                        Персонална оферта <br />
                        <span>след индивидуална консултация</span>
                      </div>
                    </div>
                    <p className="module-include-label">Подходящ за:</p>
                    <ul className="module-checklist-v2">
                      <li><Check size={14} /> Клубове с множество филиали</li>
                      <li><Check size={14} /> Маркетинг и привличане на нови състезатели</li>
                      <li><Check size={14} /> Разширено управление и анализи</li>
                    </ul>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>
      </RevealSection>
      
      <RevealSection>
        <section id="Контакт" ref={contactRef} style={{ padding: "40px 24px", background: `linear-gradient(180deg,#09101C 0%,${BG} 100%)`, scrollMarginTop: "100px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div className="section-tag-light" style={{ marginBottom: 8 }}>◆ ЗАЯВЕТЕ ДЕМО И 30 ДНИ БЕЗ ТАКСА</div>
              <div style={{ color: "#FF3E3E", fontSize: 12, fontWeight: 800, letterSpacing: 2, marginBottom: 24, textTransform: "uppercase", display: "flex", justifyContent: "center" }}>БЕЗ ОБВЪРЗВАНЕ</div>
              <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Получете детайлна оферта до 24 часа.</h2>
            </div>
            <LeadForm onSuccess={() => setShowSuccess(true)} />
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section style={{ padding: "40px 24px", background: "radial-gradient(circle at center, #0B1628 0%, #070C14 100%)", textAlign: "center" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>

            <button
              onClick={() => setBenefitsOpen(!benefitsOpen)}
              className="benefits-toggle-btn"
              style={{
                background: "linear-gradient(135deg, var(--neon-green), #20C020)",
                color: "#000",
                border: "none",
                borderRadius: 12,
                padding: "16px 36px",
                fontFamily: "'Exo 2', sans-serif",
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: 1,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                boxShadow: benefitsOpen
                  ? "0 0 55px rgba(57, 255, 20, 0.7)"
                  : "0 0 30px rgba(57, 255, 20, 0.4)",
                transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
                userSelect: "none"
              }}
            >
              ПОЛЗИ ЗА РОДИТЕЛИТЕ
              <span style={{
                fontSize: 20,
                lineHeight: 1,
                transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: benefitsOpen ? "rotate(180deg)" : "rotate(0deg)",
                display: "inline-block"
              }}>▾</span>
            </button>

            <div style={{
              maxHeight: benefitsOpen ? "2000px" : "0",
              opacity: benefitsOpen ? 1 : 0,
              overflow: "hidden",
              transition: "all 1s cubic-bezier(0.4, 0, 0.2, 1)",
              textAlign: "left",
              marginTop: benefitsOpen ? 60 : 0
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>
                {[
                  { icon: "🎁", text: "Отстъпки в различни търговски вериги (Sport Depot и други)", desc: "Спестявайте от спортна екипировка, обувки и аксесоари чрез партньорската ни мрежа." },
                  { icon: "📱", text: "Проследяване на тренировки и плащания в реално време", desc: "Пълен контрол през вашето мобилно устройство без нужда от излишни обаждания." },
                  { icon: "💳", text: "Смарт карта, която се изплаща сама чрез спестени средства", desc: "Уникална дигитална карта, която ви носи реална добавена стойност всеки месец." }
                ].map((item, i) => (
                  <div key={i} className="benefit-card">
                    <div style={{
                      fontSize: 32,
                      width: 64,
                      height: 64,
                      background: "rgba(57, 255, 20, 0.05)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      border: "1px solid rgba(57, 255, 20, 0.1)"
                    }}>{item.icon}</div>
                    <div className="benefit-card-content">
                      <h4 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--neon-green)" }}>{item.text}</h4>
                      <p style={{ color: "rgba(255,255,255,0.5)", lineHeight: 1.6, fontSize: 16 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section id="Партньори" style={{ padding: "40px 24px", background: "rgba(255,255,255,0.01)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div className="section-tag-light">МРЕЖА ОТ ПАРТНЬОРИ</div>
              <h2 className="section-title" style={{ fontFamily: "var(--serif-font)" }}>Добавена стойност за всеки член.</h2>
              <p style={{ color: "rgba(255,255,255,0.4)" }}>Вашият клуб получава достъп до преференциални условия при подбрани брандове.</p>
            </div>

            <div className="partners-list-modern">
              {PARTNERS.map(p => (
                <div key={p.name} className="partner-item-minimal">
                  <div className="partner-logo-wrapper">
                    <img src={p.logo} alt={p.name} className="partner-logo-large" />
                  </div>
                  <div className="partner-info-minimal">
                    <div className="partner-name-minimal">{p.name}</div>
                    <div className="partner-disc-minimal" style={{ color: "#FF3E3E" }}>{p.disc} ОТСТЪПКА</div>
                    <div style={{ marginTop: 20, color: "rgba(255,255,255,0.2)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
                      + специални условия в широка мрежа от партньори
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <RevealSection>
        <section className="partners-strip-section" style={{ borderTop: "1px solid rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.03)", padding: "30px 0" }}>
          <div className="partners-marquee-outer">
            <div className="partners-marquee-track">
              {Array(10).fill(ALL_PARTNERS).flat().map((p, i) => (
                <div className="partner-marquee-item" key={i}>
                  <img src={p.logo} alt={p.name} className="partner-marquee-logo" />
                  <span className="partner-marquee-name">{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>

      <footer className="main-footer">
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 32,
          marginBottom: 16,
        }}>
          <Link href="/privacy" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}>ЗАЩИТА НА ЛИЧНИ ДАННИ</Link>
          <Link href="/terms" style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}>ОБЩИ УСЛОВИЯ</Link>
        </div>

        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: 32,
          marginBottom: 32,
          paddingBottom: 32,
          borderBottom: "1px solid rgba(255,255,255,0.03)"
        }}>
          <a href="tel:0896495254" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>0896 495 254</a>
          <a href="mailto:office@myteam7.com" style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontWeight: 600, textDecoration: "none", transition: "color 0.2s" }} onMouseOver={e => e.currentTarget.style.color = "var(--neon-green)"} onMouseOut={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>office@myteam7.com</a>
        </div>

        <div className="footer-container">
          <div className="footer-logo">
            <img src="/myteam-logo.webp" alt="MyTeam Logo" style={{ height: 50, width: "auto" }} />
          </div>
          <div className="footer-copyright">
            © 2026 MyTeam. Всички права запазени.
          </div>
          <div className="footer-dots">
            {[G, B, G].map((c, i) => (
              <div key={i} className="footer-dot" style={{ background: c, animationDelay: `${i * 0.3}s` }} />
            ))}
          </div>
        </div>

        <div style={{
          marginTop: 40,
          textAlign: "center",
          fontSize: 10,
          color: "rgba(255,255,255,0.1)",
          textTransform: "uppercase",
          letterSpacing: 2,
          borderTop: "1px solid rgba(255,255,255,0.03)",
          paddingTop: 20
        }}>
          ◆ Powered by moozuk22 ◆
        </div>
      </footer>

      <div className="mobile-fab-dock">
        <div className={`fab-left-wing ${showDockActions ? "" : "dock-hidden-actions"}`}>
          <a href="tel:0896495254" className="fab-circle call-fab" title="Call Us">
            <PhoneCall size={26} color="#000" />
          </a>
        </div>

        <div className="fab-right-wing">
          <ChatBot scrollToContact={() => contactRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} />
          <div className={`${showDockActions ? "" : "dock-hidden-actions"}`} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <a href="viber://chat?number=%2B359896495254" className="fab-circle viber-fab" title="Viber">
              <img src="/viber.webp" alt="Viber" style={{ width: 50, height: 50, objectFit: "contain" }} />
            </a>
          </div>
        </div>
      </div>

    </>
  );
}
