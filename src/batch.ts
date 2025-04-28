import { NS, Formulas, Server } from 'Bitburner';
import * as Utils from './utils';
import { ServerNode } from './utils';

type availableBatchSize = {
    isOK: true;
    thread: {
        hackThread: number;
        growThread: number;
        weakenThread1: number;
        weakenThread2: number;
    };
};
type unavailableBatchSize = { isOK: false };
type batchSize = availableBatchSize | unavailableBatchSize;
type strategy = {
    target: string;
    home: { batchSize: batchSize; batchTimes: number };
    others: { batchSize: batchSize; batchTimes: number };
};

const HACKSCRIPT = 'hack.js';
const GROWSCRIPT = 'grow.js';
const WEAKENSCRIPT = 'weaken.js';
const MAINPORTNUM = 1;
const UNITSECURITYLEVEL = { hack: 0.002, grow: 0.004, weaken: 0.005 };

function isServerOptimized(ns: NS, hostname: string): boolean {
    const server = ns.getServer(hostname);
    const isMoneyMaximized = server.moneyMax === server.moneyAvailable;
    const isSecurityLevelMinimized = server.minDifficulty === server.hackDifficulty;
    return isMoneyMaximized && isSecurityLevelMinimized;
}

class BatchController {
    static ns: NS;
    static formulas: Formulas;
    private allServerHostnames: string[];
    private hackScript: string;
    private growScript: string;
    private weakenScript: string;
    private unitInterval = 10; //ms

    constructor() {
        this.hackScript = HACKSCRIPT;
        this.growScript = GROWSCRIPT;
        this.weakenScript = WEAKENSCRIPT;

        const serverNode = new ServerNode(BatchController.ns, 'home');
        serverNode.makeTree();
        this.allServerHostnames = [...BatchController.ns.getPurchasedServers(), ...serverNode.getAllNodes()];
    }

    private deployScript(hostname: string, scriptName: string) {
        const ns = BatchController.ns;
        if (hostname != 'home' && ns.fileExists(scriptName, hostname)) {
            ns.rm(scriptName, hostname);
        }
        ns.scp(scriptName, hostname);
    }

    public getAllServers() {
        const ns = BatchController.ns;
        const serverList = [];
        const serverNode = new ServerNode(BatchController.ns, 'home');
        serverNode.makeTree();
        this.allServerHostnames = [...BatchController.ns.getPurchasedServers(), ...serverNode.getAllNodes()];
        for (const hostname of this.allServerHostnames) {
            serverList.push(ns.getServer(hostname));
        }
        return serverList;
    }

    public tryGetAdmin(): string[] {
        const ns = BatchController.ns;
        const successedList: string[] = [];
        const serverList = this.getAllServers();
        for (const server of serverList) {
            const hostname = server.hostname;
            if (server.hasAdminRights) {
                continue;
            }
            if (ns.getServerNumPortsRequired(hostname) > 0) {
                if (!ns.fileExists('BruteSSH.exe')) {
                    continue;
                }
                ns.brutessh(hostname);
            }
            if (ns.getServerNumPortsRequired(hostname) > 1) {
                if (!ns.fileExists('FTPCrack.exe')) {
                    continue;
                }
                ns.ftpcrack(hostname);
            }
            if (ns.getServerNumPortsRequired(hostname) > 2) {
                if (!ns.fileExists('relaySMTP.exe')) {
                    continue;
                }
                ns.relaysmtp(hostname);
            }
            if (ns.getServerNumPortsRequired(hostname) > 3) {
                if (!ns.fileExists('HTTPWorm.exe')) {
                    continue;
                }
                ns.httpworm(hostname);
            }
            if (ns.getServerNumPortsRequired(hostname) > 4) {
                if (!ns.fileExists('SQLInject.exe')) {
                    continue;
                }
                ns.sqlinject(hostname);
            }
            ns.nuke(hostname);
            successedList.push(hostname);
        }
        return successedList;
    }

