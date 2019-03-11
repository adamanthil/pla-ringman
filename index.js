const puppeteer = require('puppeteer');

require('dotenv').config();

(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  const navigationPromise = page.waitForNavigation()

  const loginEmailSelector = '#txtSignInEmail'
  const loginPwdSelector = '#txtSignInPassword'

  await page.goto(process.env.LOGIN_URI)
  await page.waitForSelector(loginEmailSelector)
  await page.type(loginEmailSelector, process.env.LOGIN_EMAIL)
  await page.type(loginPwdSelector, process.env.LOGIN_PASSWORD)
  await page.click('#btnSignInSubmit')
  await navigationPromise

  await page.waitForNavigation({ waitUntil: 'networkidle0' })

  await page.screenshot({ path: 'example.png' })

  await browser.close()
})();
