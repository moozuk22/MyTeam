"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, HelpCircle, Cpu, Tag, MessageSquare, X as CloseX } from "lucide-react";

export default function NavBar() {
  const [scrolled, setScrolled] = useState(false);
  const [showBtn, setShowBtn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const activeSection =
    pathname === "/zashto"   ? "Защо"    :
    pathname === "/funkcii"  ? "Функции" : "";

  useEffect(() => {
    const h = () => {
      setScrolled(window.scrollY > 40);
      setShowBtn(window.scrollY > 450);
    };
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.classList.add("menu-open-active");
    } else {
      document.body.classList.remove("menu-open-active");
    }
  }, [isMenuOpen]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navItems = [
    { id: "Начало", href: "/", text: "Начало", icon: Home, index: "00" },
    { id: "Защо", href: "/zashto", text: "Защо MyTeam", icon: HelpCircle, index: "01" },
    { id: "Функции", href: "/funkcii", text: "Функции", icon: Cpu, index: "02" },
  ];

  return (
    <nav className={`navbar ${scrolled ? "navbar-scrolled" : ""} ${isMenuOpen ? "navbar-open" : ""}`}>
      <div className="navbar-container">
        <Link href="/" className="navbar-logo">
          <img
            src="/myteam-logo.webp"
            alt="MyTeam Logo"
            className="nav-logo-img"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </Link>

        {/* Mobile Burger Toggle */}
        <button className="burger-menu" onClick={toggleMenu} aria-label="Menu">
          <div className="burger-bar" />
          <div className="burger-bar" />
          <div className="burger-bar" />
        </button>

        {/* Full Screen Mobile Menu */}
        <div className={`nav-links-wrapper ${isMenuOpen ? "links-open" : ""}`}>
          <div className="mobile-menu-header">
            <img src="/myteam-logo.webp" alt="MyTeam Logo" className="mobile-nav-logo" />
            <button className="close-menu-btn" onClick={() => setIsMenuOpen(false)}>
              <CloseX size={32} color="#fff" />
            </button>
          </div>

          <div className="nav-links-container">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  <span className="nav-index">{item.index}</span>
                  <Icon size={18} className="nav-icon" />
                  <span className="nav-text">{item.text}</span>
                </a>
              );
            })}

            <Link
              href="/#Контакт"
              className={`nav-demo-btn nav-desktop-cta ${!showBtn ? "cta-hidden" : ""}`}
            >
              БЕЗПЛАТНА ВИДЕО КОНСУЛТАЦИЯ
            </Link>
          </div>

          <div className="mobile-menu-footer">
            <Link href="/#Контакт" onClick={() => setIsMenuOpen(false)} className="nav-demo-btn">
              БЕЗПЛАТНА ВИДЕО КОНСУЛТАЦИЯ
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
