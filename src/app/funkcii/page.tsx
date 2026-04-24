// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import "../page.css";
import NavBar from "@/components/NavBar";
import { Users, CreditCard, IdCard, BarChart3, Calendar, ChevronDown } from "lucide-react";

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

export default function FunkciiPage() {
  const [activeFeature, setActiveFeature] = useState(1);

  return (
    <>
      <NavBar />
      <RevealSection>
        <section id="Функции" className="features-accordion-section" style={{ padding: "80px 24px", background: "#070C14", scrollMarginTop: "100px", paddingTop: "160px" }}>
          <div className="section-container-wide" style={{ maxWidth: 800 }}>
            <div className="section-header-centered" style={{ marginBottom: 60 }}>
              <h2 className="section-title-premium">Всичко, от което се нуждаеш.<br /><span style={{ color: "var(--neon-green)", fontStyle: "italic" }}>Нищо излишно.</span></h2>
            </div>

            <div className="accordion-container">
              {[
                { id: 1, t: "Управление на деца, групи и треньори", d: "Пълен дигитален регистър на всички членове на клуба. Разпределяйте състезатели в групи и следете работата на всеки треньор с един клик.", i: <Users size={24} /> },
                { id: 2, t: "Автоматично проследяване на плащания", d: "Край на закъснелите такси. Системата автоматично отчита плащанията и генерира напомняния за родителите.", i: <CreditCard size={24} /> },
                { id: 3, t: "Смарт карти за достъп и контрол", d: "Интеграция с физически или дигитални карти. Следете присъствието в реално време и контролирайте достъпа до базата.", i: <IdCard size={24} /> },
                { id: 4, t: "Отчети в реално време", d: "Вижте пълната картина на финансите и спортните резултати чрез подробни аналитични графики и справки.", i: <BarChart3 size={24} /> },
                { id: 5, t: "Интелигентен тренировъчен график", d: "Автоматизирано планиране на графиците за тренировки, съобразено с капацитета на залите и заетостта на треньорите.", i: <Calendar size={24} /> }
              ].map((f) => (
                <div key={f.id} className={`accordion-item ${activeFeature === f.id ? "accordion-active" : ""}`}
                  onClick={() => setActiveFeature(activeFeature === f.id ? null : f.id)}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 16,
                    marginBottom: 12,
                    cursor: "pointer",
                    overflow: "hidden",
                    transition: "all 0.3s ease"
                  }}>
                  <div className="accordion-trigger" style={{
                    padding: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ color: activeFeature === f.id ? "var(--neon-green)" : "rgba(255,255,255,0.4)" }}>{f.i}</div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: activeFeature === f.id ? "#fff" : "rgba(255,255,255,0.7)" }}>{f.t}</h3>
                    </div>
                    <div style={{
                      transition: "transform 0.3s ease",
                      transform: activeFeature === f.id ? "rotate(180deg)" : "rotate(0deg)",
                      color: activeFeature === f.id ? "var(--neon-green)" : "rgba(255,255,255,0.2)"
                    }}>
                      <ChevronDown size={20} />
                    </div>
                  </div>
                  <div className="accordion-content" style={{
                    maxHeight: activeFeature === f.id ? "200px" : "0",
                    opacity: activeFeature === f.id ? 1 : 0,
                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                    padding: activeFeature === f.id ? "0 24px 24px 64px" : "0 24px 0 64px",
                    color: "rgba(255,255,255,0.5)",
                    lineHeight: 1.6
                  }}>
                    {f.d}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </RevealSection>
    </>
  );
}
