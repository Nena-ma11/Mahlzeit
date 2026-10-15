const { chromium } = require("playwright");
const fs = require("fs");

const START_URL =
  "https://www.interspar.at/gastronomie/menueplan";

const DAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function cleanDescription(text) {
  let result = text
    .replace(/\s+/g, " ")
    .trim();

  // Silbentrennungen aus dem PDF/Flipbook beseitigen.
  result = result.replace(/-\s+/g, "-");

  // Allergene am Ende entfernen.
  // Beispiel:
  // "Gnocchi ... A, C, G"
  // "Gebackene Champignons ... A, F, M vegan"
  result = result.replace(
    /\s+(?:[A-R](?:,\s*[A-R])*)(?:\s+vegan)?$/i,
    ""
  );

  return result.trim();
}

function parseMenuText(text) {
  const normalizedText = text
    .replace(/\s+/g, " ")
    .trim();

  // --------------------------------------------------
  // Zeitraum des Menüplans
  // --------------------------------------------------

  const dateMatch = normalizedText.match(
    /Montag,\s*(\d{1,2})\.(\d{1,2})\.\s*[–-]\s*Samstag,\s*(\d{1,2})\.(\d{1,2})\./
  );

  if (!dateMatch) {
    throw new Error(
      "Der Zeitraum des INTERSPAR-Menüplans konnte nicht erkannt werden."
    );
  }

  const startDay = Number(dateMatch[1]);
  const startMonth = Number(dateMatch[2]);

  // Für unseren aktuellen MVP verwenden wir das aktuelle Jahr.
  const currentYear = new Date().getFullYear();

  const startDate = new Date(
    currentYear,
    startMonth - 1,
    startDay,
    12,
    0,
    0
  );

  // --------------------------------------------------
  // Nur den eigentlichen Menübereich betrachten
  // --------------------------------------------------

  const menuStart =
    normalizedText.indexOf(
      "KLASSISCH VEGETARISCH"
    );

  const menuEnd =
    normalizedText.indexOf(
      "A Glutenhaltiges Getreide"
    );

  if (menuStart === -1 || menuEnd === -1) {
    throw new Error(
      "Der eigentliche Menübereich konnte nicht gefunden werden."
    );
  }

  const menuText = normalizedText.substring(
    menuStart,
    menuEnd
  );

  // --------------------------------------------------
  // Alle Preise finden
  // --------------------------------------------------

  const priceRegex = /\b\d{1,2},\d{2}\b/g;

  const priceMatches = [
    ...menuText.matchAll(priceRegex)
  ];

  if (priceMatches.length !== 12) {
    throw new Error(
      `Erwartet wurden 12 Menüpreise, gefunden wurden ${priceMatches.length}.`
    );
  }

  // --------------------------------------------------
  // Menütexte anhand der Preise trennen
  // --------------------------------------------------

  const firstDishMarker =
    "MO DI MI DO FR";

  const firstDishStart =
    menuText.indexOf(firstDishMarker);

  if (firstDishStart === -1) {
    throw new Error(
      "Der Beginn der Menüstruktur konnte nicht gefunden werden."
    );
  }

  let cursor =
    firstDishStart + firstDishMarker.length;

  const entries = [];

  for (const match of priceMatches) {
    const description = menuText
      .substring(cursor, match.index)
      .trim();

    const priceText = match[0];

    entries.push({
      description: cleanDescription(description),
      price: Number(priceText.replace(",", "."))
    });

    cursor =
      match.index + match[0].length;
  }

  // --------------------------------------------------
  // Klassisch / vegetarisch trennen
  // --------------------------------------------------

   // INTERSPAR liefert die Gerichte aktuell in dieser Reihenfolge:
  //
  // Klassisch:
  // Montag bis Freitag
  //
  // Vegetarisch:
  // Montag bis Freitag
  //
  // danach:
  // Samstag klassisch
  // Samstag vegetarisch

  if (entries.length !== 12) {
    throw new Error(
      `Erwartet wurden 12 Menüeinträge, gefunden wurden ${entries.length}.`
    );
  }

  const classicMenus = [
    entries[0],
    entries[1],
    entries[2],
    entries[3],
    entries[4],
    entries[10]
  ];

  const vegetarianMenus = [
    entries[5],
    entries[6],
    entries[7],
    entries[8],
    entries[9],
    entries[11]
  ];
  

  // --------------------------------------------------
  // Wochentage erzeugen
  // --------------------------------------------------

  const days = [];

  for (let i = 0; i < 6; i++) {
    const date = new Date(startDate);

    date.setDate(
      startDate.getDate() + i
    );

    days.push({
      date: formatDate(date),
      day: DAY_NAMES[i],

      menus: [
        {
          name: "Klassisch",
          description:
            classicMenus[i].description,
          price:
            classicMenus[i].price
        },
        {
          name: "Vegetarisch",
          description:
            vegetarianMenus[i].description,
          price:
            vegetarianMenus[i].price
        }
      ]
    });
  }

  return days;
}

