const { spawn } = require("child_process");

const crawlers = [
  {
    name: "O'Sfizio",
    file: "crawler/osfizio.js",
  },
  {
    name: "Fruga Vital",
    file: "crawler/frugavital.js",
  },
  {
    name: "INTERSPAR",
    file: "crawler/interspar.js",
  },
  {
    name: "Lercherl",
    file: "crawler/lercherl.js",
  },
];

function runCrawler(crawler) {
  return new Promise((resolve) => {
    console.log("");
    console.log("========================================");
    console.log(`Starte: ${crawler.name}`);
    console.log("========================================");
    console.log("");

    const process = spawn(
      "node",
      [crawler.file],
      {
        stdio: "inherit",
        shell: true,
      }
    );

    process.on("close", (code) => {
      if (code === 0) {
        console.log(
          `✓ ${crawler.name} erfolgreich abgeschlossen.`
        );
      } else {
        console.log(
          `✗ ${crawler.name} fehlgeschlagen (Code ${code}).`
        );
      }

      resolve({
        name: crawler.name,
        success: code === 0,
      });
    });
  });
}

async function main() {
  console.log("");
  console.log("========================================");
  console.log("MITTAGSMENÜ – GESAMT-CRAWLER");
  console.log("========================================");

  const results = [];

  for (const crawler of crawlers) {
    const result = await runCrawler(crawler);
    results.push(result);
  }

  console.log("");
  console.log("========================================");
  console.log("ZUSAMMENFASSUNG");
  console.log("========================================");
  console.log("");

  for (const result of results) {
    if (result.success) {
      console.log(`✓ ${result.name}`);
    } else {
      console.log(`✗ ${result.name}`);
    }
  }

  const failed = results.filter(
    (result) => !result.success
  );

  console.log("");

  if (failed.length === 0) {
    console.log(
      "🎉 Alle Restaurants wurden erfolgreich aktualisiert."
    );
  } else {
    console.log(
      `⚠ ${failed.length} Restaurant(e) sind fehlgeschlagen.`
    );
  }
}

main().catch((error) => {
  console.error("Unerwarteter Fehler:");
  console.error(error);
  process.exit(1);
});

