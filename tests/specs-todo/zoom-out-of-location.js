var webdriver = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const fs = require("fs");
let helper = require("./helper");

// Input capabilities
var capabilities = {
  // "bstack:options": {
  os: "Windows",
  osVersion: "10",
  local: "false",
  //'seleniumVersion' : '4.0.0-alpha.5',
  debug: "true",
  consoleLogs: "info",
  browserName: "Chrome",
  browser_version: "75.0",
  os: "Windows",
  os_version: "10",

  // SET CHROME OPTIONS
  "goog:chromeOptions": {
    prefs: {
      // 0 - Default, 1 - Allow, 2 - Block
      "profile.managed_default_content_settings.geolocation": 1
    }
  }
};

(async function run() {
  let driver;

  try {
    driver = await new webdriver.Builder()
      .usingServer("http://hub-cloud.browserstack.com/wd/hub")
      .withCapabilities(capabilities)
      .build();

    const waitFind = locator => {
      return driver.findElement(async () => {
        await driver.wait(webdriver.until.elementLocated(locator));
        return driver.findElement(locator);
      });
    };

    await driver.get("http://wheelmap.org");
    await waitFind(webdriver.By.css(".button-continue-with-cookies")).click();
    await waitFind(webdriver.By.name("search")).sendKeys(
      "Alexanderplatz" + webdriver.Key.ENTER
    );
    await waitFind(webdriver.By.className("search-results")); // wait for displayed
    //await helper.saveScreenshot(driver, "search-results-are-displayed.png");
    await waitFind(webdriver.By.css('h1[class^="PlaceName"]')).click();
    await waitFind(
      webdriver.By.css('[class="leaflet-control-zoom-out"]')
    ).click();
    await waitFind(
      webdriver.By.css('[class="leaflet-control-zoom-out"]')
    ).click();
    await waitFind(
      webdriver.By.css('[class="leaflet-control-zoom-out"]')
    ).click();
    await waitFind(
      webdriver.By.css('[class="leaflet-control-zoom-out"]')
    ).click();

    await helper.saveScreenshot(driver, `zoom-out-of.location.png`);
  } finally {
    if (driver) {
      await driver.quit();
    }
  }
})();

// it('clicks on startbutton', () => {
//   browser.url('https://www.wheelmap.org');
//   browser.waitForVisible('[class="button-continue-with-cookies"]');
//   const but = browser.$('[class="button-continue-with-cookies"]')    // waituntil, ...
//   but.click();
//   browser.pause(10000)
//   browser.saveScreenshot('./screenshots/002-wheelmap.org-click-on-startbutton.png')
//   browser.pause(10000)
// });

// it('searches for a place', () => {
//    browser.saveScreenshot('./screenshots/003-start-the-search-for-place.png')
//   // const form = $('form')
//   // const attr = form.getAttribute('method')
//   // console.log(attr)
//   browser.waitForVisible('[name="search"]');
//   const input = browser.$('[name="search"]');
//   input.addValue('Alexanderplatz')
//   browser.saveScreenshot('./screenshots/004-wheelmap.org-input-enter-name-of-place.png')

//   // const v = browser.$$('[aria-label="Search results"]')[0];
//   // v.$(`h1`).waitForDisplayed();
//   // console.log(v.$(`h1`).isDisplayed());

//   browser.waitUntil(() => {
//     const v = browser.$$('[aria-label="Search results"]')[0];
//     console.log(v.$(`h1`).getText());
//     return (v.$(`h1`).getText() === `Alexanderplatz`);
//   });

//   const firstlink = browser.$$('[aria-label="Search results"]')[0];
//   firstlink.$(`button`).click();

//   browser.waitForVisible('[name="search"]', 2000 , true );

//   browser.saveScreenshot('./screenshots/005-wheelmap.org-enter-input.png')
// });

// it('zooms out of the map with zoom-out-button', () => {
//   browser.saveScreenshot('./screenshots/006-before-zoom-out.png')
//   const zoomy = browser.$('[class="leaflet-control-zoom-out"]');
//   zoomy.click();
//   zoomy.click();
//   zoomy.click();
//   browser.saveScreenshot('./screenshots/007-after-zoom-out.png')
// });

// it('zooms in to map with zoom-in-button', () => {
//   browser.saveScreenshot('./screenshots/008-before-zoom-in.png')
//   const zoomy = browser.$('[class="leaflet-control-zoom-in"]');
//   zoomy.click();
//   zoomy.click();
//   zoomy.click();
//   browser.saveScreenshot('./screenshots/009-after-zoom-in.png')
// });

// it('drags the map with key arrows', () => {
//   browser.saveScreenshot('./screenshots/010-before-map-move.png')
//   const backgr =  browser.$('[class="leaflet-container leaflet-touch leaflet-fade-anim leaflet-grab leaflet-touch-drag leaflet-touch-zoom"]');
//   backgr.click();
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.keys('ArrowDown');
//   browser.saveScreenshot('./screenshots/011-after-map-move.png')
// });

// it('searches for a place via categories', () => {
//   browser.saveScreenshot('./screenshots/012-0-before-search.png')
//   const input = browser.$('[name="search"]')
//   input.click();

//   const foodAndDrinkButton = browser.$('[aria-label="Food & Drinks"]');
//   foodAndDrinkButton.click();
//   browser.saveScreenshot('./screenshots/012-1-before-search.png')

//   const fullyAccessibleMenuButton = browser.$('[aria-label="Only fully wheelchair accessible"]');
//   fullyAccessibleMenuButton.click();
//   browser.saveScreenshot('./screenshots/012-2-before-search.png')

//   browser.saveScreenshot('./screenshots/013-after-search.png')

// });
