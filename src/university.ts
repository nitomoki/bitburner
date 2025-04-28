import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

export async function main(ns: NS): Promise<void> {
    const sin: Singularity = ns.singularity;
    const data = ns.flags([['port', '1']]);

    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    sin.universityCourse('Rothman University', 'Computer Science', true);
    await ns.sleep(1000 * 30);
}