    private runScriptForSumThread(
        target: string,
        scriptName: string,
        sumThread: number,
        delay: number,
        isHome: boolean,
    ) {
        const ns = BatchController.ns;
        if (isHome) {
            if (sumThread <= 0) {
                return;
            }
            ns.exec(scriptName, 'home', sumThread, '--target', target, '--delay', delay);
        } else {
            let remainThread = sumThread;
            const serverList = this.getAllServers();
            for (const server of serverList) {
                if (server.hostname === 'home' || !server.hasAdminRights) {
                    continue;
                }
                if (remainThread <= 0) {
                    break;
                }
                const thread = Math.floor(
                    (server.maxRam - ns.getServerUsedRam(server.hostname)) / ns.getScriptRam(scriptName),
                );
                if (thread <= 0) {
                    continue;
                }
                ns.exec(
                    scriptName,
                    server.hostname,
                    Math.min(remainThread, thread),
                    '--target',
                    target,
                    '--delay',
                    delay,
                );
                remainThread = remainThread - thread;
            }
        }
    }

    public async waitUntilServerOptimalState(target: string): Promise<boolean> {
        const ns = BatchController.ns;
        // ns.tprint("waituntilserveroptimalstate");
        const serverList = this.getAllServers();
        for (const server of serverList) {
            this.deployScript(server.hostname, this.growScript);
            this.deployScript(server.hostname, this.weakenScript);
        }
        const calculateDelays = () => {
            const growTime = ns.getGrowTime(target);
            const weakenTime = ns.getWeakenTime(target);
            return {
                growTime,
                weakenTime,
                growDelay: Math.max(0, weakenTime - growTime - 100),
                weakenDelay: Math.max(0, growTime - weakenTime + 100),
            };
        };

        const calculateAvailableRam = () => {
            const sumRam = serverList.reduce(
                (acc, server) =>
                    server.hostname != 'home' && server.hasAdminRights ? acc + server.maxRam - server.ramUsed : acc,
                0,
            );
            const homeRam = ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
            return { sumRam, homeRam };
        };

        const calculateThreads = (sumRam: number, homeRam: number) => {
            const scriptRam = ns.getScriptRam(this.growScript);
            const sumThreadNum = Math.floor(sumRam / scriptRam);
            const homeThreadNum = Math.floor(homeRam / scriptRam);
            const isGrowNeeded =
                ns.getServerSecurityLevel(target) === ns.getServerMinSecurityLevel(target) &&
                ns.getServerMaxMoney(target) !== ns.getServerMoneyAvailable(target);
            const sumGrowThread = isGrowNeeded ? Math.floor((sumThreadNum * 5) / 9) : 0;
            const homeGrowThread = isGrowNeeded ? Math.floor((sumThreadNum * 5) / 9) : 0;
            return {
                sumGrowThread,
                homeGrowThread,
                sumWeakenThread: sumThreadNum - sumGrowThread,
                homeWeakenThread: homeThreadNum - homeGrowThread,
            };
        };

        // ns.print("target: ", target);
        const server = ns.getServer(target);
        ns.print(
            'target: ',
            server.hostname,
            ' moneyMax: ',
            server.moneyMax,
            ' currentMoney: ',
            server.moneyAvailable,
            ' minSecurity: ',
            server.minDifficulty,
            ' currentSecurity: ',
            server.hackDifficulty,
        );
        if (isServerOptimized(ns, target)) {
            return false;
        }

        const { growTime, weakenTime, growDelay, weakenDelay } = calculateDelays();
        const { sumRam, homeRam } = calculateAvailableRam();
        const { sumGrowThread, homeGrowThread, sumWeakenThread, homeWeakenThread } = calculateThreads(sumRam, homeRam);

        [
            { script: this.growScript, thread: sumGrowThread, delay: growDelay, isHome: false },
            { script: this.weakenScript, thread: sumWeakenThread, delay: weakenDelay, isHome: false },
            { script: this.growScript, thread: homeGrowThread, delay: growDelay, isHome: true },
            { script: this.weakenScript, thread: homeWeakenThread, delay: weakenDelay, isHome: true },
        ].forEach(({ script, thread, delay, isHome }) => {
            if (thread > 0) {
                this.runScriptForSumThread(target, script, thread, delay, isHome);
            }
        });
        await ns.sleep(Math.max(growTime + growDelay, weakenTime + weakenDelay) + 1000);
        return true;
    }

