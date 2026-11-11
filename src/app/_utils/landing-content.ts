import { Fingerprint, LayoutGrid, BadgePercent, CreditCard, Users, ShieldCheck } from "lucide-react";

export const G = "#39FF14";

export const B = "#39FF14";

export const BG = "#070C14";

const CARD = "#0D1520";

export type LandingClub = {
  id: number; name: string; color: string; abbr: string;
  x: number; y?: number; z: number; mobileX?: number; mobileZ?: number;
  athletes: number; months: number; fees: number; city: string; sport: string; showMobile?: boolean;
};

export type CarouselImage = { src: string; alt: string };

export const CLUBS: LandingClub[] = [
  { id: 1, name: "Real Madrid", color: "#FFFFFF", abbr: "RM", x: 820, z: 0, mobileX: 0, mobileZ: -800, athletes: 168, months: 24, fees: 97, city: "Madrid", sport: "Football" },
  { id: 2, name: "Manchester City", color: "#6CABDD", abbr: "MC", x: 580, z: -320, mobileX: -380, mobileZ: -550, athletes: 122, months: 18, fees: 94, city: "Manchester", sport: "Football" },
  { id: 3, name: "Liverpool FC", color: "#C8102E", abbr: "LFC", x: 580, z: 0, mobileX: 380, mobileZ: -550, athletes: 134, months: 16, fees: 93, city: "Liverpool", sport: "Football" },
  { id: 5, name: "Manchester Utd", color: "#DA291C", abbr: "MUFC", x: 320, z: -350, mobileX: 180, mobileZ: -250, athletes: 141, months: 22, fees: 91, city: "Manchester", sport: "Football" },
  { id: 6, name: "Chelsea FC", color: "#034694", abbr: "CFC", x: 320, z: 0, mobileX: -180, mobileZ: -250, athletes: 119, months: 14, fees: 92, city: "London", sport: "Football" },
  { id: 8, name: "B. Dortmund", color: "#FDE100", abbr: "BVB", x: 100, z: 0, mobileX: -180, mobileZ: 250, athletes: 111, months: 13, fees: 94, city: "Dortmund", sport: "Football" },
  { id: 16, name: "AC Milan", color: "#FB090B", abbr: "ACM", x: -100, z: 0, mobileX: 180, mobileZ: 250, athletes: 127, months: 19, fees: 95, city: "Milan", sport: "Football" },
  { id: 13, name: "Juventus", color: "#FFFFFF", abbr: "JUV", x: -320, z: -350, mobileX: 380, mobileZ: 550, athletes: 118, months: 16, fees: 91, city: "Turin", sport: "Football" },
  { id: 9, name: "FC Barcelona", color: "#A70042", abbr: "FCB", x: -820, z: 0, mobileX: 0, mobileZ: 800, athletes: 172, months: 25, fees: 96, city: "Barcelona", sport: "Football" },
  { id: 10, name: "Bayern Munich", color: "#DC052D", abbr: "FCBM", x: -580, z: -320, mobileX: -380, mobileZ: 550, athletes: 145, months: 20, fees: 97, city: "Munich", sport: "Football" },

  // HIDDEN ON MOBILE
  { id: 4, name: "Arsenal FC", color: "#EF0107", abbr: "ARS", x: 580, z: 320, showMobile: false, athletes: 116, months: 15, fees: 95, city: "London", sport: "Football" },
  { id: 7, name: "Tottenham", color: "#FFFFFF", abbr: "TOT", x: 320, z: 350, showMobile: false, athletes: 103, months: 12, fees: 90, city: "London", sport: "Football" },
  { id: 11, name: "Paris SG", color: "#004170", abbr: "PSG", x: -580, z: 0, showMobile: false, athletes: 125, months: 17, fees: 93, city: "Paris", sport: "Football" },
  { id: 12, name: "Atletico Madrid", color: "#CB3524", abbr: "ATM", x: -580, z: 320, showMobile: false, athletes: 109, months: 15, fees: 92, city: "Madrid", sport: "Football" },
  { id: 14, name: "Inter Milan", color: "#0068A8", abbr: "INT", x: -320, z: 0, showMobile: false, athletes: 121, months: 15, fees: 94, city: "Milan", sport: "Football" },
  { id: 15, name: "Napoli", color: "#003E7E", abbr: "NAP", x: -320, z: 350, showMobile: false, athletes: 99, months: 11, fees: 89, city: "Naples", sport: "Football" }
];

