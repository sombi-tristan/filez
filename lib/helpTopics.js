/**
 * The Help page's walkthroughs: one per demo video, each opening on its own screen with the video
 * and a detailed explanation under it. Plain data, so a test can read it without the app.
 *
 * Every claim here was checked against the screen it describes: the station home against
 * screens/dashboard/stations/[stationId]/page.js, the entries against screens/dashboard/entries
 * (daily-sales, lodgements, lube), and the reports against screens/dashboard/reports (summary,
 * consumption-fuel-stock, lube-report, account-ledger). If a screen changes, its topic changes
 * with it.
 *
 * The videos are the StationMGR demos (stationmgr-videos), at public/help/videos/<id>.mp4 with a
 * poster frame beside each. `steps` are the video's own step guide, word for word.
 *
 * Shape: [{ id, title, subtitle, steps, blocks }], with the blocks of lib/helpContent.js plus
 *   { h: 'heading' }                 a sub-heading inside the topic
 */
export const HELP_TOPICS = [
  {
    id: 'home',
    title: 'Your station at a glance',
    subtitle: 'The station home: sync, entries and reports',
    steps: ['Open your station', "Check it's synced", 'Find your entries', 'Open a report', 'Use ☰ to jump anywhere'],
    blocks: [
      { p: 'All Stations lists every station you own or work at. Tapping one opens its home, the page everything else starts from.' },
      { h: 'The station card' },
      { p: 'The coloured card at the top carries the station\'s name and its sync controls. The app saves to the phone first, so this card is where the phone and the server meet.' },
      {
        defs: [
          ['Push', 'Sends what you have saved on this phone to the server. The number on it is how many items are waiting. Until you push, this phone holds the only copy.'],
          ['Pull', 'Fetches the station\'s data from the server onto this phone. Use it on a new phone, or when someone else has been entering.'],
          ['Clear queue', 'Throws away everything waiting to be pushed. Push first unless you mean to lose it.'],
        ],
      },
      { p: 'Under the card, All Stations takes you back to your list of stations, and Subscription opens the station\'s subscription. Only the owner can change the subscription; staff who tap it are told to ask the owner.' },
      { h: 'Entries' },
      { p: 'One tile for each entry screen: Daily Sales, Product Receipt, Lodgements, Lube and Accounts. Each opens on the day\'s form with the day\'s saved entries beside it.' },
      { p: 'A tile that is dimmed is one your account cannot open. Tapping it says so. The station owner grants it from your row in the Staff list.' },
      { h: 'Reports' },
      { p: 'Four reports sit on the home, the ones a phone keeps: Summary, Consumption & Fuel Stock, Account Ledger and Lube Report. The other reports are in the StationMGR desktop app.' },
      { h: 'The menu' },
      { p: 'The ☰ button at the top left opens the menu: every entry and report in groups, and the station switcher. Only one group is open at a time, and it opens on the group of the screen you are on.' },
      { p: 'At the very bottom of the home are Appearance, which steps through Light, Dark and System, and Sign out.' },
      { note: 'If figures on this phone look out of date, pull before anything else. Reports read only what is on this phone.' },
    ],
  },
  {
    id: 'daily-sales',
    title: 'Daily sales in minutes',
    subtitle: 'Meters, consumption, pour back and tank dips',
    steps: ["Enter today's prices", "Type each nozzle's closing meter", 'Add consumption and pour back', 'Turn on Final entry for tank dips', 'Save'],
    blocks: [
      { p: 'Daily Sales is the sheet the day is built on. Every report reads its sales, consumption and tank stock from here.' },
      { h: 'The day' },
      { p: 'The date bar at the top picks the day. Its arrows step to the previous and next day that has entries saved. The day\'s saved entries are listed beside the form; Entries opens the full list.' },
      { h: 'Fuel prices' },
      { p: 'The price per litre of each fuel for this entry. At least one price is needed to save. The sales amounts are the litres at these prices.' },
      { h: 'Nozzle readings' },
      { p: 'One row per pump, grouped by fuel. Each row has four columns:' },
      {
        defs: [
          ['Meter', 'The pump\'s closing meter. Left blank, it takes the last closing reading, which shows faintly in the box.'],
          ['Consumption (Cons.)', 'Litres taken off the pump that were not sold, such as fuel for the generator or a company car.'],
          ['Pour back (P/B)', 'Litres drawn and put back into the tank, such as after a pump test or repair.'],
          ['Actual', 'Worked out for you: closing meter less opening meter, less consumption and pour back. These are the litres sold.'],
        ],
      },
      { p: 'A pump opens on the closing meter of the entry before it. On a day with shifts, the second shift opens where the first closed. With nothing before it, a pump opens on the reading it was set up with.' },
      { p: 'Total sales under the readings is every fuel\'s actual litres at its price.' },
      { h: 'Consumption and pour back accounts' },
      { p: 'Litres of consumption or pour back are booked to an account. Once there are litres on a row, "add account" appears under it: tap it and pick from the sheet. The sheet lists the station\'s own accounts, such as Police, Generator or Pour Back After Pump Repairs, not credit customers.' },
      { h: 'Tank dips: the final entry' },
      { p: 'Turn on Final entry for the last entry of the day. The tanks appear, each with a box for its closing stock in litres from the dip.' },
      { p: 'Beside each tank is its over (+) or short (−): closing stock less opening stock, less what was delivered into it that day, plus what its pumps dispensed. A short shows in red.' },
      { p: 'Only one entry a day can be the final entry. The tank\'s opening for the next day is this closing stock.' },
      { h: 'Saving' },
      { p: 'Save writes the entry to this phone and it shows in the day\'s list straight away. You are then asked to push now or later. The form clears for the next entry.' },
      { p: 'To change a saved entry, tap it in the day\'s list. The form shows Editing entry, and Save becomes Update. Cancel editing goes back to a new entry.' },
      { h: 'Starting a day again' },
      { p: 'At the bottom of a day with entries, Delete this day removes every daily sales entry for that date so it can be entered again from scratch. Lodgements, receipts and lube for the day are not touched. It cannot be undone, and every report covering the date changes.' },
      {
        defs: [
          ['"At least one fuel price is required"', 'Type a price for at least one fuel.'],
          ['"Only one entry can be marked as close-of-business"', 'Final entry is on for more than one entry. Leave it on the last one only.'],
          ['"A close-of-business entry already exists for this date."', 'The day already has a final entry saved. Edit that one, or turn Final entry off on this one.'],
        ],
      },
      { note: 'A wrong closing meter carries forward: the next entry opens on it. Check the meter before saving, and fix a mistake by editing the entry rather than adding another.' },
    ],
  },
  {
    id: 'lodgements',
    title: 'Lodgements in seconds',
    subtitle: 'POS, transfers and bank deposits',
    steps: ["Type each POS terminal's amount", 'Add transfers and deposits', 'Check the cash balance', 'Save'],
    blocks: [
      { p: 'Lodgements records the money the day took in other than cash in hand: POS takings, transfers and what was paid into the bank. It is how the reports work out the cash balance.' },
      { h: 'The sheet' },
      { p: 'Every account set up under Lodgements in the station\'s settings has a row: its bank on the first line, and its terminal and type (POS, Transfer, Cash or Other) under it. Type each one\'s amount. A row left empty is not saved, so you only fill the accounts that took money.' },
      { h: 'Bank deposits' },
      { p: 'A deposit goes to a bank, not a terminal, so the deposit row starts with Select bank. Tap it and pick from the sheet, which lists the station\'s bank deposit accounts. Another deposit adds a second deposit row; Remove takes one away.' },
      { p: 'If the sheet says there are no bank deposit accounts, add one under Lodgements in the station\'s settings.' },
      { h: 'Sales date' },
      { p: 'The day whose sales this money is for. It starts as the entry date. When money is lodged on a later day than it was taken, such as Saturday\'s takings banked on Monday, set the sales date to the day of the sales.' },
      { h: 'The figures' },
      {
        defs: [
          ['Sales', 'The sales date\'s total sales, from Daily Sales.'],
          ['Lodged', 'Everything lodged for that sales date: what is already saved, and this sheet as typed.'],
          ['Cash balance', 'Sales less POS and transfers: the cash that should be in hand or banked. It turns red below zero.'],
        ],
      },
      { p: 'The figures change as you type, so you can see the cash balance before saving.' },
      { h: 'Saving' },
      { p: 'Save makes one entry for each row with an amount, and they show in the day\'s list. You are then asked to push now or later.' },
      { p: 'To change one, tap it in the day\'s list: its row alone opens, and Save becomes Update.' },
      {
        defs: [
          ['"Enter an amount to lodge"', 'Every row is empty. Type at least one amount.'],
          ['"Choose the bank for the deposit"', 'A deposit row has an amount but no bank. Tap Select bank.'],
        ],
      },
      { note: 'A negative cash balance usually means the sales date is wrong, or the day\'s Daily Sales has not been entered yet. Check the sales date first.' },
    ],
  },
  {
    id: 'summary',
    title: 'The day, summed up',
    subtitle: 'Sales, consumption, lodgements and cash, one day at a time',
    steps: ['Pick a day with Prev / Next', 'Read meters and litres sold', 'Check consumption and lodgements', 'Open Balances to see who owes', 'Check sales, POS, transfer and cash'],
    blocks: [
      { p: 'Summary shows one day of the station on one screen: what each pump sold, what was consumed, what was lodged, who owes what, and the cash position.' },
      { h: 'Picking the day' },
      { p: 'Set the date range at the top and tap Load. The report then shows one day of the range at a time; Prev and Next under the tables step through it, with the day\'s place in the range between them.' },
      { h: 'Meter readings' },
      { p: 'A table per fuel: each nozzle\'s opening and closing meter and what it dispensed between them, then the litres less consumption, the price, and the amount sold.' },
      { h: 'Consumption and pour back' },
      { p: 'The day\'s consumption and pour back, each by account and fuel, from the Daily Sales entries.' },
      { h: 'Lodgements' },
      { p: 'Every lodgement account, POS first, then transfers, then deposits, with what each took. An account with nothing shows 0, so a missing POS figure stands out. Total Lodged is under them.' },
      { h: 'Balances' },
      { p: 'The Balances card counts the credit accounts not at zero at the end of the day, with what is owed to the station and what the station owes. Tap it to see each account. From there, an account opens its Account Ledger ending on that day.' },
      { h: 'Product received and totals' },
      { p: 'Deliveries received that day, by volume. Last come the day\'s totals:' },
      {
        defs: [
          ['SALES', 'Every fuel\'s sales amount.'],
          ['TOTAL POS', 'Lodged on POS.'],
          ['TOTAL TRANSFER', 'Lodged by transfer.'],
          ['CASH', 'Sales less POS and transfers.'],
        ],
      },
      { note: 'If a day says No data for this period, nothing was entered for it on this phone. Pull from the station home, then Load again.' },
    ],
  },
  {
    id: 'consumption-fuel-stock',
    title: 'Consumption & fuel stock',
    subtitle: 'Every account, every tank',
    steps: ['Pick a day', 'Read consumption by account', 'See pour back', 'Check closing stock in each tank'],
    blocks: [
      { p: 'Consumption & Fuel Stock answers two questions for a day: where did the fuel that was not sold go, and how much is left in each tank.' },
      { h: 'Picking the day' },
      { p: 'The same as Summary: set the range, Load, and step through it one day at a time with Prev and Next.' },
      { h: 'Consumption' },
      { p: 'Fuel taken off the pumps on account, from the day\'s Daily Sales: each account with its fuel, litres and amount, a total per fuel, and a grand total when more than one fuel was consumed.' },
      { h: 'Pour back' },
      { p: 'Fuel drawn and put back into the tanks, kept in its own table so it is never mistaken for consumption.' },
      { p: 'A day with neither says No consumption or pour back on this day.' },
      { h: 'Fuel stock' },
      { p: 'One row for the day: each tank\'s closing stock from the final entry\'s dips, PMS 1, PMS 2 and so on, with a total for each fuel. A fuel with a single tank has no number and no total.' },
      { note: 'The stock comes from the final entry\'s tank dips. A day whose last Daily Sales entry was not marked Final entry has no stock to show.' },
    ],
  },
  {
    id: 'lube',
    title: 'Lube, sorted',
    subtitle: 'Sales, receipts, stock counts and the Lube Report',
    steps: ['Open Lube stock', 'Pick a product and count it', 'Save', 'Open the Lube Report', 'Stock Summary → Hide empty'],
    blocks: [
      { p: 'Lube has three tabs: Lube sales, Lube receipt and Lube stock. Each saves its own entries for the day, listed beside its form.' },
      { h: 'Lube sales' },
      {
        defs: [
          ['Product', 'Pick it from the list; typing narrows it down.'],
          ['Units sold', 'How many left the shelf.'],
          ['Units received', 'Any that came in with the sale.'],
          ['Price (₦)', 'The price per unit.'],
          ['Account', 'Left as No account (cash) for a cash sale. Pick a credit account for a sale on credit, and it shows on that account\'s ledger.'],
        ],
      },
      { p: 'Under the form are the line\'s amount and the product\'s stock once it is saved.' },
      { h: 'Lube receipt' },
      { p: 'Stock coming in from a supplier: product, units received (needed to save), unit cost, supplier, and the invoice or waybill number. It shows what the delivery cost and the product\'s stock once it is in.' },
      { h: 'Lube stock' },
      { p: 'A count of the shelf. Pick the product and type how many units are there. Under it:' },
      {
        defs: [
          ['Expected', 'What the sales and receipts say should be on the shelf at the end of the day.'],
          ['Variance', 'The count less the expected. Below zero, units are missing.'],
        ],
      },
      { h: 'The Lube Report' },
      { p: 'Two tabs over a date range:' },
      {
        defs: [
          ['Daily Lube Log', 'Every lube sale and lube lodgement by date: product sold, amount, lodgement and a running balance of lube money not yet lodged. Pick an account to see only its lube sales.'],
          ['Stock Summary', 'Each product\'s opening, sales, amount, received, expected closing, actual closing (its latest count in the range) and variance.'],
        ],
      },
      { p: 'On Stock Summary, Hide empty leaves out the products whose closing stock is 0, so the list is only what is on the shelf.' },
      { note: 'Actual closing and variance need a stock count. Count the shelf under Lube stock at least once in the range, or the Stock Summary has only the expected figures to show.' },
    ],
  },
  {
    id: 'account-ledger',
    title: 'Every account, balanced',
    subtitle: 'Who owes the station, and who it owes',
    steps: ["See each account's opening, sales, payments, closing", 'Scroll to prepaid accounts and suppliers', 'Tap an account for every line'],
    blocks: [
      { p: 'Account Ledger is the statement of every credit account: customers who buy on credit, prepaid customers, and suppliers.' },
      { h: 'All accounts' },
      { p: 'Set the period with the two dates at the top. The totals across every account come first: Opening, Sales, Payments and Closing. Then one card per account, most owed first, each with its opening, sales and payments, and its closing balance on the right.' },
      { p: 'A balance in brackets is one the station owes: a prepaid customer\'s credit, or what is due to a supplier. Those sit at the bottom of the list.' },
      { h: 'One account' },
      { p: 'Tap an account for its ledger: the opening balance, then every sale and payment in the period with the balance after each, then the closing balance.' },
      { p: 'Pick more accounts in the account picker for one ledger across them. Each picked account shows as a chip; tap a chip to drop it, or Clear to go back to all accounts.' },
      { h: 'Managing accounts' },
      { p: 'The button beside the dates adds an account, with its name, phone and opening balance. The ⋯ on an account\'s card opens its actions:' },
      {
        defs: [
          ['Open ledger', 'The same as tapping the card.'],
          ['Track in station value', 'Adds the account to Station value, below the list.'],
          ['Edit account', 'Its name, phone and opening balance.'],
          ['Delete account', 'Removes the account. Its transactions are kept, but no longer linked to it.'],
        ],
      },
      { h: 'Station value' },
      { p: 'The accounts you track, together: the credit given, what was collected, and what is outstanding.' },
      { note: 'An account\'s sales and payments come from the Accounts entry screen (Sales amount and Amount paid) and from lube sales put on the account. If a line is missing from a ledger, check that the entry picked the account.' },
    ],
  },
]
