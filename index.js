const axios = require('axios');
const fs = require('fs');
const handlebars = require('handlebars');
const parse = require('csv-parse/lib/sync');
const puppeteer = require('puppeteer');

const seatingAssignmentRequestData = require('./json/seating-assignment-request-data.json');
const bidHistoryRequestData = require('./json/bid-history-request-data.json');
const raffleWinnersRequestData = require('./json/raffle-winners-request-data.json');
const silentWinnersRequestData = require('./json/silent-winners-request-data.json');

require('dotenv').config();


async function getReportCSV(data, cookies) {
  const cookieHeaderValue = cookies.map((cookie) => cookie.name + '=' + cookie.value + ';').join(' ')
  const headers = {
    Cookie: cookieHeaderValue
  }

  data.auction = process.env.AUCTION_ID
  data.organization = process.env.ORGANIZATION_ID

  const exportResponse = await axios({
    method: 'post',
    url: 'https://auctria.com/API/Report/Export',
    headers: headers,
    data: data
  });

  let progressResponse
  do {
    progressResponse = await axios({
      method: 'post',
      url: 'https://auctria.com/API/Job/Progress',
      headers: headers,
      data: {
        auction: process.env.AUCTION_ID,
        job: exportResponse.data.Id
      }
    });
  } while (!progressResponse.data.Result.Complete)

  const csvResponse = await axios.get(
    `https://auctria.com/Az/${process.env.AUCTION_ID}/Job/Result`,
    {
      headers: headers,
      params: {
        job_id: exportResponse.data.Id,
        organization: process.env.ORGANIZATION_ID
      }
    }
  )

  return csvResponse.data
}


async function logIn(page) {
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
  const cookies = await page.cookies()
  return cookies
}


function getTablesByBidder(csv) {
  const tablesByBidder = {}
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true
  })

  records.forEach(record => tablesByBidder[record['Bidder #']] = record['Table'])
  return tablesByBidder
}


function generateTopTables(tablesByBidder, csv) {
  const displayNumber = 5
  const excludedItems = [
    'auctiononly', 'auctiononlyfull', 'childticket', 'singleticket', 'singleticketfull',
    'tableof8', 'tableof8full', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'
  ]

  const spendByTable = {}
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    quote: false
  })

  const addAmounts = record => {
    const table = tablesByBidder[record['Bidder#']]
    if (table) {
      // if (table == 'Gotha') console.log(record)
      if (spendByTable[table]) {
        spendByTable[table] += parseFloat(record['Amount'])
      } else {
        spendByTable[table] = parseFloat(record['Amount'])
      }
    }
  }

  records
    .filter(record => !excludedItems.includes(record['Item#']))
    .forEach(addAmounts)

  const sortedTables = Object.entries(spendByTable)
    .sort((a, b) => b[1] - a[1])
  const topAmount = sortedTables[0][1]
  const topTables = sortedTables
    .slice(0, displayNumber)
    .map(r => ({ name: r[0], amount: r[1], diff: r[1] - topAmount }))
    // .map(r => ({ name: r[0], amount: r[1] + Math.floor(Math.random() * 2000), diff: r[1] - topAmount }))

  const source = fs.readFileSync('./templates/top-tables.hbs').toString()
  const template = handlebars.compile(source)
  const result = template({ tables: topTables })
  fs.writeFileSync('./_build/top-tables.html', result)
}


function generateSilentWinners(csv) {
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    quote: false
  })

  records.forEach(r => console.log(
    r['Item#'],
    r['Title'],
    r['Bidder#'],
    r['Firstname'],
    r['Lastname'],
    r['Amount']
  ))
}


(async () => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  const cookies = await logIn(page)

  const tablesByBidder = getTablesByBidder(await getReportCSV(seatingAssignmentRequestData, cookies))

  const bidHistoryCSV = await getReportCSV(bidHistoryRequestData, cookies)
  generateTopTables(tablesByBidder, bidHistoryCSV)

  // const silentWinnersCSV = await getReportCSV(silentWinnersRequestData, cookies)
  // generateSilentWinners(silentWinnersCSV)
  // const raffleWinnersCSV = await getReportCSV(raffleWinnersRequestData, cookies)

  await browser.close()
})();