    public async runBatchFromStrategy(strategy: strategy) {
        const ns = BatchController.ns;
        const unitInterval = this.unitInterval; //ms

        const target = strategy.target;
        const batchHome = strategy.home;
        const batchOthers = strategy.others;

        const hackTime = ns.getHackTime(target);
        const growTime = ns.getGrowTime(target);
        const weakenTime = ns.getWeakenTime(target);
        const maxTime = Math.max(hackTime, growTime, weakenTime);

        const rams = {
            hack: ns.getScriptRam(this.hackScript),
            grow: ns.getScriptRam(this.growScript),
            weaken: ns.getScriptRam(this.weakenScript),
        };

        const calculateDelays = (extraInterval: number) => ({
            hack: (maxTime - hackTime + extraInterval).toString(),
            weaken1: (maxTime - weakenTime + unitInterval + extraInterval).toString(),
            grow: (maxTime - growTime + unitInterval * 2 + extraInterval).toString(),
            weaken2: (maxTime - weakenTime + unitInterval * 3 + extraInterval).toString(),
        });

        if (batchHome.batchSize.isOK) {
            for (let i: number = 0; i < batchHome.batchTimes; i++) {
                const extraInterval = unitInterval * i * 4;
                const threads = batchHome.batchSize.thread;
                const delays = calculateDelays(extraInterval);

                for (const [script, thread, delay] of [
                    [this.hackScript, threads.hackThread, delays.hack],
                    [this.weakenScript, threads.weakenThread1, delays.weaken1],
                    [this.growScript, threads.growThread, delays.grow],
                    [this.weakenScript, threads.weakenThread2, delays.weaken2],
                ] as const) {
                    Utils.safeExec(ns, script, 'home', thread, ['--target', target, '--delay', delay as string]);
                }
            }
        }

        const availableServers = this.getAllServers().filter(
            (server) => server.hostname !== 'home' && server.hasAdminRights,
        );
        for (const server of availableServers) {
            this.deployScript(server.hostname, this.hackScript);
            this.deployScript(server.hostname, this.growScript);
            this.deployScript(server.hostname, this.weakenScript);
        }

        if (batchOthers.batchSize.isOK) {
            for (let i: number = 0; i < batchOthers.batchTimes; i++) {
                const extraInterval = unitInterval * (i + batchHome.batchTimes) * 4;
                const delays = calculateDelays(extraInterval);

                const remainingThreads = {
                    hack: batchOthers.batchSize.thread.hackThread,
                    grow: batchOthers.batchSize.thread.growThread,
                    weaken1: batchOthers.batchSize.thread.weakenThread1,
                    weaken2: batchOthers.batchSize.thread.weakenThread2,
                };

                for (const server of availableServers) {
                    let availableRam = ns.getServerMaxRam(server.hostname) - ns.getServerUsedRam(server.hostname);
                    for (const [type, script, ram, delay] of [
                        ['hack', this.hackScript, rams.hack, delays.hack],
                        ['weaken1', this.weakenScript, rams.weaken, delays.weaken1],
                        ['grow', this.growScript, rams.grow, delays.grow],
                        ['weaken2', this.weakenScript, rams.weaken, delays.weaken2],
                    ] as const) {
                        if (availableRam < ram) break;
                        if (remainingThreads[type] <= 0) continue;
                        const thread = Math.min(Math.floor(availableRam / ram), remainingThreads[type]);
                        Utils.safeExec(ns, script, server.hostname, thread, ['--target', target, '--delay', delay]);
                        availableRam -= ram * thread;
                        remainingThreads[type] -= thread;
                    }
                    if (Object.values(remainingThreads).every((t) => t <= 0)) break;
                }
            }
        }
        await ns.asleep(maxTime + unitInterval * 4 * (1 + batchHome.batchTimes + batchOthers.batchTimes));
    }

