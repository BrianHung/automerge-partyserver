import { type PeerId, Repo, } from '@automerge/automerge-repo';
import { DurableObjectState } from '@cloudflare/workers-types';
import { Connection, routePartykitRequest, Server } from 'partyserver';
import { WorkerWebSocketAdapter } from '../automerge-repo-network-websocket/WorkerWebSocketAdapter';
import { DurableObjectStorageAdapter } from '../automerge-repo-storage-durable-objects';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2; // eslint-disable-line
const wsReadyStateClosed = 3; // eslint-disable-line

export class AutomergeServer extends Server {

	repo: Repo;

	constructor(
		private readonly ctx: DurableObjectState,
		private readonly env
	) {
		super(ctx, env);
		this.repo = new Repo({
			storage: new DurableObjectStorageAdapter(ctx.storage),
			peerId: `worker-${ctx.id}` as PeerId,
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async onLoad(): Promise<void> {
		// to be implemented by the user
		return;
	}

	async onSave(): Promise<void> {}

	async onStart(): Promise<void> {
		console.log("on Start");
    const src = await this.onLoad();
    if (src != null) {
      // apply update to local document
    }

		// debounced save on document update
  }

	async onConnect(conn: Connection) {
		const ctx = this.ctx;
		console.log("connecting", conn.id);
		this.repo.networkSubsystem.addNetworkAdapter(new WorkerWebSocketAdapter(conn));
	}

	onMessage(sender: Connection<unknown>, message) {
		console.log("onMessage", sender.id, message, [...this.getConnections()].map(c => c.id));

		this.broadcast(message, [sender.id]);
	}

	onClose(conn: Connection<unknown>, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		closeConn(conn);
	}
}

function closeConn(conn: Connection) {
	// cleanup awareness and repo here
	// close connection
	try {
		conn.close();
	} catch (e) {
		console.warn("failed to close connection", e);
	}
}

function send(conn: Connection, m: Uint8Array) {
  if (
    conn.readyState !== undefined &&
    conn.readyState !== wsReadyStateConnecting &&
    conn.readyState !== wsReadyStateOpen
  ) {
    closeConn(conn);
  }
  try {
    conn.send(m);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    closeConn(conn);
  }
}

export default {
	fetch(request, env) {
		return routePartykitRequest(request, env) || new Response('Not Found', { status: 404 });
	},
};