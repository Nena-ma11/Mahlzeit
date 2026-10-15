const cheerio = require("cheerio");

const url = "https://frugavital.at/";

async function main() {
  console.log("Rufe Fruga Vital ab...\n");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fehler beim Abrufen: HTTP ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  console.log("--- LINKS ZUM SPEISEPLAN / MENÜ ---\n");

  $("a").each((index, element) => {
    const text = $(element)
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const href = $(element).attr("href");

    const searchText = `${text} ${href || ""}`.toLowerCase();

    if (
      searchText.includes("speise") ||
      searchText.includes("menü") ||
      searchText.includes("menu")
    ) {
      console.log("TEXT:", text);
      console.log("LINK:", href);
      console.log("-----------------------------");
    }
  });
}

main();

