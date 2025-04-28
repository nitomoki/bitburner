import { NS } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS): Promise<void> {
    const data = ns.flags([['port', '1']]);
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const ram = 8;
    const purchasedServers = ns.getPurchasedServers();
    let i = purchasedServers.length;
    if (i >= 25) {
        return;
    }

    while (
        ns.getServerMoneyAvailable('home') > ns.getPurchasedServerCost(ram) &&
        ns.getPurchasedServers().length < ns.getPurchasedServerLimit()
    ) {
        ns.purchaseServer('pserv_' + String(i).padStart(2, '0'), ram);
        i++;
        await ns.sleep(20);
    }
}
