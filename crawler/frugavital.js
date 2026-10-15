const cheerio = require("cheerio");
const { PDFParse } = require("pdf-parse");
const fs = require("fs");

const url = "https://frugavital.at/";

async function main() {
  console.log("Rufe Fruga Vital ab...\n");

  // --------------------------------------------------
  // 1. Startseite abrufen
  // --------------------------------------------------

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fehler beim Abrufen: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // --------------------------------------------------
  // 2. Menüplan-PDFs finden
  // --------------------------------------------------

  const menuLinks = [];

  $("a").each((index, element) => {
    const text = $(element)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const href = $(element).attr("href");

    if (
      href &&
      href.toLowerCase().includes(".pdf") &&
      text.toLowerCase().includes("menüplan")
    ) {
      menuLinks.push({
        text,
        url: href,
      });
    }
  });

  if (menuLinks.length === 0) {
    throw new Error("Kein Menüplan-PDF gefunden.");
  }

  console.log("Gefundene Menüpläne:");

  menuLinks.forEach((menu, index) => {
    console.log(`${index + 1}. ${menu.text}`);
  });

  // --------------------------------------------------
  // 3. Ersten Menüplan verwenden
  // --------------------------------------------------

  const currentMenu = menuLinks[menuLinks.length - 1];

  console.log("\nVerwende:");
  console.log(currentMenu.text);
  console.log(currentMenu.url);

  // --------------------------------------------------
  // 4. PDF herunterladen
  // --------------------------------------------------

  const pdfResponse = await fetch(currentMenu.url);

  if (!pdfResponse.ok) {
    throw new Error(
      `Fehler beim PDF-Abruf: HTTP ${pdfResponse.status}`
    );
  }

  const pdfBuffer = Buffer.from(
    await pdfResponse.arrayBuffer()
  );

  console.log("\nPDF heruntergeladen.");
  console.log("Dateigröße:", pdfBuffer.length, "Bytes");

  // --------------------------------------------------
  // 5. PDF auslesen
  // --------------------------------------------------

  const parser = new PDFParse({
    data: pdfBuffer,
  });

  const pdfData = await parser.getText();

  await parser.destroy();

  const text = pdfData.text;

  // --------------------------------------------------
  // 6. Preise aus dem PDF auslesen
  // --------------------------------------------------

  const priceMatches = text.match(/\b\d{1,2},\d{2}\b/g) || [];

  const prices = priceMatches.map((price) =>
    Number(price.replace(",", "."))
  );

  console.log("\nGefundene Preise:", prices.length);

  // --------------------------------------------------
  // 7. Wochentage erkennen
  // --------------------------------------------------

  const dayRegex =
    /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag),\s*(\d{2}\.\d{2}\.\d{4})$/;

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const days = [];

  let currentDay = null;

  for (const line of lines) {
    const dayMatch = line.match(dayRegex);

    if (dayMatch) {
      currentDay = {
        day: dayMatch[1],
        date: dayMatch[2],
        descriptions: [],
      };

      days.push(currentDay);

      continue;
    }

    // Nur Text nach dem ersten Wochentag berücksichtigen.
    if (!currentDay) {
      continue;
    }

    // Überschriften / Fußzeilen ignorieren.
    if (
      line.startsWith("Telefonische Bestellung") ||
      line.startsWith("Alle Speisen") ||
      line === "-- 1 of 1 --"
    ) {
      continue;
    }

    // Einzelne Preiszeilen ignorieren.
    if (/^\d{1,2},\d{2}$/.test(line)) {
      continue;
    }

    // Menübeschreibung speichern.
       // Preis entfernen, falls der PDF-Parser
    // den Preis direkt an die Beschreibung angehängt hat.
    const cleanedDescription = line
      .replace(/\s+\d{1,2},\d{2}$/, "")
      .trim();

    if (cleanedDescription) {
      currentDay.descriptions.push(cleanedDescription);
    }
  }

  // --------------------------------------------------
  // 8. Preise und Gerichte zusammenführen
  // --------------------------------------------------

  let priceIndex = 0;

  for (const day of days) {
    day.menus = [];

    for (const description of day.descriptions) {
      if (priceIndex >= prices.length) {
        throw new Error(
          `Keine passende Preisangabe für: ${description}`
        );
      }

      day.menus.push({
        description,
        price: prices[priceIndex],
      });

      priceIndex++;
    }

    delete day.descriptions;
  }

  // --------------------------------------------------
  // 9. Ergebnis erstellen
  // --------------------------------------------------

  const result = {
    restaurant: "Fruga Vital",
    source: currentMenu.url,
    menuPlan: currentMenu.text,
    fetchedAt: new Date().toISOString(),
    days,
  };

  // --------------------------------------------------
  // 10. JSON-Datei speichern
  // --------------------------------------------------

  const outputPath = "./data/frugavital.json";

  fs.writeFileSync(
    outputPath,
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  console.log("\n=================================");
  console.log("Fruga Vital erfolgreich verarbeitet");
  console.log("=================================\n");

  console.log(
    JSON.stringify(result, null, 2)
  );

  console.log(
    `\nDaten gespeichert in: ${outputPath}`
  );
}

main();

