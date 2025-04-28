import { NS, Server } from 'Bitburner';

export type SuccessResult = { success: true; message: string };
export type FailureResult = { success: false; message: string; error: string };
export type ExecutionResult = SuccessResult | FailureResult;

export function safeExec(
    ns: NS,
    script: string,
    hostname: string,
    thread: number,
    args?: string[],
): ExecutionResult {
    const script_ram = ns.getScriptRam(script);
    // ns.tprintf("script: %s %s, ram: %s, server_ram: %s", script, args?.join(" "), script_ram, ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname));
    if (
        ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname) <
        script_ram
    ) {
        return {
            success: false,
            message: script + ' ' + args?.join(' '),
            error: 'out of memory',
        };
    }
    // ns.print(script);
    if (typeof args === 'undefined') {
        ns.exec(script, hostname, thread);
    } else {
        ns.exec(script, hostname, thread, ...args);
    }
    return { success: true, message: script + ' ' + args?.join(' ') };
}

export async function asyncExec(
    ns: NS,
    port: number,
    script: string,
    hostname: string,
    thread: number,
    a_args?: string[],
): Promise<ExecutionResult> {
    const port_handle = ns.getPortHandle(port);
    const args = a_args ?? [];
    args.push('--port');
    args.push(port.toString());

    port_handle.clear();
    const res = safeExec(ns, script, hostname, thread, args);
    // ns.print(res);
    await ns.sleep(20);
    if (res.success) {
        if (port_handle.empty()) {
            // ns.print("waiting");
            await port_handle.nextWrite();
        }
        // ns.print(port_handle.read);
        port_handle.clear();
        return { success: true, message: script + ' ' + a_args?.join(' ') };
    } else {
        return {
            success: false,
            message: script + ' ' + a_args?.join(' '),
            error: res.error,
        };
    }
}

export function getMyPID(ns: NS) {
    const script = ns.getScriptName();
    const hostname = ns.getHostname();
    const args = ns.args;

    const processes = ns.ps(hostname);

    const my_process = processes.find(
        (proc) =>
            proc.filename === script &&
            JSON.stringify(proc.args) === JSON.stringify(args),
    );

    return my_process?.pid;
}

export class ServerNode {
    private ns: NS;
    private server: Server;
    private children: ServerNode[];

    constructor(ns: NS, hostname: string) {
        this.ns = ns;
        this.server = this.ns.getServer(hostname);
        this.children = [];
    }

    makeTree() {
        const ns = this.ns;
        const stack: { current: ServerNode; parent: ServerNode | null }[] = [];
        const visited = new Set<ServerNode>();
        const myservers = ns.getPurchasedServers();

        stack.push({ current: this, parent: null });

        while (stack.length > 0) {
            const { current, parent } = stack.pop()!;

            if (visited.has(current)) continue;
            visited.add(current);

            const child_hostnames = this.ns
                .scan(current.server.hostname)
                .filter(
                    (hostname) =>
                        hostname !== current.server.hostname &&
                        hostname !== parent?.server.hostname &&
                        !myservers.includes(hostname),
                );

            for (const child_hostname of child_hostnames) {
                const child = new ServerNode(this.ns, child_hostname);
                current.children.push(child);
                stack.push({ current: child, parent: current });
            }
        }
    }

    getAllNodes() {
        const servers: string[] = [];
        const stack: ServerNode[] = [this];

        while (stack.length > 0) {
            const current = stack.pop()!;
            servers.push(current.server.hostname);
            stack.push(...current.children.reverse());
        }

        return servers;
    }

    getPath(target: string): string[] {
        const paths: string[][] = [];
        const stack: { node: ServerNode; path: string[] }[] = [
            { node: this, path: [this.server.hostname] },
        ];

        while (stack.length > 0) {
            const current = stack.pop() as { node: ServerNode; path: string[] };
            paths.push(current.path);
            for (const child of current.node.children) {
                stack.push({
                    node: child,
                    path: [...current.path, child.server.hostname],
                });
            }
        }
        for (const path of paths) {
            if (path.at(-1) !== target) {
                continue;
            }
            return path;
        }
        return [];
    }
}