    private getBatchSizeFromHackThread(target: string, hackThread: number, isHome: boolean): batchSize {
        const ns = BatchController.ns;
        const formulas = BatchController.formulas;
        const me = ns.getPlayer();
        const serverList = this.getAllServers();
        const availableServer = serverList.filter((server) => server.hostname !== 'home' && server.hasAdminRights);
        const optimalServer = this.getOptimalServer(target);

        optimalServer.moneyAvailable =
            optimalServer.moneyAvailable! * (1 - formulas.hacking.hackPercent(optimalServer, me) * hackThread);
        const growThread = Math.ceil(
            formulas.hacking.growThreads(
                optimalServer,
                me,
                optimalServer.moneyMax!,
                isHome ? ns.getServer('home').cpuCores : 1,
            ) * 1.05,
        );
        const weakenThread1 = Math.ceil((hackThread * UNITSECURITYLEVEL.hack) / UNITSECURITYLEVEL.weaken) + 1;
        const weakenThread2 = Math.ceil((growThread * UNITSECURITYLEVEL.grow) / UNITSECURITYLEVEL.weaken) + 1;

        const sumRam =
            hackThread * ns.getScriptRam(this.hackScript) +
            growThread * ns.getScriptRam(this.growScript) +
            (weakenThread1 + weakenThread2) * ns.getScriptRam(this.weakenScript);
        let availableRam = 0;
        if (isHome) {
            availableRam = ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
        } else {
            availableRam = availableServer.reduce((acc, server) => {
                return acc + server.maxRam - server.ramUsed;
            }, 0);
        }

        if (sumRam > availableRam) {
            return { isOK: false };
        }

        return {
            isOK: true,
            thread: {
                hackThread: hackThread,
                growThread: growThread,
                weakenThread1: weakenThread1,
                weakenThread2: weakenThread2,
            },
        };
    }

    private getBatchSizeFromRate(target: string, moneyRate: number, isHome: boolean): batchSize {
        const ns = BatchController.ns;
        const formulas = BatchController.formulas;

        const me = ns.getPlayer();
        const optimalServer = ns.getServer(target);

        const hackThread = Math.max(Math.floor(moneyRate / formulas.hacking.hackPercent(optimalServer, me)), 1);
        if (!isFinite(hackThread)) {
            return { isOK: false };
        }
        const optimalBatchSize = this.getBatchSizeFromHackThread(target, hackThread, isHome);

        return optimalBatchSize;
    }

    private seekOptimalBatchSize(target: string, isHome: boolean): batchSize {
        let rate = 0.8;
        const candidates: { batchSize: batchSize; score: number }[] = [];
        const seekTimes = 1000;
        for (let i: number = 0; i != seekTimes; i++) {
            rate = rate * (1 - (1 / seekTimes) * i);
            const batchSize = this.getBatchSizeFromRate(target, rate, isHome);
            if (batchSize.isOK) {
                const ram = this.getSumRamOfBatchSize(batchSize);
                const batchtimes = this.getBatchTimes(batchSize, isHome);
                const waitTime = this.getBatchWaitTime(batchtimes, target);
                if (ram === 0) continue;
                candidates.push({
                    batchSize: batchSize,
                    score: (rate * batchtimes) / waitTime,
                });
            }
        }
        if (candidates.length !== 0) {
            return candidates.sort((a, b) => b.score - a.score).at(0)?.batchSize as batchSize;
        }
        let i: number = 1;
        let batchSize: batchSize = this.getBatchSizeFromHackThread(target, i, isHome);
        while (i != seekTimes && batchSize.isOK) {
            batchSize = this.getBatchSizeFromHackThread(target, i, isHome);
            i++;
        }
        return batchSize;
    }

    private getOptimalServer(target: string): Server {
        const ns = BatchController.ns;
        const optimalServer = ns.getServer(target);
        optimalServer.moneyAvailable = optimalServer.moneyMax!;
        optimalServer.hackDifficulty = optimalServer.minDifficulty!;
        return optimalServer;
    }

    public isRunableSmallestBatch(target: string, isHome: boolean): boolean {
        const batchSize = this.getBatchSizeFromHackThread(target, 1, isHome);
        if (!batchSize.isOK) return false;
        const batchTimes = this.getBatchTimes(batchSize, isHome);
        return batchTimes !== 0;
    }

    private getBatchTimes(batchSize: availableBatchSize, isHome: boolean, ramUsed: number = 0): number {
        // const serverList = this.getAllServers();
        const ramForOnce = this.getSumRamOfBatchSize(batchSize);
        // const availableServer = serverList.filter(server => (isHome && server.hostname === "home") || (!isHome && server.hostname !== "home" && server.hasAdminRights));
        // const sumAvailableRam = availableServer.reduce((acc, server) => acc + server.maxRam - server.ramUsed, 0);
        const sumAvailableRam = this.getSumAvailaleRam(isHome) - ramUsed;
        const batchTimes = ramForOnce !== 0 && sumAvailableRam > 0 ? Math.floor(sumAvailableRam / ramForOnce) : 0;
        return batchTimes;
    }

