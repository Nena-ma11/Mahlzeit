"use client";
import Image from "next/image";
import { useState } from "react";
import osfizio from "../data/osfizio.json";
import frugavital from "../data/frugavital.json";
import interspar from "../data/interspar.json";
import lercherl from "../data/lercherl.json";

type MenuItem = {
  name?: string;
  description: string;
  price: number | null;
};

type DayData = {
  date: string;
  day: string | null;
  menus: MenuItem[];
  soup?: string;
};

type RestaurantData = {
  restaurant: string;
  source?: string;
  fetchedAt?: string;
  days: DayData[];
};

type Restaurant = {
  name: string;
  description: string;
  source: string;
  data: RestaurantData;
};

const restaurants: Restaurant[] = [
  {
    name: "O'Sfizio",
    description: "Mittagsmenü",
    source: "https://www.osfizio.at/mittagsmenus/",
    data: osfizio,
  },
  {
    name: "Fruga Vital",
    description: "Wochenmenü",
    source: "https://frugavital.at/",
    data: frugavital,
  },
  {
    name: "INTERSPAR Jörgerstraße",
    description: "Restaurant-Menü",
    source:
      "https://www.interspar.at/gastronomie/menueplan",
    data: interspar,
  },
  {
    name: "Lercherl",
    description: "Wochenmenü",
    source: "https://lercherl.at/wochenmenue/",
    data: lercherl,
  },
];

function getStartOfDisplayedWeek(): Date {
  const today = new Date();

  const day = today.getDay();

  // Montag bis Freitag → aktuelle Woche
  if (day >= 1 && day <= 5) {
    const monday = new Date(today);

    monday.setDate(
      today.getDate() - (day - 1)
    );

    monday.setHours(12, 0, 0, 0);

    return monday;
  }

  // Samstag/Sonntag → nächste Woche
  const monday = new Date(today);

  const daysUntilMonday =
    day === 6 ? 2 : 1;

  monday.setDate(
    today.getDate() + daysUntilMonday
  );

  monday.setHours(12, 0, 0, 0);

  return monday;
}

function formatISODate(date: Date): string {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat(
    "de-AT",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  ).format(date);
}

function getWeekDates(): {
  date: Date;
  iso: string;
}[] {
  const monday =
    getStartOfDisplayedWeek();

  return Array.from(
    { length: 5 },
    (_, index) => {
      const date = new Date(monday);

      date.setDate(
        monday.getDate() + index
      );

      return {
        date,
        iso: formatISODate(date),
      };
    }
  );
}

function formatPrice(
  price: number | null | undefined
): string | null {
  if (
    price === null ||
    price === undefined
  ) {
    return null;
  }

  return (
    price
      .toFixed(2)
      .replace(".", ",") + " €"
  );
}

function normalizeDate(date: string): string {
  const value = date.trim();

  // Datum ist bereits im Format JJJJ-MM-TT
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Datum im österreichischen Format TT.MM.JJJJ
  const match = value.match(
    /^(\d{2})\.(\d{2})\.(\d{4})$/
  );

  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return value;
}

function getDayData(
  restaurant: Restaurant,
  isoDate: string
): DayData | undefined {
  return restaurant.data.days.find(
    (day) => normalizeDate(day.date) === isoDate
  );
}

