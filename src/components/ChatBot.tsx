"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, ArrowRight, User } from "lucide-react";
import "./ChatBot.css";

const CHAT_STAGES = {
  HOOK: 0,
  OPTIONS: 1,
  REPLY: 2,
  CUSTOM_INPUT: 3,
  CTA: 4
};

const OPTIONS = [
  {
    id: "fees",
    text: "Навременно събиране на месечни такси",
    reply: "Разбираме Ви! My Team гарантира 100% платени такси чрез автоматизирано проследяване и напомняния. Край на неудобните разговори с родителите – системата върши работата вместо Вас. 💸"
  },
  {
    id: "schedule",
    text: "Лесно организиране на тренировъчен график",
    reply: "Забравете за хаоса! С My Team имате интелигентен онлайн график, достъпен за всички треньори и родители в реално време. Промените стават за секунди, а всички са информирани моментално. 📅"
  },
  {
    id: "communication",
    text: "Преход от безкрайни съобщения към тишина и фокус",
    reply: "С My Team родителите отбелязват отсъствия с един клик, а Вашата Viber група най-после спира да вибрира денонощно. Важната информация вече не се губи в чата."
  },
  {
    id: "discounts",
    text: "Бонуси и отстъпки за членовете",
    reply: "Това е нашият коз! 🃏 Вашите членове получават смарт карти, които им осигуряват 10% отстъпка в Sport Depot и други обекти. Така софтуерът се изплаща сам и родителите Ви обичат още повече!"
  },
  {
    id: "other",
    text: "Друго",
    reply: "Вашите нужди са специфични и ние уважаваме това! My Team предлага функции по задание на клиента. Моля, напишете ни накратко какво търсите и Вашето име и телефон. Ще се свържем с Вас с персонално решение."
  }
];

export default function ChatBot({ scrollToContact }: { scrollToContact: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [stage, setStage] = useState(CHAT_STAGES.HOOK);
  const [messages, setMessages] = useState<{ sender: "bot" | "user", text: string | React.ReactNode, id: number }[]>([]);
  const [hasMounted, setHasMounted] = useState(false);
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customForm, setCustomForm] = useState({ needs: "", name: "", phone: "" });
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasMounted(true);
    setMessages([{ sender: "bot", text: "Здравейте! 👋 My Team е тук, за да направи управлението на Вашия клуб по-лесно. Кое от изброените е най-голямото Ви предизвикателство в момента?", id: 1 }]);
  }, []);

  const handleRestartChat = () => {
    setStage(CHAT_STAGES.HOOK);
    setMessages([{ sender: "bot", text: "Здравейте! 👋 My Team е тук, за да направи управлението на Вашия клуб по-лесно. Кое от изброените е най-голямото Ви предизвикателство в момента?", id: 1 }]);
    setSelectedOption(null);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, stage, isTyping, isOpen]);

  useEffect(() => {
    if (stage === CHAT_STAGES.HOOK && isOpen) {
      const timer = setTimeout(() => {
        setStage(CHAT_STAGES.OPTIONS);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [stage, isOpen]);

  const handleOptionClick = (optionId: string) => {
    const selected = OPTIONS.find(o => o.id === optionId);
    if (!selected) return;

    setSelectedOption(optionId);
    setMessages(prev => [...prev, { sender: "user", text: selected.text, id: prev.length + 1 }]);
    setStage(CHAT_STAGES.REPLY);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: "bot", text: selected.reply, id: prev.length + 1 }]);
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, { 
            sender: "bot", 
            text: "Искате ли да видите как My Team ще реши това за Вас? В момента имаме само 5 свободни места за 30-дневен гратисен период!",
            id: prev.length + 1
          }]);
          setStage(CHAT_STAGES.CTA);
        }, 1500);
      }, 1500);
    }, 1500);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customForm.needs || !customForm.name || !customForm.phone) return;

    setMessages(prev => [...prev, { 
      sender: "user", 
      text: `Нужди: ${customForm.needs}\nИме: ${customForm.name}\nТелефон: ${customForm.phone}`,
      id: prev.length + 1
    }]);

    setStage(CHAT_STAGES.REPLY);
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { 
        sender: "bot", 
        text: "Благодарим Ви! Наш представител ще се свърже с Вас съвсем скоро с персонализирано предложение.",
        id: prev.length + 1
      }]);
    }, 1500);
  };

  if (!hasMounted) return null;

  return (
    <>
      <button 
        className={`chat-toggle-pill ${isOpen ? 'hidden' : ''}`}
        onClick={() => setIsOpen(true)}
      >
        <div className="chat-toggle-avatar">
          <img src="/myteam-logo.png" alt="Bot" />
        </div>
        <span className="chat-toggle-text">MyTeam Асистент</span>
        <span className="status-dot-pulse"></span>
      </button>

      {isOpen && createPortal(
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar">
                <img src="/myteam-logo.png" alt="MyTeam Bot" className="chat-avatar-img" />
              </div>
              <div>
                <div className="chat-name">MyTeam Асистент</div>
                <div className="chat-status">
                  <span className="status-dot"></span>
                  Очаква вашия отговор
                </div>
              </div>
            </div>
            <button className="chat-close-btn" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>
          
          <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble-wrapper ${msg.sender === "user" ? "user" : "bot"}`}>
            {msg.sender === "bot" && (
               <div className="chat-bubble-avatar">
                 <img src="/myteam-logo.png" alt="MyTeam Bot" />
               </div>
            )}
            <div className={`chat-bubble ${msg.sender === "user" ? "user-bubble" : "bot-bubble"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="chat-bubble-wrapper bot">
            <div className="chat-bubble-avatar">
              <img src="/myteam-logo.png" alt="MyTeam Bot" />
            </div>
            <div className="chat-bubble bot-bubble typing-bubble">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        {stage === CHAT_STAGES.OPTIONS && !isTyping && (
          <div className="chat-options">
            {OPTIONS.map((opt) => (
              <button 
                key={opt.id} 
                className="chat-option-btn"
                onClick={() => handleOptionClick(opt.id)}
              >
                {opt.text}
              </button>
            ))}
          </div>
        )}

        {stage === CHAT_STAGES.CTA && !isTyping && (
          <div className="chat-cta-actions">
            <a href="tel:0896495254" className="chat-btn-primary">
              📞 Обади се за бърза консултация
            </a>
            <button onClick={() => {
              setIsOpen(false);
              scrollToContact();
            }} className="chat-btn-secondary">
              📝 Попълни формата за демо
            </button>
            <button onClick={handleRestartChat} className="chat-btn-secondary">
              🔄 Започни отначало
            </button>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
        </div>
      , document.body)}
    </>
  );
}
