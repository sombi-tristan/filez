import {
  Rocket, CalendarCheck, FileSpreadsheet, BarChart3, CloudOff,
  UserPlus, CreditCard, Smartphone, LifeBuoy,
} from 'lucide-react'

/**
 * The Help page's content, kept out of the page so that page stays a renderer.
 *
 * Every claim here was checked against the code rather than written from memory: the setup
 * steps against screens/dashboard/setup and the settings accordions, the entry and report lists
 * against lib/stationNav.js, the sync behaviour against lib/sync.js and StationWallet, the
 * statuses against components/SubscriptionBadge.js, and the grace period against the expiry
 * notice on the station hub. If any of those change, this needs changing with them.
 *
 * Shape: [{ id, title, icon, blocks }], where a block is one of
 *   { p: 'paragraph' }
 *   { list: ['item', …] }            bulleted
 *   { steps: ['step', …] }           numbered
 *   { defs: [['term', 'meaning'], …] }
 *   { note: 'callout' }              the one thing in a section worth pulling out
 */
export const HELP_SECTIONS = [
  {
    id: 'getting-started',
    title: 'Getting started',
    icon: Rocket,
    blocks: [
      { p: 'A station has to be described before it can record anything. Setup asks for the physical shape of the station, and every entry screen reads from it afterwards.' },
      {
        steps: [
          'Create the station from All Stations, giving it a name.',
          'Station Location: where it is. This shows under the name everywhere the station is listed.',
          'Nozzles: every pump nozzle, by fuel type and pump number, with its opening meter reading.',
          'Underground Tanks: each tank, by fuel type and tank number, with capacity and opening stock.',
          'Tank to Nozzle Mapping: which tank feeds which nozzle. Without this, stock cannot be reconciled against sales.',
          'Lodgements: the accounts money goes into. Each one is POS, Transfer, Bank Deposit, Cash or Other, with an opening balance.',
          'Lube Products: the lubricants you sell, with unit price and opening stock.',
          'Accounts: customers who buy on credit, with any balance they already owe.',
        ],
      },
      { note: 'Opening readings and opening balances are the starting point every later figure is measured from. A wrong opening value quietly shifts every report after it, so it is worth getting right before the first day is entered.' },
      { p: 'All of it can be changed later under Settings, and you can come back and add nozzles, tanks, products or accounts as the station changes.' },
    ],
  },
  {
    id: 'daily-routine',
    title: 'The daily routine',
    icon: CalendarCheck,
    blocks: [
      { p: 'Most days follow the same shape. Nothing forces this order, but the reports read best when the day is entered this way.' },
      {
        steps: [
          'Record any delivery that arrived, under Product Receipt.',
          'Enter the day\'s meter readings and prices, under Daily Sales.',
          'Record what was banked and taken on POS, under Lodgements.',
          'Enter lube sales and any lube stock received, under Lube.',
          'Record credit sales and any payments collected, under Accounts.',
          'Push, so the day leaves this device.',
        ],
      },
      { p: 'Each entry screen opens on its list of existing entries first, with the button to add a new one on that list. You arrive seeing what is already recorded for the day and step forward to add to it, rather than opening a blank form over data you have forgotten about.' },
      { p: 'A day can hold several entries of the same type, for a station running shifts. Entries you save together keep the order you arranged them in when the day is reopened.' },
    ],
  },
  {
    id: 'entries',
    title: 'The entry screens',
    icon: FileSpreadsheet,
    blocks: [
      { p: 'Five screens, each recording one kind of thing.' },
      {
        defs: [
          ['Daily Sales', 'Nozzle readings, fuel prices and tank stock for a day. This is the sheet the day is built on. One entry can be marked close-of-business, and only one per day can carry that mark.'],
          ['Product Receipt', 'A fuel delivery. Waybill and ticket numbers, truck and driver, depot, arrival and exit times, and the tank dips before and after. One record is written per tank that received volume, so a truck discharging into two tanks produces two records.'],
          ['Lodgements', 'Money leaving the station: bank deposits, POS takings, transfers and cash, against the accounts set up in Settings.'],
          ['Lube', 'Two forms behind one screen. Lube Sales records units sold, units received and price per product. Lube Stock records a stock count per product.'],
          ['Accounts', 'Credit customers. What a customer bought on credit and what they paid, which is what the Account Ledger report is built from.'],
        ],
      },
      { note: 'A station that has not been set up cannot use these screens. If a form says the station is not configured, its Settings are missing the thing that form depends on, such as lube products or customer accounts.' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: BarChart3,
    blocks: [
      { p: 'Reports are grouped by what they answer. All of them read from this device, so pull first if you have just signed in somewhere new.' },
      { p: 'Sales' },
      {
        defs: [
          ['Daily Sales Report', 'One day in full: nozzle sales, POS and cash. The sheet most days get checked against.'],
          ['Summary', 'An overview across a range of dates.'],
          ['Sales Overview', 'Volume, price and amount per fuel, day by day.'],
          ['Sales Operation', 'Sales, stock and reconciliation per shift.'],
          ['Analytics', 'Trends over time: KPIs, stock, variance and revenue.'],
        ],
      },
      { p: 'Stock' },
      {
        defs: [
          ['Inventory Log', 'Daily stock, supply, over and short, and variance.'],
          ['Product Received', 'Deliveries, waybills and shortages.'],
          ['Lube Report', 'Lube sales, stock and lodgements.'],
        ],
      },
      { p: 'Cash and accounts' },
      {
        defs: [
          ['Account Ledger', 'Per-customer credit statement and balances.'],
          ['Imprest', 'Petty cash entries and the imprest sheet.'],
          ['Audit Report', 'A multi-sheet audit pack: sales and cash position, lodgement sheet, stock position, consumption and pour-back.'],
        ],
      },
      { p: 'Several reports export to Excel from the button on the report itself.' },
    ],
  },
  {
    id: 'offline',
    title: 'Working offline, and syncing',
    icon: CloudOff,
    blocks: [
      { p: 'This app saves to the device first and the server second. That is why entries save instantly even on a bad connection, and why you can work through an outage. It is also the part that surprises people, so it is worth understanding.' },
      { p: 'When you save an entry it is written to this device and added to a queue. The entry is real and reports include it immediately. It is not yet on the server, and it is not yet on any other device.' },
      {
        defs: [
          ['Push', 'Sends everything queued on this device to the server. The number on the button is how many items are waiting. Until you push, this device is the only copy.'],
          ['Pull', 'Fetches what is on the server onto this device. Use it when signing in on a new phone or computer, or when someone else has been entering data.'],
          ['Clear queue', 'Empties the queue of items waiting to be pushed. Anything still queued goes with it, so push first if you want to keep it.'],
        ],
      },
      { note: 'If something you entered is not showing on another device, check the pending count first. Work that has not been pushed stays on the device it was entered on. Push before you switch devices, and pull once you arrive.' },
      { p: 'A consolidation runs weekly on the server, on Sunday. The countdown on the station card shows when the next one is due.' },
    ],
  },
  {
    id: 'staff',
    title: 'Staff and permissions',
    icon: UserPlus,
    blocks: [
      { p: 'The station owner can invite staff by email from the Staff section of the station page. The person needs an account on StationMGR, and the invite appears on their dashboard once they sign in with that email address.' },
      { p: 'Each staff member gets their own page access. Open their row in the Staff list to tick which entry screens and which reports they can open. An owner always sees everything.' },
      { p: 'A page a staff member cannot open still shows on their station page, dimmed, and explains itself when tapped. That is deliberate: it tells them the feature exists and who to ask, rather than leaving a hole they cannot describe.' },
      { p: 'Staff can leave a station themselves. An owner can remove them from the Staff list, and access ends immediately.' },
    ],
  },
  {
    id: 'subscription',
    title: 'Subscription',
    icon: CreditCard,
    blocks: [
      { p: 'Each station carries its own subscription, and only its owner can view or change it. Choose the services you want and the number of months, then pay by bank transfer and upload the proof.' },
      {
        defs: [
          ['Pending Payment', 'Created but not paid. Opening Subscription takes you straight back to the payment screen.'],
          ['Pending Approval', 'Payment proof uploaded and waiting on an admin. You are notified when it clears.'],
          ['Approved', 'Active. The expiry date shows on the subscription page, with a warning once seven days or fewer remain.'],
          ['Expired', 'Past its end date.'],
          ['Rejected', 'The payment was not accepted. Contact support before trying again.'],
        ],
      },
      { note: 'An expired subscription has a seven-day grace period. Entries can still be added during it, and the station page counts the days down. After that, new entries are blocked until it is renewed. Existing data stays readable throughout.' },
    ],
  },
  {
    id: 'install',
    title: 'Installing the app',
    icon: Smartphone,
    blocks: [
      { p: 'StationMGR installs to a phone or desktop like an app. Look for the install prompt, or use your browser\'s Install or Add to Home Screen option.' },
      { p: 'Installed, it opens in its own window with no browser chrome, and works without a connection. Entries made offline queue up and go out on the next push.' },
      { p: 'Updates arrive on their own. If a change you were expecting has not appeared, close the app fully and reopen it.' },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: LifeBuoy,
    blocks: [
      {
        defs: [
          ['Entries are missing on another device', 'They have not been pushed yet. Push from the device they were entered on, then pull here. Push before clearing the queue on that device, so nothing waiting is lost.'],
          ['A page says access denied', 'Your account does not have that page. The station owner can grant it from your row in the Staff list.'],
          ['I cannot add entries', 'Either the subscription has expired past its grace period, or the station is missing the setup that screen depends on. The station page shows which.'],
          ['A report looks empty or out of date', 'Reports read from this device. Pull first, particularly on a device you have just signed in on.'],
          ['The pending count will not go down', 'A push failed. Push again with a connection; the result window lists anything the server rejected.'],
        ],
      },
      { p: 'Anything not covered here, send it below. The message reaches us with your account attached, so there is no need to repeat which station you mean.' },
    ],
  },
]