async function main() {
  console.log("Starte INTERSPAR-Crawler...\n");

  const browser = await chromium.launch({
    headless: false
  });

  const page = await browser.newPage({
    viewport: {
      width: 1440,
      height: 1000
    },
    locale: "de-AT"
  });

  try {
    // --------------------------------------------------
    // 1. INTERSPAR-Hauptseite öffnen
    // --------------------------------------------------

    console.log("Öffne INTERSPAR...");

    await page.goto(START_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // --------------------------------------------------
    // 2. Aktuellen Menüplan-Link finden
    // --------------------------------------------------

   const allMenuLinks = await page.locator(
  'a[href*="flugblatt.interspar.at/menuplane/menuplan-kw"]'
).evaluateAll(links =>
  links.map(link => ({
    text: (link.innerText || "")
      .replace(/\s+/g, " ")
      .trim(),
    href: link.href
  }))
);
const currentWeekLink = allMenuLinks.find(link =>
  link.text
    .toLowerCase()
    .includes("dieser woche")
);

if (!currentWeekLink) {
  throw new Error(
    "Der Link 'Menüplan dieser Woche' wurde nicht gefunden."
  );
}

const menuUrl = currentWeekLink.href;

console.log("\nVerwendeter Menüplan:");
console.log(currentWeekLink);

console.log("\nGefundene INTERSPAR-Menüplan-Links:");
console.log(allMenuLinks);

// Doppelte Links entfernen



    console.log(
      "Aktueller Menüplan:",
      menuUrl
    );

    // --------------------------------------------------
    // 3. Aktuellen Menüplan öffnen
    // --------------------------------------------------

    await page.goto(menuUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    // --------------------------------------------------
    // 4. Text auslesen
    // --------------------------------------------------

    const text =
      await page.locator("body").innerText();

    // --------------------------------------------------
    // 5. Menü parsen
    // --------------------------------------------------

    const days = parseMenuText(text);

    // --------------------------------------------------
    // 6. Ergebnis erstellen
    // --------------------------------------------------

    const result = {
      restaurant: "INTERSPAR Jörgerstraße",

      location: {
        street: "Jörgerstraße 24",
        postalCode: "1170",
        city: "Wien"
      },

      source: START_URL,

      menuUrl,

      fetchedAt:
        new Date().toISOString(),

      days
    };

    // --------------------------------------------------
    // 7. JSON speichern
    // --------------------------------------------------

    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", {
        recursive: true
      });
    }

    fs.writeFileSync(
      "./data/interspar.json",
      JSON.stringify(
        result,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      "\n================================"
    );

    console.log(
      "INTERSPAR erfolgreich verarbeitet"
    );

    console.log(
      "================================\n"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );

    console.log(
      "\nGespeichert in:"
    );

    console.log(
      "./data/interspar.json"
    );

  } catch (error) {
    console.error(
      "\nFEHLER:"
    );

    console.error(error);

    process.exitCode = 1;

  } finally {
    await browser.close();

    console.log(
      "\nBrowser geschlossen."
    );
  }
}

main();

