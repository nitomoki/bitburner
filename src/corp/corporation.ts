import { NS, Corporation } from 'Bitburner';
import { DivisionName, MaterialName, cities, exportString } from './corporationUtils';
import * as Utils from '../utils';

const CORP_PORT_NUM = 10;

export async function main(ns: NS) {
    const corp: Corporation = ns.corporation;

    await Utils.asyncExec(ns, CORP_PORT_NUM, 'exportation.js', 'home', 1, ['round', '2']);
}
