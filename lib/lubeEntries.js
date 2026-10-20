/**
 * A lube receipt is a lube entry that only brings units in: nothing sold, units received. The
 * Lube form's Receipt tab writes them and its Sales tab shows the rest, as does the Lube list.
 * (A sale typed with only units received, before the Receipt tab, counts as a receipt too: that
 * is what it was.)
 */
export const isReceipt = (e) => !(Number(e.unitSold) > 0) && Number(e.unitReceived) > 0