function RestaurantMenu({
  restaurant,
  isoDate,
}: {
  restaurant: Restaurant;
  isoDate: string;
}) {
  const day = getDayData(
    restaurant,
    isoDate
  );

  if (!day) {
    return (
      <article className="restaurant-card">
        <div className="restaurant-header">
          <div>
            <h3>{restaurant.name}</h3>

            <p>
              {restaurant.description}
            </p>
          </div>

          <a
            href={restaurant.source}
            target="_blank"
            rel="noopener noreferrer"
            className="source-link"
          >
            Quelle ↗
          </a>
        </div>

        <div className="no-menu">
          <span>ℹ️</span>

          <span>
            Für diesen Tag liegt kein
            aktueller Menüplan vor.
          </span>
        </div>
      </article>
    );
  }

  return (
    <article className="restaurant-card">
      <div className="restaurant-header">
        <div>
          <h3>{restaurant.name}</h3>

          <p>
            {restaurant.description}
          </p>
        </div>

        <a
          href={restaurant.source}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link"
        >
          Quelle ↗
        </a>
      </div>

      {day.soup && (
        <div className="soup">
          <span className="soup-label">
            🥣 Suppe
          </span>

          <span>{day.soup}</span>
        </div>
      )}

      <div className="menu-list">
        {day.menus.map(
          (
            menu: MenuItem,
            index: number
          ) => (
            <div
              className="menu-item"
              key={`${menu.name}-${index}`}
            >
              <div className="menu-text">
               <span className="menu-name">
  {menu.name ?? "Menü"}
</span>


                <span className="menu-description">
                  {menu.description}
                </span>
              </div>

              {menu.price !== null &&
                menu.price !== undefined && (
                  <span className="menu-price">
                    {formatPrice(menu.price)}
                  </span>
                )}
            </div>
          )
        )}
      </div>
    </article>
  );
}

export default function Home() {
  const weekDates = getWeekDates();

  const [selectedIso, setSelectedIso] = useState(
    weekDates[0].iso
  );

  const selectedDay =
    weekDates.find(({ iso }) => iso === selectedIso) ??
    weekDates[0];

  const startDate = weekDates[0].date;
  const endDate = weekDates[weekDates.length - 1].date;

  return (
    <main>
      <header className="site-header">
        <div className="container">
          <div className="brand">
           <Image
 src={
  process.env.NEXT_PUBLIC_GITHUB_PAGES === "true"
    ? "/Mahlzeit/mahlzeit-wal.png"
    : "/mahlzeit-wal.png"
}
  alt="Wal mit Kochmütze"
  width={96}
  height={64}
  className="brand-image"
  priority
/>

            <div>
              <h1>
                Gefährdungsmeldung: Hunger
              </h1>

              <p>
                Sofortmaßnahmen und Menüvorschläge für die RS 17-19
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container">
        <section className="week-header">
          <div>
            <span className="eyebrow">
              AKTUELLE WOCHE
            </span>

            <h2>
              Mittagsmenü
            </h2>

            <p>
              {formatDisplayDate(
                startDate
              )}
              {" – "}
              {formatDisplayDate(
                endDate
              )}
            </p>
          </div>
        </section>

        <nav className="weekday-nav" aria-label="Wochentag auswählen">
  {weekDates.map(({ date, iso }) => (
    <button
      key={iso}
      type="button"
      className={`weekday-button${
        iso === selectedDay.iso ? " is-active" : ""
      }`}
      onClick={() => setSelectedIso(iso)}
      aria-pressed={iso === selectedDay.iso}
    >
      <span className="weekday-name">
        {new Intl.DateTimeFormat("de-AT", {
          weekday: "short",
        })
          .format(date)
          .replace(".", "")}
      </span>

      <span className="weekday-date">
        {new Intl.DateTimeFormat("de-AT", {
          day: "2-digit",
        }).format(date)}
      </span>
    </button>
  ))}
</nav>

<section className="week">
  <section className="day-section" key={selectedDay.iso}>
    <div className="day-heading">
      <h2>
        {new Intl.DateTimeFormat("de-AT", {
          weekday: "long",
        }).format(selectedDay.date)}
      </h2>

      <span>
        {new Intl.DateTimeFormat("de-AT", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(selectedDay.date)}
      </span>
    </div>

    <div className="restaurant-grid">
      {restaurants.map((restaurant) => (
        <RestaurantMenu
          key={restaurant.name}
          restaurant={restaurant}
          isoDate={selectedDay.iso}
        />
      ))}
    </div>
  </section>
</section>
      </div>

      <footer className="footer">
        <div className="container">
          <p>
            Menüdaten werden
            regelmäßig von den
            jeweiligen
            Restaurant-Webseiten
            abgerufen.
          </p>

          <p>
            Zuletzt aktualisierte
            Quelldaten werden später
            hier angezeigt.
          </p>
        </div>
      </footer>
    </main>
  );
}
