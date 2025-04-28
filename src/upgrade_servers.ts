import { NS } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS) {
    const data = ns.flags([['port', '1']]);
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    ns.disableLog('ALL');
    ns.enableLog('printf');
    const purchasedServers = ns.getPurchasedServers();
    if (purchasedServers.length < ns.getPurchasedServerLimit()) {
        return;
    }
    while (true) {
        const rams = purchasedServers.map((hostname) => {
            return ns.getServerMaxRam(hostname);
        });
        const min_ram = Math.min(...rams);
        if (min_ram === ns.getPurchasedServerMaxRam()) {
            break;
        }
        for (const hostname of purchasedServers) {
            const current_ram = ns.getServerMaxRam(hostname);
            const cost = ns.getPurchasedServerUpgradeCost(
                hostname,
                current_ram * 2,
            );
            ns.printf(
                'hostname: %s RAM: %d Cost: %d',
                hostname,
                current_ram,
                cost,
            );
            if (current_ram != min_ram) {
                continue;
            }
            if (ns.getServerMoneyAvailable('home') > cost) {
                ns.upgradePurchasedServer(hostname, current_ram * 2);
            }
        }
        const min_cost = Math.min(
            ...purchasedServers.map((hostname) =>
                ns.getPurchasedServerUpgradeCost(
                    hostname,
                    2 * ns.getServerMaxRam(hostname),
                ),
            ),
        );
        const currentMoney = ns.getServerMoneyAvailable('home');
        if (min_cost > currentMoney) {
            ns.printf('min cost: %d current money: %d', min_cost, currentMoney);
            break;
        }
        await ns.sleep(20);
    }
}
