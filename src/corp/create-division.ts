import { NS, Corporation } from 'Bitburner';
import { DivisionName, MaterialName, cities, exportString } from './corporationUtils';
import * as Utils from '../utils';

function hasDivision(ns: NS, divisionName: DivisionName): boolean {
    return ns.corporation.getCorporation().divisions.includes(divisionName);
}

export async function main(ns: NS) {
    const data = ns.flags([
        ['port', '10'],
        ['round', '1'],
    ]);
    const port: number = data.port as number;
    const round: number = data.round as number;
    const port_handle = ns.getPortHandle(port);
    ns.atExit(() => port_handle.tryWrite(Utils.getMyPID(ns)));

    const corp: Corporation = ns.corporation;

    if (round === 2) {
    }
}