    private getSumAvailaleRam(isHome: boolean): number {
        const serverList = this.getAllServers();
        const availableServer = serverList.filter(
            (server) =>
                (isHome && server.hostname === 'home') ||
                (!isHome && server.hostname !== 'home' && server.hasAdminRights),
        );
        const sumAvailableRam = availableServer.reduce((acc, server) => acc + server.maxRam - server.ramUsed, 0);
        return Math.max(0, sumAvailableRam - (isHome ? 64 : 0));
    }

    private getBatchWaitTime(batchTimes: number, target: string): number {
        const unitInterval = 10;
        const ns = BatchController.ns;
        const hackTime = ns.getHackTime(target);
        const growTime = ns.getGrowTime(target);
        const weakenTime = ns.getWeakenTime(target);
        const maxTime = Math.max(hackTime, growTime, weakenTime);

        const weakenDelay2 = maxTime - weakenTime + unitInterval * 3;
        const waitTime = weakenTime + weakenDelay2 + unitInterval * 4 * batchTimes;
        return waitTime;
    }

    private getSumRamOfBatchSize(batchSize: availableBatchSize): number {
        const ns = BatchController.ns;
        const hackRam = ns.getScriptRam(this.hackScript);
        const growRam = ns.getScriptRam(this.growScript);
        const weakenRam = ns.getScriptRam(this.weakenScript);
        const ramForOnce =
            batchSize.thread.hackThread * hackRam +
            batchSize.thread.growThread * growRam +
            (batchSize.thread.weakenThread1 + batchSize.thread.weakenThread2) * weakenRam;
        return ramForOnce;
    }

    public getBestTarget(): string {
        return this.getScoringTargets().at(0) ?? '';
    }

    private getScoringTargets(): string[] {
        const ns = BatchController.ns;
        const formulas = BatchController.formulas;
        const me = ns.getPlayer();
        const serverList = this.getAllServers().filter((server) => {
            return (
                server.hostname !== 'home' &&
                !ns.getPurchasedServers().includes(server.hostname) &&
                server.hasAdminRights &&
                server.requiredHackingSkill! <= me.skills.hacking * 0.5
            );
        });
        const scores: { hostname: string; score: number }[] = [];
        for (const server of serverList) {
            const optimalServer = this.getOptimalServer(server.hostname);

            if (
                !this.isRunableSmallestBatch(server.hostname, false) &&
                !this.isRunableSmallestBatch(server.hostname, true)
            ) {
                continue;
            }
            const currentScore = server.moneyMax! / formulas.hacking.hackTime(optimalServer, me);
            scores.push({ hostname: server.hostname, score: currentScore });
        }
        return scores.sort((a, b) => b.score - a.score).map((v) => v.hostname);
    }

    public makeBatchStrategy(): {
        target: string;
        home: { batchSize: batchSize; batchTimes: number };
        others: { batchSize: batchSize; batchTimes: number };
    }[] {
        const sortedTargets = this.getScoringTargets();
        const maxBatchTimes = Math.ceil(5000);
        let ramUsedHome: number = 0;
        let ramUsedOthers: number = 0;
        let isRunoutHome: boolean = false;
        let isRunoutOthers: boolean = false;
        const strategy: strategy[] = [];

        for (const target of sortedTargets) {
            if (!this.isRunableSmallestBatch(target, true) && !this.isRunableSmallestBatch(target, false)) continue;
            if (isRunoutHome && isRunoutOthers) break;
            const batchSizeAndTimesHome = this.getBatchSizeAndTimesForStratedy(
                target,
                ramUsedHome,
                true,
                maxBatchTimes,
                isRunoutHome,
            );
            const batchSizeHome = batchSizeAndTimesHome.batchSize;
            const batchTimesHome = batchSizeAndTimesHome.batchTimes;
            ramUsedHome = batchSizeAndTimesHome.ramUsed;
            isRunoutHome = batchSizeAndTimesHome.isRunout;

            const batchSizeAndTimesOthers = this.getBatchSizeAndTimesForStratedy(
                target,
                ramUsedOthers,
                false,
                maxBatchTimes - batchTimesHome,
                isRunoutOthers,
            );
            const batchSizeOthers = batchSizeAndTimesOthers.batchSize;
            const batchtimesOthers = batchSizeAndTimesOthers.batchTimes;
            ramUsedOthers = batchSizeAndTimesOthers.ramUsed;
            isRunoutOthers = batchSizeAndTimesOthers.isRunout;

            // BatchController.ns.tprint('home:   ' + ramUsedHome + '/' + this.getSumAvailaleRam(true));
            // BatchController.ns.tprint('others: ' + ramUsedOthers + '/' + this.getSumAvailaleRam(false));
            if (!batchSizeHome.isOK && !batchSizeOthers.isOK) continue;
            strategy.push({
                target: target,
                home: { batchSize: batchSizeHome, batchTimes: batchTimesHome },
                others: {
                    batchSize: batchSizeOthers,
                    batchTimes: batchtimesOthers,
                },
            });
        }

        return strategy;
    }

