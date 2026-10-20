/**
 * Lube sales on an account (migration 057, lube_sales_entries.customer_id) as that account's
 * transactions: each is a sale on credit of units sold x price, shaped like the account's own
 * entries (customerPayments: salesAmount, amountPaid), so every balance - the Account Ledger,
 * the Daily Sales Report's Balances, the Accounts form's before and after - counts them by
 * adding these to the account's entries, with no second way of working a balance out.
 *
 * A lube receipt names a supplier, not a customer: it moves no balance.
 */
export function lubeOnAccount(lubeSales, products = []) {
  const productName = (id) => products.find((p) => p.id === id)?.product_name || 'lube'
  return (lubeSales || [])
    .filter((s) => s.customerId && Number(s.unitSold) > 0)
    .map((s) => ({
      id: `lube:${s.id}`,
      orgId: s.orgId,
      customerId: s.customerId,
      entryDate: s.entryDate,
      createdAt: s.createdAt,
      salesAmount: (Number(s.unitSold) || 0) * (Number(s.price) || 0),
      amountPaid: 0,
      notes: `Lube: ${productName(s.productId)} x ${Number(s.unitSold)}`,
    }))
}
