const cheerio = require("cheerio");
const fs = require("fs");

const url = "https://www.osfizio.at/mittagsmenus/";

function convertDate(date) {
  const [day, month, year] = date.split(".");

  return `${year}-${month}-${day}`;
}

async function main() {
  console.log("Rufe O'Sfizio ab...\n");

  // --------------------------------------------------
  // 1. Webseite abrufen
  // --------------------------------------------------

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fehler beim Abrufen: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // --------------------------------------------------
  // 2. Menüs auslesen
  // --------------------------------------------------

  const menus = [];
  const usedContentIds = new Set();

  $(".elementor-tab-title").each((index, element) => {
    const contentId = $(element).attr("aria-controls");

    if (!contentId) {
      return;
    }

    // Doppelte Elementor-Tabs ignorieren
    if (usedContentIds.has(contentId)) {
      return;
    }

    usedContentIds.add(contentId);

    const title = $(element)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // Menüname und Preis auslesen
    const menuMatch = title.match(
      /^(\d+-Mittagsmenü)\s+€\s*([\d,]+)/
    );

    const name = menuMatch
      ? menuMatch[1]
      : title;

    const price = menuMatch
      ? Number(menuMatch[2].replace(",", "."))
      : null;

    // Zugehörigen Inhaltsbereich finden
    const content = $(`#${contentId}`);

    if (!content.length) {
      return;
    }

    const contentText = content
      .text()
      .replace(/\s+/g, " ")
      .trim();

    // Datum finden
    const dateMatch = contentText.match(
      /\d{2}\.\d{2}\.\d{4}/
    );

    const date = dateMatch
      ? dateMatch[0]
      : null;

    if (!date) {
      return;
    }

    // Gerichte auslesen
    const items = [];

    content.find("p").each((index, paragraph) => {
      const itemText = $(paragraph)
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/^-/, "")
        .trim();

      if (
        itemText &&
        !/^\d{2}\.\d{2}\.\d{4}$/.test(itemText)
      ) {
        items.push(itemText);
      }
    });

    menus.push({
      name,
      price,
      items,
    });

    // Das Datum merken wir später separat
    menus[menus.length - 1].date = date;
  });

  // --------------------------------------------------
  // 3. Datum bestimmen
  // --------------------------------------------------

  const firstDate = menus.length > 0
    ? menus[0].date
    : null;

  // --------------------------------------------------
  // 4. Menüs in unser gemeinsames Format bringen
  // --------------------------------------------------

   const isoDate = firstDate
    ? convertDate(firstDate)
    : null;

const weekdayNames = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

const weekday = isoDate
    ? weekdayNames[new Date(`${isoDate}T12:00:00`).getDay()]
    : null;

const day = isoDate
    ? {
        date: isoDate,
        day: weekday,
        menus: menus.map((menu) => ({
          name: menu.name,
          description: menu.items.join(" | "),
          price: menu.price,
        })),
      }
    : null;

  const result = {
    restaurant: "O'Sfizio",
    source: url,
    fetchedAt: new Date().toISOString(),
    days: day ? [day] : [],
  };

  // --------------------------------------------------
  // 5. JSON speichern
  // --------------------------------------------------

  const outputPath = "./data/osfizio.json";

  fs.writeFileSync(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  console.log("\nO'Sfizio erfolgreich verarbeitet.");
  console.log(`Daten gespeichert in: ${outputPath}\n`);

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main();
