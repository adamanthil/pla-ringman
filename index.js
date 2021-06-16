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


function sleep(s) {
  return new Promise(resolve => setTimeout(resolve, s * 1000));
}

function chunkArray(arr, chunkSize) {
    var groups = [], i;
    for (i = 0; i < arr.length; i += chunkSize) {
        groups.push(arr.slice(i, i + chunkSize));
    }
    return groups;
}


async function getReportCSV(data, cookies) {
  const cookieHeaderValue = cookies.map((cookie) => cookie.name + '=' + cookie.value + ';').join(' ')
  const headers = {
    Cookie: cookieHeaderValue
  }

  data.auction = process.env.AUCTION_ID
  data.organization = process.env.ORGANIZATION_ID

  const exportResponse = await axios({
    method: 'post',
    url: 'https://app.auctria.com/API/Report/Export',
    headers: headers,
    data: data
  });

  let progressResponse
  do {
    progressResponse = await axios({
      method: 'post',
      url: 'https://app.auctria.com/API/Job/Progress',
      headers: headers,
      data: {
        auction: process.env.AUCTION_ID,
        job: exportResponse.data.Id
      }
    });
  } while (!progressResponse.data.Result.Complete)

  const csvResponse = await axios.get(
    `https://app.auctria.com/Az/${process.env.AUCTION_ID}/Job/Result`,
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


function writeHtml(templateName, data) {
  const source = fs.readFileSync(`./templates/${templateName}.hbs`).toString()
  const template = handlebars.compile(source)
  const result = template(data)
  fs.writeFileSync(`./www/${templateName}.html`, result)
}


function formatDollars(number) {
  const formatted = Math.round(Math.abs(number))
    .toString()
    .replace(/\d(?=(\d{3})+$)/g, '$&,')
  return `${(number < 0) ? '-' : ''}$${formatted}`
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

  const calculateWidth = (amount, topAmount) => {
    const lowestPercent = 10;
    const scaleDiscount = 0.8;

    const ratio = (amount / topAmount);
    const scaleFactor = 1 + scaleDiscount * (1 - ratio);
    const distanceFromWinner = ratio * scaleFactor;

    const availableWidth = 100 - lowestPercent;
    return lowestPercent + availableWidth * distanceFromWinner;
  }

  records
    .filter(record => !excludedItems.includes(record['Item#']))
    .forEach(addAmounts)

  const sortedTables = Object.entries(spendByTable)
    .sort((a, b) => b[1] - a[1])
  const topAmount = sortedTables[0][1]
  const topTables = sortedTables
    .slice(0, displayNumber)
    .map(r => ({
      name: parseInt(r[0]) ? ('Table ' + r[0]) : r[0],
      amount: formatDollars(r[1]),
      diff: formatDollars(r[1] - topAmount),
      winner: r[1] === topAmount,
      perc: calculateWidth(r[1], topAmount)
    }))
  const lastWidth = topTables[
      topTables.length > displayNumber ? displayNumber - 1 : topTables.length - 1
  ]["perc"]

  writeHtml('top-tables', { tables: topTables, hideAside: lastWidth >= 60 })
}


function generateWinners(silentCSV, raffleCSV) {
  let silentRecords = parse(silentCSV, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    quote: false
  })
  let raffleRecords = parse(raffleCSV, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    quote: false
  })

  silentRecords = silentRecords.map(record =>
    Object.assign(record, {Amount: formatDollars(parseFloat(record.Amount))})
  )
  raffleRecords = raffleRecords.map(record => {
    delete record.Amount
    return record
  })

  const chunkAndLabel = (records, label) => {
    return chunkArray(records, 10).map(record => Object.assign(record, {label: label}))
  }

  const silentPages = chunkAndLabel(silentRecords, 'Silent Auction Winners')
  const rafflePages = chunkAndLabel(raffleRecords, 'Raffle Winners')

  writeHtml('winners', { 'pages': silentPages.concat(rafflePages) })
}


function writeLog(string) {
  time = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
  console.log(`${time} --- ${string}`)
}


async function refreshLogin() {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  const cookies = await logIn(page)
  return cookies
}


(async () => {
  writeLog('Startup')
  writeLog('Logging In')
  let cookies = await refreshLogin()

  writeLog('Retrieving Table Assignments')
  const tablesByBidder = getTablesByBidder(await getReportCSV(seatingAssignmentRequestData, cookies))

  let i = 0;
  let bidHistoryCSV, silentWinnersCSV, raffleWinnersCSV;
  while (true) {
    writeLog(`Iteration ${i}`)

    // Re-login every 10 minutes
    if (i > 0 && i % 20 == 0) {
      writeLog('Refreshing Login')
      cookies = await refreshLogin()
    }

    writeLog('Generating Top Tables')
    bidHistoryCSV = await getReportCSV(bidHistoryRequestData, cookies)
    generateTopTables(tablesByBidder, bidHistoryCSV)

    // Only regenerate silent auction and raffle winners every 4 minutes
    if (i % 8 == 0) {
      writeLog('Pulling Silent Auction Winners')
      silentWinnersCSV = await getReportCSV(silentWinnersRequestData, cookies)

      writeLog('Pulling Raffle Winners')
      raffleWinnersCSV = await getReportCSV(raffleWinnersRequestData, cookies)

      writeLog('Generating Winners Report')
      generateWinners(silentWinnersCSV, raffleWinnersCSV)
    }

    // Rerun every 30s
    writeLog('Waiting...')
    await sleep(30)
    i++
  }

  await browser.close()
})();
