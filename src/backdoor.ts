import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';
import { ServerNode } from './utils';

export async function main(ns: NS): Promise<void> {
    ns.print(new Date());
    ns.disableLog('scan');
    const data = ns.flags([
        ['target', 'n00dles'],
        ['port', '1'],
    ]);
    ns.print(new Date());
    const sin: Singularity = ns.singularity;
    const target: string = data.target as string;
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.print(new Date());
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const server_node = new ServerNode(ns, 'home');
    ns.print(new Date());
    server_node.makeTree();
    const path = server_node.getPath(target);

    await 0;
    const server = ns.getServer(target);

    ns.print(new Date());
    if (!server.backdoorInstalled) {
        for (const hostname of path) {
            sin.connect(hostname);
        }
        ns.clearLog();
        ns.tail();
        await sin.installBackdoor();
        ns.closeTail();
        for (const hostname of path.reverse()) {
            sin.connect(hostname);
        }
    }
    ns.print(new Date());
}