    private getBatchSizeAndTimesForStratedy(
        target: string,
        ramUsed: number,
        isHome: boolean,
        maxBatchTimes: number,
        isRunout: boolean,
    ): {
        batchSize: batchSize;
        batchTimes: number;
        ramUsed: number;
        isRunout: boolean;
    } {
        const falseSize: unavailableBatchSize = { isOK: false };
        const falseSizeAndTimes = {
            batchSize: falseSize,
            batchTimes: 0,
            ramUsed: ramUsed,
            isRunout: isRunout,
        };
        if (maxBatchTimes === 0 || !this.isRunableSmallestBatch(target, isHome) || isRunout) return falseSizeAndTimes;

        const batchSize = this.seekOptimalBatchSize(target, isHome);
        if (!batchSize.isOK) return falseSizeAndTimes;

        const ramForOnce = this.getSumRamOfBatchSize(batchSize);
        const ramAvailable = this.getSumAvailaleRam(isHome);
        if (ramAvailable - ramUsed < ramForOnce) {
            falseSizeAndTimes.isRunout = true;
            return falseSizeAndTimes;
        }

        const batchTimes = Math.min(this.getBatchTimes(batchSize, isHome, ramUsed), maxBatchTimes);
        const newRamUsed = ramUsed + ramForOnce * batchTimes;
        const newIsRunout = batchTimes !== maxBatchTimes;

        return {
            batchSize: batchSize,
            batchTimes: batchTimes,
            ramUsed: newRamUsed,
            isRunout: newIsRunout,
        };
    }
}

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('sleep');
    ns.enableLog('print');
    ns.enableLog('printf');
    ns.enableLog('tprint');
    ns.enableLog('tprintf');
    ns.enableLog('kill');
    BatchController.ns = ns;
    if (ns.fileExists('Formulas.exe', 'home')) {
        BatchController.formulas = ns.formulas;
    }

    const controller = new BatchController();
    while (true) {
        controller.tryGetAdmin();

        await Utils.asyncExec(ns, MAINPORTNUM, 'join_factions.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'buy_programs.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'w0r1d_d43m0n.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'buy_servers.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'upgrade_home_pc.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'upgrade_servers.js', 'home', 1);
        await Utils.asyncExec(ns, MAINPORTNUM, 'augmentations.js', 'home', 1);
        const batchStrategy = controller.makeBatchStrategy();
        ns.print(batchStrategy);

        if (batchStrategy.length === 0) {
            ns.tprint('no target');
            await Utils.asyncExec(ns, MAINPORTNUM, 'university.js', 'home', 1);
            continue;
        }

        for (const strategy of batchStrategy) {
            const target = strategy.target;
            await Utils.asyncExec(ns, MAINPORTNUM, 'backdoor.js', 'home', 1, ['--target', target]);
            const isProcessDone = await controller.waitUntilServerOptimalState(target);
            if (isProcessDone) break;
        }

        const isAllServerOptimized = batchStrategy.every((strategy) => {
            return isServerOptimized(ns, strategy.target);
        });

        if (!isAllServerOptimized) continue;

        await Promise.all(batchStrategy.map((strategy) => controller.runBatchFromStrategy(strategy)));

        await ns.sleep(1000);
    }
}
