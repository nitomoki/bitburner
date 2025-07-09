import { NS } from 'Bitburner';

export async function main(ns: NS): Promise<void> {
    const data = ns.flags([
        ['target', 'n00dles'],
        ['delay', 0],
    ]);

    const target = data.target as string;
    const delay = data.delay as number;
    await ns.hack(target, { additionalMsec: delay });
}
