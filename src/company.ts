import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS) {
    const data = ns.flags([['port', 1]]);
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const sin: Singularity = ns.singularity;

    const task = sin.getCurrentWork();
    if (task !== null && task.type !== 'COMPANY') return;
}
