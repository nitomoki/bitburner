import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS): Promise<void> {
    const sin: Singularity = ns.singularity;
    const data = ns.flags([['port', '1']]);

    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const money = ns.getServerMoneyAvailable('home');
    ns.printf(
        'money: %s, ramcost: %s, corescost: %s',
        money,
        sin.getUpgradeHomeRamCost(),
        sin.getUpgradeHomeCoresCost(),
    );
    while (
        money > sin.getUpgradeHomeRamCost() ||
        money > sin.getUpgradeHomeCoresCost()
    ) {
        const res_ram: boolean = sin.upgradeHomeRam();
        const res_cores: boolean = sin.upgradeHomeCores();
        if (!res_ram && !res_cores) {
            break;
        }
        await ns.sleep(20);
    }
}
