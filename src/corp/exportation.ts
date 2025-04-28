import { NS, Corporation } from 'Bitburner';
import { DivisionName, MaterialName, cities, exportString } from './corporationUtils';
import * as Utils from '../utils';

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
        for (const city of cities) {
            corp.cancelExportMaterial(DivisionName.AGRICULTURE, city, DivisionName.CHEMICAL, city, MaterialName.PLANTS);
            corp.cancelExportMaterial(DivisionName.CHEMICAL, city, DivisionName.AGRICULTURE, city, MaterialName.CHEMICALS);

            corp.exportMaterial(DivisionName.AGRICULTURE, city, DivisionName.CHEMICAL, city, MaterialName.PLANTS, exportString);
            corp.exportMaterial(DivisionName.CHEMICAL, city, DivisionName.AGRICULTURE, city, MaterialName.CHEMICALS, exportString);

            corp.sellMaterial(DivisionName.CHEMICAL, city, MaterialName.CHEMICALS, 'MAX', 'MP');
        }
    }
}
