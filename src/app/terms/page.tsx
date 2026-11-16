"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import "../legal.css";

export default function TermsOfService() {
    useEffect(() => {
        if (!window.location.hash) window.scrollTo({ top: 0, behavior: "instant" });
    }, []);
    return (
        <div className="legal-container fade-in">
            <div className="legal-header">
                <Link href="/" className="back-link">
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                        <path d="M19 12H5M12 19l-7-7 7-7"></path>
                    </svg>
                    Назад
                </Link>
                <h1 className="text-green-accent">Общи условия</h1>
                <p className="last-updated">Последна актуализация: 3 април 2026 г.</p>
            </div>

            <div className="legal-content card">
                <section>
                    <h2>1. ПРЕДМЕТ НА ОБЩИТЕ УСЛОВИЯ</h2>
                    <p>
                        Настоящите Общи условия уреждат взаимоотношенията между спортния клуб и Потребителите (членове на клуба) при използването на софтуерната система &quot;My Team&quot; (Системата) за управление на членства, присъствия и плащания.
                    </p>
                </section>

                <section>
                    <h2>2. ИЗПОЛЗВАНЕ НА СИСТЕМАТА И NFC КАРТИ</h2>
                    <p>Достъпът до услугите на клуба и идентификацията в Системата се извършват чрез персонални NFC членски карти:</p>
                    <ul>
                        <li>Членските карти са индивидуални и не подлежат на преотстъпване на трети лица под каквато и да е форма.</li>
                        <li>Потребителят е длъжен да сканира своята карта при всяко посещение за валидиране на достъпа и отчет на присъствието.</li>
                        <li>Потребителят се задължава да предоставя актуална, пълна и точна информация при първоначалната регистрация и издаването на картата.</li>
                    </ul>
                </section>

                <section>
                    <h2>3. ПРАВА И ЗАДЪЛЖЕНИЯ НА ПОТРЕБИТЕЛЯ</h2>
                    <p>Потребителят има право да използва Системата съобразно нейното предназначение. Потребителят е длъжен:</p>
                    <ul>
                        <li>Да пази своята NFC карта от загуба, кражба или физическа повреда.</li>
                        <li>Да информира незабавно Клуба при загуба на картата с цел нейното деактивиране.</li>
                        <li>Да не прави опити за неоторизиран достъп до софтуерните ресурси на Системата.</li>
                    </ul>
                </section>

                <section>
                    <h2>4. ПРАВА И ЗАДЪЛЖЕНИЯ НА КЛУБА</h2>
                    <p>Клубът се задължава да осигури нормалното функциониране на Системата. Клубът има право:</p>
                    <ul>
                        <li>Да ограничи или прекрати достъпа на Потребител при нарушение на Общите условия или вътрешните правила на Клуба.</li>
                        <li>Да актуализира Системата, да променя дизайна или да добавя нови функционалности по всяко време без предварително известие.</li>
                    </ul>
                </section>

                <section>
                    <h2>5. ПЛАЩАНИЯ И ЧЛЕНСКИ ВНОС</h2>
                    <p>Използването на Системата е обвързано с поддържането на активно членство в Клуба:</p>
                    <ul>
                        <li>Членският внос се заплаща съгласно актуалната тарифа на Клуба.</li>
                        <li>При неплащане или забавяне на плащането, Системата автоматично маркира статуса на Потребителя като &quot;Просрочен&quot; и може да ограничи достъпа му до тренировки и участия.</li>
                    </ul>
                </section>

                <section>
                    <h2>6. ОГРАНИЧАВАНЕ НА ОТГОВОРНОСТТА</h2>
                    <p>Клубът не носи отговорност за:</p>
                    <ul>
                        <li>Технически неизправности в Системата, причинени от външни фактори (интернет свързаност, прекъсвания в захранването и др.).</li>
                        <li>Върнати или отказани трансакции от външни платежни процесори.</li>
                        <li>Временни прекъсвания в достъпа поради планова техническа поддръжка.</li>
                    </ul>
                </section>

                <section>
                    <h2>7. ПРЕКРАТЯВАНЕ</h2>
                    <p>Достъпът до Системата се прекратява автоматично при отпадане на основанието за членство в Клуба, по искане на Потребителя или едностранно от Клуба при системни нарушения.</p>
                </section>

                <section>
                    <h2>8. ПРОМЕНИ В ОБЩИТЕ УСЛОВИЯ</h2>
                    <p>Клубът си запазва правото да променя настоящите Общи условия по всяко време. Промените влизат в сила от момента на публикуването им в Системата. Потребителите се считат за уведомени чрез актуализацията на датата на последна промяна.</p>
                </section>

                <section>
                    <h2>9. ЛИЧНИ ДАННИ</h2>
                    <p>Личните данни на Потребителите се обработват съгласно действащата Политика за поверителност на &quot;My Team&quot;, която е неразделна част от настоящите условия.</p>
                </section>

                <section>
                    <h2>10. ПРИЛОЖИМО ПРАВО</h2>
                    <p>За всички неуредени от настоящите Общи условия въпроси се прилага действащото българско законодателство. Всички спорове ще се решават по пътя на преговорите, а при невъзможност – от компетентния български съд.</p>
                </section>

                <section id="credits">
                    <h2>Авторство</h2>
                    <p>
                        Икона „Ball“ от Icuk Yulianti,{" "}
                        <a href="https://thenounproject.com/browse/icons/term/ball/">Noun Project</a>{" "}
                        (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
                    </p>
                    <p>
                        Икона „Football goal“ от Mark Caron, оцветена в редактора,{" "}
                        <a href="https://thenounproject.com/icon/football-goal-2451562/">Noun Project</a>{" "}
                        (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
                    </p>
                    <p>
                        Икона „Flag“ от NAPISAH, оцветена в редактора,{" "}
                        <a href="https://thenounproject.com/icon/flag-6452452/">Noun Project</a>{" "}
                        (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
                    </p>
                    <p>
                        Икона „Hula Hoop“ от omeneko, оцветена в редактора,{" "}
                        <a href="https://thenounproject.com/icon/hula-hoop-3437627/">Noun Project</a>{" "}
                        (<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>).
                    </p>
                    <p>
                        <a href="https://www.flaticon.com/free-icon/barrier_1540543">Barrier icon designed by Magnific from Flaticon</a>.
                        {" "}Иконата се използва за „Стена“ и е изрязана до една фигура за „Манекен“.
                    </p>
                    <p>
                        <a href="https://www.flaticon.com/free-icon/cone_1505455">Cone icon designed by Smashicons from Flaticon</a>.
                    </p>
                    <p>
                        <a href="https://www.flaticon.com/free-icon/stairs_4212592">Stairs icon designed by Magnific from Flaticon</a>.
                    </p>
                    <p>
                        <a href="https://www.flaticon.com/free-icon/hurdle_11798797">Hurdle icon designed by Rudy_wae from Flaticon</a>.
                        {" "}Иконата е изрязана до едно препятствие.
                    </p>
                    <p>
                        <a href="https://www.flaticon.com/free-icon/sport_17228453">Sport icon designed by ICs Icons from Flaticon</a>.
                        {" "}Иконата е оцветена в редактора за „Шапка“.
                    </p>
                </section>
            </div>
        </div>
    );
}
