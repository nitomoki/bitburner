import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';
import { ServerNode } from './utils';

const WORLD_DAEMON = 'w0r1d_d43m0n';

export async function main(ns: NS): Promise<void> {
    const data = ns.flags([['port', '20']]);
    const sin: Singularity = ns.singularity;
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    if (
        !ns.fileExists('BruteSSH.exe') ||
        !ns.fileExists('FTPCrack.exe') ||
        !ns.fileExists('relaySMTP.exe') ||
        !ns.fileExists('HTTPWorm.exe') ||
        !ns.fileExists('SQLInject.exe') ||
        !sin.getOwnedAugmentations(true).includes('The Red Pill')
    ) {
        ns.exit();
    }

    const requiredHackingSkill = ns.getServer(WORLD_DAEMON).requiredHackingSkill as number;
    ns.print(requiredHackingSkill);
    if (ns.getHackingLevel() < requiredHackingSkill) ns.exit();

    const server_node = new ServerNode(ns, 'home');
    server_node.makeTree();
    const path = server_node.getPath(WORLD_DAEMON);

    ns.brutessh(WORLD_DAEMON);
    ns.ftpcrack(WORLD_DAEMON);
    ns.relaysmtp(WORLD_DAEMON);
    ns.httpworm(WORLD_DAEMON);
    ns.sqlinject(WORLD_DAEMON);
    ns.nuke(WORLD_DAEMON);

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