const FEATURES = [
  {
    id: 1, icon: Fingerprint, color: G,
    title: "Турникет Достъп",
    short: "Автоматичен контрол на влизането чрез QR код или чип.",
    details: "Интегрирана система за контрол на достъпа, която позволява влизане само на активни членове с платени вноски.",
    benefits: ["Автоматична верификация на членството", "Намаляване на грешките при ръчна проверка", "Real-time статистика за посещаемостта", "Блокиране на достъп при неизплатени вноски"],
    requiresSub: true
  },
  {
    id: 2, icon: ShieldCheck, color: B,
    title: "Дисциплинарен Панел",
    short: "Пълна история на нарушенията и наказанията.",
    details: "Уникална функционалност за проследяване на поведението и спазването на клубните правила.",
    benefits: ["Дигитален архив на нарушенията", "Автоматично уведомяване на треньори и родители", "Проследяване на рецидиви", "BFS Compliance за спортни федерации"],
    requiresSub: false
  },
  {
    id: 3, icon: BadgePercent, color: G,
    title: "Партньорска Мрежа",
    short: "Ексклузивни отстъпки в Sport Depot и други.",
    details: "Вашият клуб получава достъп до преференциални условия при лидери като Sport Depot и други подбрани брандове.",
    benefits: ["Директна отстъпка от -10%", "Широка мрежа от физически обекти", "Смарт карта за лесна идентификация", "Ползи за родителите и атлетите"],
    requiresSub: true
  },
  {
    id: 4, icon: CreditCard, color: B,
    title: "Плащания",
    short: "Ръчно проследяване на месечните такси.",
    details: "Системата позволява бързо отразяване на плащанията, като автоматично виждате статуса на всеки член.",
    benefits: ["Ръчно маркиране на вноски", "Бърза проверка на задълженията", "Пълна финансова прозрачност", "История на плащанията"],
    requiresSub: true
  },
  {
    id: 5, icon: Users, color: G,
    title: "Squad Intelligence",
    short: "Управление на състави, тренировки и мачове.",
    details: "Всичко необходимо за треньора на едно място. Планиране на тренировъчния процес и тактически бележки.",
    benefits: ["Централизирана база данни за състезатели", "Присъствени листове с един клик", "Календар на събитията и мачовете", "Директна комуникация с отбора"],
    requiresSub: false
  },
  {
    id: 6, icon: LayoutGrid, color: B,
    title: "Клубно Табло",
    short: "Цялостен поглед върху здравето на клуба.",
    details: "Изпълнителен дашборд с ключови показатели за представянето на всяка възрастова група.",
    benefits: ["Визуализация на данните в реално време", "Сравнителен анализ на групите", "Експорт на отчети за ръководството", "Бърз достъп до критична информация"],
    requiresSub: false
  }
];

const PROBLEMS = [
  { icon: "📓", title: "Хаос с тефтери", desc: "Различни списъци и Excel-и водят до грешки и загубено време. MyTeam дигитализира всичко." },
  { icon: "💸", title: "Нередовни плащания", desc: "Родителите забравят или закъсняват с таксите. Системата проследява всичко автоматично." },
  { icon: "📊", title: "Липса на контрол", desc: "Нямаш ясна представа кой е платил и кой не. С MyTeam виждаш статуса на всеки член." },
  { icon: "🧠", title: "Сложно планиране", desc: "Ръчното разпределение на групи и графици е трудно. Нашата система го прави вместо Вас." },
  { icon: "📢", title: "Трудна комуникация", desc: "Разпръснати съобщения във Viber и Messenger? MyTeam централизира връзката с родителите." },
  { icon: "📂", title: "Загуба на история", desc: "Състезатели напускат, а данните им изчезват? Пазете пълна история на всяко дете години наред." }
];

export const COMPARISON = {
  before: [
    "Управление с хартиени списъци",
    "Ръчно проследяване на такси",
    "Никакви ползи за родителите",
    "Тренировъчен график във Viber/WhatsApp"
  ],
  after: [
    "Цялостно дигитално управление",
    "Автоматично проследяване на такси",
    "Отстъпки в Sport Depot и други",
    "Интелигентен тренировъчен график"
  ]
};

export const PARTNERS = [
  { name: "Sport Depot", abbr: "SD", color: "#FF6B00", disc: "-10%", logo: "/sd-logo.webp" }
];

export const ALL_PARTNERS = [
  { name: "Sport Depot", logo: "/sd-logo.webp" },
  { name: "Мебели НИКО", logo: "/niko-logo.webp" },
  { name: "Dalida Dance Show", logo: "/dalida-logo.webp" },
  { name: "Inline Body", logo: "/idb-logo.svg" }
];

export const CAROUSEL_IMAGES: CarouselImage[] = [
  { src: "/1.webp", alt: "MyTeam Interface — Dashboard" },
  { src: "/2.webp", alt: "MyTeam Interface — Players Management" },
  { src: "/3.webp", alt: "MyTeam Interface — Reports & Analytics" },
  { src: "/4.webp", alt: "MyTeam Interface — Schedule" },
  { src: "/5.webp", alt: "MyTeam Interface — Smart Access" },
  { src: "/6.webp", alt: "MyTeam Interface — Smart" },
];

export type LandingFeature = (typeof FEATURES)[number];
