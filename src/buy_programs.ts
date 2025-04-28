import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS): Promise<void> {
    const data = ns.flags([['port', '1']]);
    const sin: Singularity = ns.singularity;
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    let program_list = sin.getDarkwebPrograms();
    if (program_list.length === 0) {
        if (!sin.purchaseTor()) {
            ns.exit();
        }
        program_list = sin.getDarkwebPrograms();
    }

    for (const program of program_list) {
        const cost = sin.getDarkwebProgramCost(program);
        if (cost > ns.getServerMoneyAvailable('home')) {
            continue;
        }
        sin.purchaseProgram(program);
    }
}
