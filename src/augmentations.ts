import { NS, Singularity } from 'Bitburner';
import * as Utils from './utils';

const preferredEarlyFactionOrder = [
    // "Netburners", // Improve hash income, which is useful or critical for almost all BNs
    'Tian Di Hui',
    'Aevum', // These give all the company_rep and faction_rep bonuses early game
    'Daedalus', // Once we have all faction_rep boosting augs, there's no reason not to work towards Daedalus as soon as it's available/feasible so we can buy Red Pill
    'CyberSec',
    /* Quick, and NightSec aug depends on an aug from here */ 'NiteSec',
    'Tetrads', // Cha augs to speed up earning company promotions
    'Bachman & Associates', // Boost company/faction rep for future augs
    'The Black Hand', // Fastest sources of hacking augs after the above companies
    'BitRunners', // Fast source of some unique hack augs
    'Fulcrum Secret Technologies', // Will be removed if hack level is too low to backdoor their server
    'ECorp', // More cmp_rep augs, and some strong hack ones as well
    'The Dark Army', // Unique cmp_rep aug TODO: Can it sensibly be gotten before megacorps? Requires 300 all combat stats.
    'Clarke Incorporated',
    'OmniTek Incorporated',
    'NWO', // More hack augs from companies
    'Chongqing', // Unique Source of big 1.4x hack exp boost (Can only join if not in e.g. Aevum as well)
];

const neuroFluxGovernor = 'NeuroFlux Governor';

function shouldDonateToFaction(ns: NS, faction: string): boolean {
    const sin = ns.singularity;
    return sin.getFactionFavor(faction) >= ns.getFavorToDonate();
}

function safePurchaseAugmentations(ns: NS, faction: string, augmentations: string[]): boolean {
    const sin = ns.singularity;
    const stack = [...augmentations.slice().reverse()];
    const ownedAugs = new Set(sin.getOwnedAugmentations(true));
    const seen = new Set<string>();

    while (stack.length !== 0) {
        const currentAug = stack.pop()!;
        if (ownedAugs.has(currentAug)) continue;

        const requiredAug = sin
            .getAugmentationPrereq(currentAug)
            .filter((aug) => !ownedAugs.has(aug) && !seen.has(aug));
        if (requiredAug.length > 0) {
            stack.push(currentAug, ...requiredAug);
            requiredAug.forEach((aug) => seen.add(aug));
            continue;
        }
        if (sin.getAugmentationPrice(currentAug) > ns.getServerMoneyAvailable('home')) {
            return false;
        }
        sin.purchaseAugmentation(faction, currentAug);
        ownedAugs.add(currentAug);
    }
    return true;
}

function getNotPurchasedAugmentations(ns: NS, faction: string) {
    const sin = ns.singularity;
    const augmentations = sin
        .getAugmentationsFromFaction(faction)
        .filter((aug) => !sin.getOwnedAugmentations(true).includes(aug) && aug != neuroFluxGovernor)
        .filter((aug) =>
            sin
                .getAugmentationPrereq(aug)
                .every(
                    (reqAug) =>
                        sin.getAugmentationsFromFaction(faction).includes(reqAug) ||
                        sin.getOwnedAugmentations(true).includes(reqAug),
                ),
        )
        .sort((a, b) => sin.getAugmentationRepReq(b) - sin.getAugmentationRepReq(a));
    return augmentations;
}

function getCostOfReputaion(ns: NS, faction: string, rep: number) {
    const bitNodeMultipliers = ns.getBitNodeMultipliers();
    const factionWorkRepGain = bitNodeMultipliers?.FactionWorkRepGain ?? 1;

    if (ns.singularity.getFactionRep(faction) < ns.getFavorToDonate()) {
        return Infinity;
    }

    return Math.ceil((1e6 * rep) / ns.getPlayer().mults.faction_rep / factionWorkRepGain);
}

export async function main(ns: NS) {
    const data = ns.flags([['port', '10']]);
    const sin: Singularity = ns.singularity;
    const port: number = data.port as number;
    const me = ns.getPlayer();
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const available_factions = preferredEarlyFactionOrder
        .filter((faction) => {
            return me.factions.includes(faction);
        })
        .filter((faction) => {
            return sin.getAugmentationsFromFaction(faction).some((aug) => {
                return !sin.getOwnedAugmentations(true).includes(aug) && aug !== neuroFluxGovernor;
            });
        });
    ns.print(available_factions);

    if (available_factions.length === 0) return;

    const faction = available_factions.at(0) as string;
    const augmentations = getNotPurchasedAugmentations(ns, faction);
    const maxRep = Math.max(...augmentations.map((aug) => sin.getAugmentationRepReq(aug)));
    if (shouldDonateToFaction(ns, faction)) {
        const cost = getCostOfReputaion(ns, faction, maxRep - sin.getFactionRep(faction));
        sin.donateToFaction(faction, cost);
    }

    if (augmentations.some((aug) => sin.getAugmentationRepReq(aug) > sin.getFactionRep(faction))) {
        sin.workForFaction(faction, 'hacking', true);
        return;
    }

    const isAllPurchsed = safePurchaseAugmentations(ns, faction, augmentations);
    if (!isAllPurchsed) return;

    if (getNotPurchasedAugmentations(ns, faction).length === 0) {
        for (const faction of available_factions) {
            while (
                sin.getAugmentationPrice(neuroFluxGovernor) < ns.getServerMoneyAvailable('home') &&
                sin.getAugmentationRepReq(neuroFluxGovernor) < sin.getFactionRep(faction)
            ) {
                sin.purchaseAugmentation(faction, neuroFluxGovernor);
                await ns.sleep(20);
            }
        }
        sin.installAugmentations('batch.js');
    }
}
