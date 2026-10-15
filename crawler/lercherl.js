const cheerio = require("cheerio");
const fs = require("fs");

const url = "https://lercherl.at/wochenmenue/";

const WEEKDAYS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
];

function convertDate(dateText) {
  const months = {
    "Jänner": "01",
    "Februar": "02",
    "März": "03",
    "April": "04",
    "Mai": "05",
    "Juni": "06",
    "Juli": "07",
    "August": "08",
    "September": "09",
    "Oktober": "10",
    "November": "11",
    "Dezember": "12"
  };

  const match = dateText.match(
    /(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s+(\d{4})/
  );

  if (!match) {
    return null;
  }

  const [, day, monthName, year] = match;

  const month = months[monthName];

  if (!month) {
    return null;
  }

  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function extractSegments($, descriptionElement) {
  const segments = [];
  let current = "";

  descriptionElement.contents().each((index, node) => {
    // <br> beendet einen Abschnitt.
    if (node.type === "tag" && node.name === "br") {
      const text = current
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        segments.push(text);
      }

      current = "";
      return;
    }

    // Text inklusive <b> usw. übernehmen.
    current += $(node).text();
  });

  // Letzten Abschnitt übernehmen.
  const finalText = current
    .replace(/\s+/g, " ")
    .trim();

  if (finalText) {
    segments.push(finalText);
  }

  return segments;
}

function extractPrice(text) {
  const match = text.match(
    /€\s*(\d{1,2}(?:,\d{2}|\.\d{2}))/
  );

  if (!match) {
    return null;
  }

  return Number(
    match[1].replace(",", ".")
  );
}

async function main() {
  console.log("Rufe Lercherl ab...\n");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Fehler beim Abrufen: HTTP ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // --------------------------------------------------
  // 1. Standardpreis des normalen Wochenmenüs finden
  // --------------------------------------------------

  const pageText = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const standardPriceMatch = pageText.match(
    /mit Suppe um €\s*(\d{1,2}(?:,\d{2}|\.\d{2}))/
  );

  const standardPrice = standardPriceMatch
    ? Number(
        standardPriceMatch[1].replace(",", ".")
      )
    : null;

  if (standardPrice === null) {
    throw new Error(
      "Der Standardpreis des Lercherl-Wochenmenüs wurde nicht gefunden."
    );
  }

  console.log(
    "Standardpreis:",
    standardPrice
  );

  // --------------------------------------------------
  // 2. Die einzelnen Tage finden
  // --------------------------------------------------

  const days = [];

  $(".wpr-price-list-item").each(
    (index, element) => {
      const heading = $(element)
        .find(".wpr-price-list-heading")
        .text()
        .replace(/\s+/g, " ")
        .trim();

      // Freitags-Spezial wird separat behandelt.
      if (
        heading.startsWith(
          "Freitags-Spezial"
        )
      ) {
        return;
      }

      const weekday = WEEKDAYS.find(day =>
        heading.startsWith(`${day},`)
      );

      if (!weekday) {
        return;
      }

      const date = convertDate(heading);

      if (!date) {
        return;
      }

      const descriptionElement = $(element)
        .find(".wpr-price-list-description");

      const segments = extractSegments(
        $,
        descriptionElement
      );

      if (segments.length < 4) {
        console.warn(
          `Warnung: Unerwartete Struktur für ${weekday}:`
        );
        console.warn(segments);
        return;
      }

      const soup = segments[0];
const main = segments[1];
const alternative = segments[3];

const mainPrice = extractPrice(main);

const cleanMain = main
  .replace(/\s*\(€\s*\d{1,2}(?:,\d{2}|\.\d{2})\)/, "")
  .trim();

   const menus = [
  {
    name: "Menü",
    description: cleanMain,
    price:
      mainPrice !== null
        ? mainPrice
        : standardPrice
  },
  {
    name: "Alternative",
    description: alternative,
    price: standardPrice
  }
];  
    

      days.push({
        date,
        day: weekday,
        soup,
        menus
      });
    }
  );

  // --------------------------------------------------
  // 3. Freitags-Spezial finden
  // --------------------------------------------------

  const specialElement = $(
    ".wpr-price-list-item"
  ).filter((index, element) => {
    const heading = $(element)
      .find(".wpr-price-list-heading")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    return heading.startsWith(
      "Freitags-Spezial"
    );
  });

  if (specialElement.length) {
    const heading = specialElement
      .find(".wpr-price-list-heading")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const description =
      specialElement
        .find(".wpr-price-list-description")
        .text()
        .replace(/\s+/g, " ")
        .trim();

    const price = extractPrice(heading);

    const friday = days.find(
      day => day.day === "Freitag"
    );

    if (friday) {
      friday.menus.push({
        name: "Freitags-Spezial",
        description,
        price
      });
    }
  }

  // --------------------------------------------------
  // 4. Ergebnis erstellen
  // --------------------------------------------------

  const result = {
    restaurant: "Lercherl",
    source: url,
    fetchedAt: new Date().toISOString(),
    days
  };

  // --------------------------------------------------
  // 5. JSON speichern
  // --------------------------------------------------

  if (!fs.existsSync("./data")) {
    fs.mkdirSync("./data", {
      recursive: true
    });
  }

  const outputPath =
    "./data/lercherl.json";

  fs.writeFileSync(
    outputPath,
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
    "Lercherl erfolgreich verarbeitet"
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
    `\nGespeichert in: ${outputPath}`
  );
}

main().catch(error => {
  console.error("\nFEHLER:");
  console.error(error);
});

