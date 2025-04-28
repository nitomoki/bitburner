import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

const SUB_PORT_NUM = 2;

type FactionRequirement = {
    name: string;
    location: 'New Tokyo' | 'Aevum';
    money: number;
    hack_level: number;
};

const neuroFluxGovernor = 'NeuroFlux Governor';
const preferred_early_factions: FactionRequirement[] = [
    {
        name: 'Tian Di Hui',
        location: 'New Tokyo',
        money: 1_000_000,
        hack_level: 50,
    },
    { name: 'Aevum', location: 'Aevum', money: 40_000_000, hack_level: 0 }, // These give all the company_rep and faction_rep bonuses early game
];

export async function main(ns: NS): Promise<void> {
    const data = ns.flags([['port', '1']]);
    const sin: Singularity = ns.singularity;
    const target_hostnames: string[] = [
        'CSEC',
        'avmnite-02h',
        'I.I.I.I',
        'run4theh111z',
    ];
    const port: number = data.port as number;
    const port_handle = ns.getPortHandle(port);
    const me = ns.getPlayer();
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    for (const hostname of target_hostnames) {
        ns.print(hostname);
        const server = ns.getServer(hostname);
        if (
            !server.backdoorInstalled &&
            server.hasAdminRights &&
            (server.requiredHackingSkill as number) <= ns.getHackingLevel()
        ) {
            await Utils.asyncExec(ns, SUB_PORT_NUM, 'backdoor.js', 'home', 1, [
                '--target',
                server.hostname,
            ]);
        }
    }

    const joinableFactions = preferred_early_factions.filter(
        (faction) =>
            me.money > 200_000 * preferred_early_factions.length && // enough money to travel
            me.money > faction.money && // enough money to join
            me.skills.hacking >= faction.hack_level && // hacking level requirement
            !me.factions.includes(faction.name) && // skip already joined faction
            sin
                .getAugmentationsFromFaction(faction.name)
                .some(
                    (aug) =>
                        !sin.getOwnedAugmentations(true).includes(aug) &&
                        aug !== neuroFluxGovernor,
                ), // check owned augmentations
    );
    for (const faction of joinableFactions) {
        sin.travelToCity(faction.location);
        await ns.sleep(1000 * 30);
        sin.joinFaction(faction.name);
    }

    const factions = sin.checkFactionInvitations();
    for (const faction of factions) {
        const enemies = sin.getFactionEnemies(faction);
        if (enemies.length === 0) {
            sin.joinFaction(faction);
        }
    }
    sin.connect('home');
}
