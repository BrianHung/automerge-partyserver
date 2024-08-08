import { PeerId, Repo } from '@automerge/automerge-repo';
import { DurableObjectState } from '@cloudflare/workers-types';
import { Connection } from 'partyserver';
import { WorkerWebSocketAdapter } from '../automerge-repo-network-websocket/WorkerWebSocketAdapter';
import { DurableObjectStorageAdapter } from '../automerge-repo-storage-durable-objects';

const getAutomergeRepoPromises = new Map<string, Promise<Repo>>();

interface AutomergePartyKitOptions {}

export async function onConnect(conn: Connection, ctx: DurableObjectState, opts: AutomergePartyKitOptions = {}) {
	// Check if repo exists for this connection.
	if (!getAutomergeRepoPromises.has(conn.id)) {
		const serverRepo = new Repo({
			storage: new DurableObjectStorageAdapter(ctx.storage),
			network: [new WorkerWebSocketAdapter(conn)],
			peerId: `worker-${conn.id}` as PeerId,
		});
		getAutomergeRepoPromises.set(conn.id, serverRepo);
	}

	const repo = await getAutomergeRepoPromises.get(conn.id)!;
	getAutomergeRepoPromises.delete(conn.id);

	conn.addEventListener('close', () => {
		// Clean up repo here.
		console.log('disconecting user', ctx.id);
	});
}
